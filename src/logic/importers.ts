// 仕様書 7章 AIの答えの取り込み（JSON部分だけを読む。壊れていてもアプリは落とさない）
import type { AiItemResult, Case, CaseCard, ChecklistItem, ItemResult, ReviewFinding, ReviewFindingType, Verdict } from '../types';
import { emptyItemResult } from '../types';
import { isBlank, uniq } from './util';

export type JsonExtract = { ok: true; value: unknown; source: 'fence' | 'bare' } | { ok: false; error: string };

function tryParse(s: string): unknown | undefined {
  try {
    return JSON.parse(s);
  } catch {
    // 末尾のカンマなど、よくある崩れだけ直して再挑戦
    try {
      const repaired = s
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[“”]/g, '"')
        .replace(/^﻿/, '');
      return JSON.parse(repaired);
    } catch {
      return undefined;
    }
  }
}

/** 返答の中から JSON を取り出す。```json ... ``` を優先し、最後のかたまりから試す */
export function extractJson(text: string): JsonExtract {
  if (isBlank(text)) return { ok: false, error: '貼り付けた文章が空です。' };
  const fences = [...text.matchAll(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean);
  for (let i = fences.length - 1; i >= 0; i -= 1) {
    const v = tryParse(fences[i]);
    if (v !== undefined && typeof v === 'object') return { ok: true, value: v, source: 'fence' };
  }
  // 囲みがない／囲みの中が壊れているとき：最初の { から最後の } まで
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const v = tryParse(text.slice(first, last + 1));
    if (v !== undefined && typeof v === 'object') return { ok: true, value: v, source: 'bare' };
  }
  return { ok: false, error: 'JSONの部分が見つからないか、壊れていて読めませんでした。AIに「JSONだけをもう一度出して」と頼むか、「手で写す」に切り替えてください。' };
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : str(v) ? [str(v) as string] : []);
const NONE = /^(書かれていない|不明|なし|無し|特になし|該当なし|null|none|n\/a|-)$/i;
const clean = (v: unknown): string | undefined => {
  const s = str(v);
  return s && !NONE.test(s) ? s : undefined;
};

export interface ImportWarning {
  itemId?: string;
  message: string;
}

// ---------- 7.1 案件カード ----------

export type CardImport = { ok: true; card: Partial<CaseCard>; warnings: ImportWarning[] } | { ok: false; error: string };

export function parseCardJson(text: string): CardImport {
  const ex = extractJson(text);
  if (!ex.ok) return ex;
  const o = ex.value as Record<string, unknown>;
  const warnings: ImportWarning[] = [];
  const intro = (o.introducer ?? {}) as Record<string, unknown>;
  const payee = (o.payee ?? {}) as Record<string, unknown>;
  const recv = (o.receivedAt ?? {}) as Record<string, unknown>;
  const card: Partial<CaseCard> = {
    caseName: clean(o.caseName),
    companyNames: strArr(o.companyNames).filter((s) => !NONE.test(s)),
    claimedRegistrationNo: clean(o.claimedRegistrationNo),
    companyAddress: clean(o.companyAddress),
    companyPhone: clean(o.companyPhone),
    representative: clean(o.representative),
    introducer: { name: clean(intro.name), snsNames: strArr(intro.snsNames), relation: clean(intro.relation) },
    urls: strArr(o.urls),
    payee: { accountName: clean(payee.accountName), bank: clean(payee.bank), cryptoAddresses: strArr(payee.cryptoAddresses) },
    amount: clean(o.amount),
    promisedReturn: clean(o.promisedReturn),
    withdrawal: clean(o.withdrawal),
    receivedAt: { date: clean(recv.date), channel: clean(recv.channel) },
    deadline: clean(o.deadline),
    celebrities: clean(o.celebrities),
    notablePhrases: strArr(o.notablePhrases).slice(0, 3),
  };
  if (!card.caseName && card.companyNames!.length === 0) warnings.push({ message: '案件名も会社名も読み取れませんでした。手で入力してください。' });
  return { ok: true, card, warnings };
}

/** 空いている欄だけ埋める。配列は足し合わせる */
export function mergeCard(base: CaseCard, imp: Partial<CaseCard>): CaseCard {
  const pick = (a?: string, b?: string) => (isBlank(a) ? b : a);
  return {
    caseName: pick(base.caseName, imp.caseName),
    companyNames: uniq([...base.companyNames, ...(imp.companyNames ?? [])]),
    claimedRegistrationNo: pick(base.claimedRegistrationNo, imp.claimedRegistrationNo),
    companyAddress: pick(base.companyAddress, imp.companyAddress),
    companyPhone: pick(base.companyPhone, imp.companyPhone),
    representative: pick(base.representative, imp.representative),
    introducer: {
      name: pick(base.introducer?.name, imp.introducer?.name),
      snsNames: uniq([...(base.introducer?.snsNames ?? []), ...(imp.introducer?.snsNames ?? [])]),
      relation: pick(base.introducer?.relation, imp.introducer?.relation),
    },
    urls: uniq([...base.urls, ...(imp.urls ?? [])]),
    payee: {
      accountName: pick(base.payee?.accountName, imp.payee?.accountName),
      bank: pick(base.payee?.bank, imp.payee?.bank),
      cryptoAddresses: uniq([...(base.payee?.cryptoAddresses ?? []), ...(imp.payee?.cryptoAddresses ?? [])]),
    },
    amount: pick(base.amount, imp.amount),
    promisedReturn: pick(base.promisedReturn, imp.promisedReturn),
    withdrawal: pick(base.withdrawal, imp.withdrawal),
    receivedAt: { date: pick(base.receivedAt?.date, imp.receivedAt?.date), channel: pick(base.receivedAt?.channel, imp.receivedAt?.channel) },
    deadline: pick(base.deadline, imp.deadline),
    celebrities: pick(base.celebrities, imp.celebrities),
    notablePhrases: uniq([...base.notablePhrases, ...(imp.notablePhrases ?? [])]).slice(0, 3),
  };
}

// ---------- 7.2 AI下調べ ----------

export interface ResearchImportItem {
  ai: AiItemResult;
}

export type ResearchImport =
  | {
      ok: true;
      results: Record<string, ResearchImportItem>;
      overall?: string;
      selfCheck: string[];
      warnings: ImportWarning[];
      missing: string[];
    }
  | { ok: false; error: string };

const STATUSES = ['found', 'not_found', 'could_not_check', 'na'] as const;
const VERDICTS: Verdict[] = ['red', 'yellow', 'blue', 'na'];

function normVerdict(v: unknown): Verdict | undefined {
  const s = str(v)?.toLowerCase();
  if (!s) return undefined;
  if (VERDICTS.includes(s as Verdict)) return s as Verdict;
  const jp: Record<string, Verdict> = { 赤: 'red', 黄: 'yellow', 青: 'blue', 該当なし: 'na', 黄色: 'yellow' };
  return jp[s];
}

function normStatus(v: unknown): AiItemResult['status'] {
  const s = str(v)?.toLowerCase();
  if (s && (STATUSES as readonly string[]).includes(s)) return s as AiItemResult['status'];
  return 'unknown';
}

export function parseAiResearch(text: string, items: ChecklistItem[], now: string): ResearchImport {
  const ex = extractJson(text);
  if (!ex.ok) return ex;
  const o = ex.value as Record<string, unknown>;
  const arr = Array.isArray(o.items) ? o.items : Array.isArray(o) ? (o as unknown[]) : undefined;
  if (!arr) return { ok: false, error: 'JSONに "items" の一覧がありません。7.2の形で出し直してもらってください。' };
  const warnings: ImportWarning[] = [];
  const results: Record<string, ResearchImportItem> = {};
  const known = new Map(items.map((it) => [it.id, it]));
  for (const rawRow of arr) {
    if (!rawRow || typeof rawRow !== 'object') continue;
    const row = rawRow as Record<string, unknown>;
    const id = str(row.id)?.replace(/[−‐–—]/g, '-').replace(/\s/g, '');
    if (!id) continue;
    const item = known.get(id);
    if (!item) {
      warnings.push({ itemId: id, message: `項目 ${id} はチェック表にないので読み飛ばしました。` });
      continue;
    }
    const status = normStatus(row.status);
    const urls = strArr(row.urls).filter((u) => /^https?:\/\//i.test(u));
    const badUrls = strArr(row.urls).length - urls.length;
    if (badUrls > 0) warnings.push({ itemId: id, message: `${id}：URLの形になっていないものを ${badUrls} 件落としました。` });
    const rawVerdict = str(row.verdict);
    let verdict = normVerdict(row.verdict);
    const w: string[] = [];
    if (!verdict) {
      verdict = 'yellow';
      w.push(`判定「${rawVerdict ?? '（空）'}」が読めないので黄にしました。`);
    }
    if (status === 'could_not_check') {
      if (verdict !== 'yellow') w.push('調べられなかった項目なので黄にしました。');
      verdict = 'yellow';
    }
    if (status === 'found' && urls.length === 0) {
      w.push('URLなし：「見つけた」と書いてあるのにURLがないので黄にしました（URLを示せないことは見つけたと書かない）。');
      verdict = 'yellow';
    }
    if (status === 'na' || verdict === 'na') {
      if (item.naAllowed) {
        verdict = 'na';
      } else {
        w.push('この項目は「該当なし」にできないので黄にしました。');
        verdict = 'yellow';
      }
    }
    if (status === 'unknown') w.push(`status「${str(row.status) ?? '（空）'}」が読めませんでした。`);
    if (verdict === 'red' && urls.length === 0) w.push('赤なのにURLがありません。自分で証拠（URL・スクリーンショット・引用）を入れないと赤にできません。');
    if (item.selfRequired) w.push('この項目は、AIの判定にかかわらず自分で一覧を開いて確かめてください。');
    const ai: AiItemResult = {
      status,
      verdict,
      rawVerdict,
      result: str(row.result) ?? '',
      urls,
      naReason: clean(row.naReason) ?? (verdict === 'na' ? str(row.result) : undefined),
      warnings: w,
      importedAt: now,
    };
    results[id] = { ai };
    for (const m of w) warnings.push({ itemId: id, message: `${id}：${m}` });
  }
  const missing = items.map((i) => i.id).filter((id) => !results[id]);
  if (missing.length) warnings.push({ message: `AIの答えに ${missing.length} 項目がありません（${missing.slice(0, 8).join('、')}${missing.length > 8 ? ' ほか' : ''}）。その項目は未調査のままです。` });
  return { ok: true, results, overall: str(o.overall), selfCheck: strArr(o.selfCheck), warnings, missing };
}

/** 取り込んだ結果を案件に書き込む。利用者が自分で確定した項目は上書きしない（AIの結果は ai 欄に残す） */
export function applyResearchImport(c: Case, imp: Extract<ResearchImport, { ok: true }>, items: ChecklistItem[], now: string): { applied: number; kept: number } {
  let applied = 0;
  let kept = 0;
  for (const it of items) {
    const r = imp.results[it.id];
    if (!r) continue;
    const cur: ItemResult = c.items[it.id] ?? emptyItemResult();
    const userDecided = cur.verdict !== 'unchecked' && !cur.provisional;
    const next: ItemResult = { ...cur, ai: r.ai, updatedAt: now };
    if (!userDecided) {
      let v: Verdict = r.ai.verdict;
      // 赤はこの時点では証拠（URL）が要る。URLがなければ黄の仮判定にする
      if (v === 'red' && r.ai.urls.length === 0) v = 'yellow';
      next.verdict = v;
      next.provisional = true;
      next.checkedBy = 'ai';
      if (isBlank(cur.memo)) next.memo = r.ai.result;
      if (v === 'na') next.naReason = r.ai.naReason ?? cur.naReason ?? '（AIの下調べ：理由未記載）';
      const have = new Set(cur.urls.map((u) => u.url));
      next.urls = [...cur.urls, ...r.ai.urls.filter((u) => !have.has(u)).map((u) => ({ url: u, viewedAt: now }))];
      applied += 1;
    } else {
      kept += 1;
    }
    c.items[it.id] = next;
  }
  return { applied, kept };
}

// ---------- 7.3 見落としチェック ----------

export type ReviewImport = { ok: true; findings: ReviewFinding[]; warnings: ImportWarning[] } | { ok: false; error: string };

const FINDING_TYPES: ReviewFindingType[] = ['no_url', 'not_found_as_safe', 'should_be_red', 'name_only_match'];

export function parseReviewJson(text: string, items: ChecklistItem[]): ReviewImport {
  const ex = extractJson(text);
  if (!ex.ok) return ex;
  const o = ex.value as Record<string, unknown>;
  const arr = Array.isArray(o.findings) ? o.findings : Array.isArray(o) ? (o as unknown[]) : undefined;
  if (!arr) return { ok: false, error: 'JSONに "findings" の一覧がありません。' };
  const known = new Set(items.map((i) => i.id));
  const warnings: ImportWarning[] = [];
  const findings: ReviewFinding[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = str(row.id)?.replace(/[−‐–—]/g, '-').replace(/\s/g, '');
    if (!id || !known.has(id)) {
      warnings.push({ message: `項目 ${id ?? '（空）'} はチェック表にないので読み飛ばしました。` });
      continue;
    }
    const t = str(row.type) as ReviewFindingType | undefined;
    findings.push({ id, type: t && FINDING_TYPES.includes(t) ? t : 'other', comment: str(row.comment) ?? '' });
  }
  return { ok: true, findings, warnings };
}

export function applyReviewImport(c: Case, findings: ReviewFinding[], items: ChecklistItem[], now: string): void {
  const cats = uniq(findings.map((f) => items.find((i) => i.id === f.id)?.cat).filter((n): n is number => typeof n === 'number'));
  c.review = { status: 'done', flaggedCategories: cats, findings, doneAt: now };
  for (const it of items) {
    if (!cats.includes(it.cat)) continue;
    const cur = c.items[it.id] ?? emptyItemResult();
    c.items[it.id] = { ...cur, reviewed: false };
  }
}
