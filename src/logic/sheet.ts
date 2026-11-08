// S5 判定の1枚：アプリの中で集計する（AIは使わない）。HTMLは画面表示・印刷・書き出し・版の保存で共通。
import type { Case, ChecklistItem, Overall, VerdictCounts } from '../types';
import { VERDICT_ICON, VERDICT_LABEL } from '../types';
import type { VerdictContext } from './verdict';
import { conclusionSentence, countVerdicts, getResult, overallVerdict, yellowItems } from './verdict';
import { escapeHtml, formatDate, isBlank } from './util';

export interface SheetRow {
  id: string;
  question: string;
  text: string;
}

export interface SheetData {
  caseName: string;
  investigator?: string;
  dateLabel: string;
  counts: VerdictCounts;
  overall: Overall;
  reds: SheetRow[];
  redMore: number;
  yellows: SheetRow[];
  yellowMore: number;
  selfChecked: { id: string; done: boolean }[];
  conclusion: string;
  evidenceLocation: string;
  notes: string[];
  disclaimer: string;
  paid?: { lines: string[] };
  version?: number;
  confirmedAt?: string;
  confirmed: boolean;
  shareCaution: string;
}

export const SHEET_DISCLAIMER = 'この判定は、払うかどうかを決めるための材料です。安全や利益の保証ではなく、相手を詐欺と決めつけるものでもありません。';
export const SHARE_CAUTION = '調べた結果をSNSなどで公開するときは、事実（どの一覧に載っていたか、URL）だけを書き、決めつける言葉は使いません。';

export interface SheetOptions {
  evidenceFileName?: string;
  version?: number;
  confirmedAt?: string;
}

function reasonOf(c: Case, it: ChecklistItem): string {
  const r = getResult(c.items, it.id);
  if (!isBlank(r.memo)) return r.memo!.trim();
  if (r.quotes.length) return `「${r.quotes[0]}」`;
  if (r.urls.length) return `${it.red ?? ''}（${r.urls[0].url}）`;
  return it.red ?? '（理由メモなし）';
}

function todoOf(c: Case, it: ChecklistItem): string {
  const r = getResult(c.items, it.id);
  if (r.verdict === 'unchecked') return `未調査。${it.question}を確かめる`;
  return !isBlank(r.memo) ? `${it.question}（${r.memo!.trim()}）` : it.question;
}

export function latestListDate(c: Case, ctx: VerdictContext): string | undefined {
  let latest: string | undefined;
  for (const it of ctx.items.filter((x) => x.selfRequired)) {
    for (const u of getResult(c.items, it.id).urls) if (!latest || u.viewedAt > latest) latest = u.viewedAt;
  }
  return latest;
}

export function buildSheetData(c: Case, ctx: VerdictContext, opts: SheetOptions = {}): SheetData {
  const items = ctx.items;
  const counts = countVerdicts(items, c.items);
  const overall = overallVerdict(counts);
  const redItems = items.filter((it) => getResult(c.items, it.id).verdict === 'red');
  const yellows = yellowItems(items, c.items);
  const maxReds = ctx.rules.maxRedsOnSheet;
  const maxY = ctx.rules.maxYellowsOnSheet;
  const notes: string[] = [];
  if (c.stoppedEarly && counts.red >= 1) notes.push(`赤${counts.red}件の時点で打ち切り（残り${counts.unchecked}項目は未調査＝黄として数える）`);
  const reg = items.find((it) => it.id === ctx.rules.registryItem);
  if (reg && getResult(c.items, reg.id).verdict === 'na') notes.push('登記簿は未確認');
  if (c.review.status === 'skipped') notes.push(`見落としチェックは省略（${c.review.skipReason?.trim() || '理由未記入'}）`);
  const listDate = latestListDate(c, ctx);
  if (listDate) notes.push(`判定は${formatDate(listDate)}時点の一覧による`);
  const prov = items.filter((it) => getResult(c.items, it.id).provisional && getResult(c.items, it.id).verdict !== 'unchecked').length;
  if (prov > 0) notes.push(`AIの下調べからの「仮」の判定が${prov}件残っている（未確定）`);

  let paid: SheetData['paid'];
  if (c.alreadyPaid) {
    const p = c.alreadyPaid;
    const lines: string[] = [];
    lines.push(`追加では払わない：${p.stoppedPaying ? `${p.stoppedPaying} に決めた` : '（未記入）'}`);
    lines.push(`出金を試した：${p.withdrawalTest?.date ? `${p.withdrawalTest.date}／結果：${p.withdrawalTest.result ?? '（未記入）'}` : '（未記入）'}`);
    lines.push(`保存したやり取り：${p.savedEvidence?.trim() || '（未記入）'}`);
    lines.push(`相談した窓口：${p.consulted.length ? p.consulted.map((x) => `${x.where}（${x.date}）`).join('、') : '（未記入）'}`);
    lines.push(`銀行への連絡：${p.bankContacted?.trim() || '（未記入）'}`);
    paid = { lines };
  }

  return {
    caseName: c.card.caseName?.trim() || c.card.companyNames[0] || '（名前のない案件）',
    investigator: c.investigator,
    dateLabel: formatDate(c.createdAt),
    counts,
    overall,
    reds: redItems.slice(0, maxReds).map((it) => ({ id: it.id, question: it.question, text: reasonOf(c, it) })),
    redMore: Math.max(0, redItems.length - maxReds),
    yellows: yellows.slice(0, maxY).map((it) => ({ id: it.id, question: it.question, text: todoOf(c, it) })),
    yellowMore: Math.max(0, yellows.length - maxY),
    selfChecked: items.filter((it) => it.selfRequired).map((it) => ({ id: it.id, done: getResult(c.items, it.id).checkedBy === 'self' && getResult(c.items, it.id).verdict !== 'unchecked' })),
    conclusion: conclusionSentence(overall, yellows, ctx.rules.maxYellowsInConclusion),
    evidenceLocation: opts.evidenceFileName ?? '（まだ書き出していません。確定後に「ZIPで書き出す」を押すとファイル名が入ります）',
    notes,
    disclaimer: SHEET_DISCLAIMER,
    paid,
    version: opts.version,
    confirmedAt: opts.confirmedAt,
    confirmed: !!opts.confirmedAt,
    shareCaution: SHARE_CAUTION,
  };
}

const COLORS: Record<Overall, { fg: string; bg: string }> = {
  red: { fg: '#b3261e', bg: '#fbe9e7' },
  yellow: { fg: '#8a5a00', bg: '#fff3cd' },
  blue: { fg: '#0b5cad', bg: '#e3effc' },
};

export const SHEET_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #1c1c1a; }
  body { font-family: system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif; font-size: 13px; line-height: 1.45; }
  .sheet { width: 100%; max-width: 186mm; margin: 0 auto; padding: 10px 12px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { color: #444; font-size: 12px; margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: stretch; margin-bottom: 8px; }
  .counts { display: flex; gap: 6px; flex-wrap: wrap; }
  .count { border: 1px solid #999; border-radius: 6px; padding: 4px 8px; min-width: 64px; text-align: center; }
  .count b { display: block; font-size: 18px; }
  .overall { flex: 1; min-width: 150px; border: 2px solid; border-radius: 8px; padding: 6px 10px; display: flex; align-items: center; gap: 10px; }
  .overall .big { font-size: 30px; font-weight: 800; line-height: 1; }
  .overall .sub { font-size: 13px; font-weight: 700; }
  h2 { font-size: 13.5px; margin: 8px 0 3px; padding-bottom: 2px; border-bottom: 1px solid #bbb; }
  ol, ul { margin: 0; padding-left: 20px; }
  li { margin: 1px 0; }
  .id { font-weight: 700; margin-right: 4px; }
  .q { color: #333; }
  .muted { color: #666; }
  .conclusion { border: 1.5px solid #333; border-radius: 6px; padding: 7px 10px; font-size: 14.5px; font-weight: 700; margin-top: 6px; }
  .checks span { display: inline-block; margin-right: 12px; }
  .notes { font-size: 12px; }
  .disclaimer { font-size: 10.5px; color: #444; border-top: 1px solid #bbb; margin-top: 8px; padding-top: 5px; }
  .caution { font-size: 10.5px; color: #444; }
  .paid { border: 1px dashed #777; border-radius: 6px; padding: 5px 8px; font-size: 12px; }
  .tag { display: inline-block; font-size: 11px; border: 1px solid #777; border-radius: 4px; padding: 0 5px; margin-left: 6px; color: #333; }
  .break { word-break: break-all; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  @media print { body { font-size: 12px; } .sheet { max-width: none; padding: 0; } .no-print { display: none !important; } }
`;

export function renderSheetBody(d: SheetData): string {
  const col = COLORS[d.overall];
  const e = escapeHtml;
  const li = (rows: SheetRow[]) => rows.map((r) => `<li><span class="id">${e(r.id)}</span><span class="q">${e(r.question)}</span>：${e(r.text)}</li>`).join('');
  return `
<div class="sheet">
  <h1>うまい話チェック　判定の1枚${d.version ? `<span class="tag">第${d.version}版</span>` : '<span class="tag">未確定（下書き）</span>'}</h1>
  <div class="meta">
    <span>案件の名前：<b>${e(d.caseName)}</b></span>
    <span>調べた日：${e(d.dateLabel)}</span>
    ${d.investigator ? `<span>調べた人：${e(d.investigator)}</span>` : ''}
    ${d.confirmedAt ? `<span>確定：${e(formatDate(d.confirmedAt))}</span>` : ''}
  </div>
  <div class="row">
    <div class="counts">
      <div class="count" style="color:${COLORS.red.fg};background:${COLORS.red.bg}">赤<b>${d.counts.red}</b></div>
      <div class="count" style="color:${COLORS.yellow.fg};background:${COLORS.yellow.bg}">黄<b>${d.counts.yellow + d.counts.unchecked}</b><span class="muted">うち未調査 ${d.counts.unchecked}</span></div>
      <div class="count" style="color:${COLORS.blue.fg};background:${COLORS.blue.bg}">青<b>${d.counts.blue + d.counts.na}</b><span class="muted">うち該当なし ${d.counts.na}</span></div>
    </div>
    <div class="overall" style="color:${col.fg};border-color:${col.fg};background:${col.bg}">
      <div class="big">${VERDICT_ICON[d.overall]} ${VERDICT_LABEL[d.overall]}</div>
      <div class="sub">${d.overall === 'red' ? 'やめる' : d.overall === 'yellow' ? '確かめるまで払わない' : '大きな問題は見つからなかった（保証ではない）'}</div>
    </div>
  </div>
  <h2>赤になった項目と理由${d.redMore ? `（上から${d.reds.length}つ。ほか${d.redMore}件）` : ''}</h2>
  ${d.reds.length ? `<ol>${li(d.reds)}</ol>` : '<div class="muted">なし</div>'}
  <h2>黄になった項目と、払う前に確かめること${d.yellowMore ? `（ほか${d.yellowMore}件はチェック表を参照）` : ''}</h2>
  ${d.yellows.length ? `<ul>${li(d.yellows)}</ul>` : '<div class="muted">なし</div>'}
  <h2>自分の手で確かめた項目</h2>
  <div class="checks">${d.selfChecked.map((s) => `<span>${s.done ? '☑' : '☐'} ${e(s.id)}</span>`).join('')}</div>
  <div class="conclusion">${e(d.conclusion)}</div>
  <h2>証拠の置き場所</h2>
  <div class="break">${e(d.evidenceLocation)}</div>
  ${d.notes.length ? `<h2>注記</h2><ul class="notes">${d.notes.map((n) => `<li>${e(n)}</li>`).join('')}</ul>` : ''}
  ${d.paid ? `<h2>すでに払ってしまった場合の記録</h2><div class="paid">${d.paid.lines.map((l) => `<div>${e(l)}</div>`).join('')}</div>` : ''}
  <div class="disclaimer">${e(d.disclaimer)}</div>
  <div class="caution">${e(d.shareCaution)}</div>
</div>`;
}

export function renderSheetHtml(d: SheetData): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>判定の1枚 ${escapeHtml(d.caseName)}</title><style>${SHEET_CSS}</style></head><body>${renderSheetBody(d)}</body></html>`;
}
