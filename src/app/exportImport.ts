// 仕様書 6.1 書き出し（案件ごとにZIP）・読み込み（case.json または ZIP）
import JSZip from 'jszip';
import type { Case, CaseCard, ChecklistItem, ItemResult, StoredBlob } from '../types';
import { VERDICT_LABEL } from '../types';
import type { VerdictContext } from '../logic/verdict';
import { getResult } from '../logic/verdict';
import { buildSheetData, renderSheetHtml } from '../logic/sheet';
import { formatDateTime, isBlank, safeFileName, ymd } from '../logic/util';
import { caseTitle } from '../logic/crossref';
import { db } from './db';
import { getBlobsOfCase } from './store';

export function zipFileName(c: Case, date?: string): string {
  return `${safeFileName(caseTitle(c))}_${ymd(date)}.zip`;
}

function extOf(type: string, name: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  if (m) return m[1].toLowerCase();
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'bin';
}

function csvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export function checklistCsv(c: Case, items: ChecklistItem[]): string {
  const head = ['番号', '分類', '確かめること', '判定', '仮', '確認した人', '結果メモ', '該当なしの理由', '見たURL', '引用', 'スクリーンショット数', '同一人物の手がかり', '更新日時'];
  const rows = items.map((it) => {
    const r = getResult(c.items, it.id);
    return [
      it.id,
      String(it.cat),
      it.question,
      VERDICT_LABEL[r.verdict],
      r.provisional ? '仮' : '',
      r.checkedBy === 'self' ? '自分' : r.checkedBy === 'ai' ? 'AI下調べ' : '',
      r.memo ?? '',
      r.naReason ?? '',
      r.urls.map((u) => u.url).join(' '),
      r.quotes.join(' / '),
      String(r.screenshots.length),
      (r.identityMatches ?? []).join(' '),
      r.updatedAt ? formatDateTime(r.updatedAt) : '',
    ]
      .map(csvCell)
      .join(',');
  });
  return `﻿${head.map(csvCell).join(',')}\n${rows.join('\n')}\n`;
}

export function urlsText(c: Case, items: ChecklistItem[]): string {
  const lines: string[] = [`見たURLと日時　${caseTitle(c)}`, ''];
  for (const it of items) {
    const r = getResult(c.items, it.id);
    if (!r.urls.length) continue;
    lines.push(`[${it.id}] ${it.question}`);
    for (const u of r.urls) lines.push(`  ${formatDateTime(u.viewedAt)}  ${u.url}`);
  }
  return `${lines.join('\n')}\n`;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
}

/** 案件1つをZIPにまとめる */
export async function buildCaseZip(c: Case, ctx: VerdictContext, opts: { fileName?: string; zip?: JSZip; folder?: string } = {}): Promise<ExportResult> {
  const fileName = opts.fileName ?? zipFileName(c);
  const root = opts.zip ?? new JSZip();
  const dir = opts.folder ? root.folder(opts.folder)! : root;
  const blobs = await getBlobsOfCase(c.id);
  dir.file('case.json', JSON.stringify(c, null, 2));
  const latest = c.snapshots.at(-1);
  const html = latest?.html ?? renderSheetHtml(buildSheetData(c, ctx, { evidenceFileName: fileName }));
  dir.file('判定の1枚.html', html);
  dir.file('チェック表.csv', checklistCsv(c, ctx.items));
  dir.file('urls.txt', urlsText(c, ctx.items));
  const ev = dir.folder('evidence')!;
  const index: { file: string; id: string; itemId: string; name: string; type: string; createdAt: string }[] = [];
  const counters = new Map<string, number>();
  for (const b of blobs) {
    const n = (counters.get(b.itemId) ?? 0) + 1;
    counters.set(b.itemId, n);
    const file = `${safeFileName(b.itemId)}_${String(n).padStart(2, '0')}.${extOf(b.type, b.name)}`;
    ev.file(file, b.blob);
    index.push({ file, id: b.id, itemId: b.itemId, name: b.name, type: b.type, createdAt: b.createdAt });
  }
  ev.file('index.json', JSON.stringify(index, null, 2));
  if (opts.zip) return { blob: new Blob(), fileName };
  const blob = await root.generateAsync({ type: 'blob' });
  return { blob, fileName };
}

/** 全案件を1つのZIPに（案件ごとのフォルダ） */
export async function buildAllZip(cases: Case[], ctxOf: (c: Case) => VerdictContext): Promise<ExportResult> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const c of cases) {
    let folder = safeFileName(caseTitle(c));
    if (used.has(folder)) folder = `${folder}_${c.id.slice(0, 8)}`;
    used.add(folder);
    await buildCaseZip(c, ctxOf(c), { zip, folder: `cases/${folder}` });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, fileName: `うまい話チェック_全案件_${ymd()}.zip` };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ImportPayload {
  c: Case;
  blobs: StoredBlob[];
  warnings: string[];
}

function isCase(v: unknown): v is Case {
  return !!v && typeof v === 'object' && typeof (v as Case).id === 'string' && typeof (v as Case).items === 'object' && !!(v as Case).card;
}

/** 古い形や欠けている欄を埋める */
export function normalizeCase(raw: Case): Case {
  const rawCard = (raw.card ?? {}) as Partial<CaseCard>;
  const rawReview = (raw.review ?? {}) as Partial<Case['review']>;
  const c: Case = {
    ...raw,
    card: { ...rawCard, companyNames: rawCard.companyNames ?? [], urls: rawCard.urls ?? [], notablePhrases: rawCard.notablePhrases ?? [] },
    rawMessages: raw.rawMessages ?? '',
    maskWords: Array.isArray(raw.maskWords) ? raw.maskWords.map((m) => (typeof m === 'string' ? { word: m, label: '【伏せ字】' } : m)) : [],
    items: raw.items ?? {},
    previousNames: raw.previousNames ?? [],
    review: { ...rawReview, status: rawReview.status ?? 'pending', flaggedCategories: rawReview.flaggedCategories ?? [], findings: rawReview.findings ?? [] },
    stoppedEarly: !!raw.stoppedEarly,
    snapshots: raw.snapshots ?? [],
    attachments: raw.attachments ?? [],
  };
  if (!c.card.introducer) c.card.introducer = { snsNames: [] };
  if (!c.card.introducer.snsNames) c.card.introducer.snsNames = [];
  if (!c.card.payee) c.card.payee = { cryptoAddresses: [] };
  if (!c.card.payee.cryptoAddresses) c.card.payee.cryptoAddresses = [];
  for (const [id, r] of Object.entries(c.items)) {
    const rr = r as Partial<ItemResult>;
    c.items[id] = { ...rr, verdict: rr.verdict ?? 'unchecked', provisional: !!rr.provisional, urls: rr.urls ?? [], screenshots: rr.screenshots ?? [], quotes: rr.quotes ?? [] };
  }
  if (c.alreadyPaid) c.alreadyPaid = { ...c.alreadyPaid, consulted: c.alreadyPaid.consulted ?? [], screenshots: c.alreadyPaid.screenshots ?? [] };
  return c;
}

export async function readImportFile(file: File | Blob, name = ''): Promise<ImportPayload[]> {
  const isZip = /\.zip$/i.test(name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
  if (!isZip) {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('JSONとして読めませんでした。case.json か、書き出したZIPを選んでください。');
    }
    if (!isCase(parsed)) throw new Error('この形式の案件ファイルではありません（id・card・items がありません）。');
    const warnings: string[] = [];
    const c = normalizeCase(parsed);
    const n = stripMissingBlobs(c, new Set());
    if (n > 0) warnings.push(`スクリーンショット ${n} 件は case.json だけでは復元できないので外しました（ZIPなら復元できます）。`);
    return [{ c, blobs: [], warnings }];
  }
  const zip = await JSZip.loadAsync(file);
  const caseFiles = Object.keys(zip.files).filter((p) => /(^|\/)case\.json$/.test(p));
  if (!caseFiles.length) throw new Error('ZIPの中に case.json がありません。');
  const out: ImportPayload[] = [];
  for (const path of caseFiles) {
    const base = path.slice(0, path.length - 'case.json'.length);
    const text = await zip.file(path)!.async('string');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${path} が読めませんでした。`);
    }
    if (!isCase(parsed)) throw new Error(`${path} は案件ファイルの形ではありません。`);
    const c = normalizeCase(parsed);
    const warnings: string[] = [];
    const blobs: StoredBlob[] = [];
    const idxFile = zip.file(`${base}evidence/index.json`);
    if (idxFile) {
      const idx = JSON.parse(await idxFile.async('string')) as { file: string; id: string; itemId: string; name: string; type: string; createdAt: string }[];
      for (const e of idx) {
        const f = zip.file(`${base}evidence/${e.file}`);
        if (!f) {
          warnings.push(`evidence/${e.file} がZIPにありません。`);
          continue;
        }
        const data = await f.async('blob');
        blobs.push({ id: e.id, caseId: c.id, itemId: e.itemId, name: e.name, type: e.type, blob: data.type ? data : new Blob([data], { type: e.type }), createdAt: e.createdAt });
      }
    }
    const n = stripMissingBlobs(c, new Set(blobs.map((b) => b.id)));
    if (n > 0) warnings.push(`スクリーンショット ${n} 件の実体が見つからないので外しました。`);
    out.push({ c, blobs, warnings });
  }
  return out;
}

function stripMissingBlobs(c: Case, have: Set<string>): number {
  let n = 0;
  for (const r of Object.values(c.items)) {
    const before = r.screenshots.length;
    r.screenshots = r.screenshots.filter((id) => have.has(id));
    n += before - r.screenshots.length;
  }
  c.attachments = c.attachments.filter((a) => {
    if (have.has(a.blobId)) return true;
    n += 1;
    return false;
  });
  if (c.alreadyPaid) {
    const before = c.alreadyPaid.screenshots.length;
    c.alreadyPaid.screenshots = c.alreadyPaid.screenshots.filter((id) => have.has(id));
    n += before - c.alreadyPaid.screenshots.length;
  }
  return n;
}

/** 読み込んだ案件を保存する。同じIDがあれば置き換える */
export async function importPayload(p: ImportPayload): Promise<void> {
  await db.transaction('rw', db.cases, db.blobs, async () => {
    await db.blobs.where('caseId').equals(p.c.id).delete();
    await db.cases.put(p.c);
    for (const b of p.blobs) await db.blobs.put(b);
  });
}

export async function existingCaseIds(ids: string[]): Promise<string[]> {
  const found = await db.cases.where('id').anyOf(ids).toArray();
  return found.map((c) => c.id);
}

export function describePayload(p: ImportPayload): string {
  const name = caseTitle(p.c);
  const n = Object.keys(p.c.items).length;
  return `${name}（項目 ${n} 件、スクリーンショット ${p.blobs.length} 件${isBlank(p.c.investigator) ? '' : `、調べた人：${p.c.investigator}`}）`;
}
