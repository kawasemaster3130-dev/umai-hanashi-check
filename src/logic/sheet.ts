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
  red: { fg: '#b2321c', bg: '#f6e3dc' },
  yellow: { fg: '#8a6100', bg: '#f3e6bd' },
  blue: { fg: '#1f4b78', bg: '#dde7f1' },
};

export const SHEET_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;700;800&family=BIZ+UDPGothic:wght@400;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #23211f; }
  body { font-family: "BIZ UDPGothic", "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", Meiryo, sans-serif; font-size: 12.5px; line-height: 1.45; }
  .mincho, h1, h2 { font-family: "Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif; }
  .mono { font-family: "IBM Plex Mono", "Courier New", monospace; }
  .sheet { width: 100%; max-width: 186mm; margin: 0 auto; padding: 8px 10px; border: 1px solid #23211f; outline: 1px solid #23211f; outline-offset: 3px; background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; border-bottom: 3px double #23211f; padding-bottom: 6px; }
  h1 { font-size: 19px; margin: 0; letter-spacing: 0.12em; font-weight: 800; }
  h1 small { font-size: 10px; letter-spacing: 0.3em; display: block; color: #4a4641; font-weight: 400; margin-bottom: 2px; }
  .tag { display: inline-block; font-size: 10px; border: 1px solid #23211f; padding: 1px 6px; letter-spacing: 0.1em; font-family: inherit; }
  table.meta { border-collapse: collapse; width: 100%; margin: 6px 0; }
  table.meta th, table.meta td { border: 1px solid #b9aa93; padding: 3px 6px; font-size: 11.5px; text-align: left; }
  table.meta th { background: #ebe4d4; width: 5.5em; font-weight: 700; white-space: nowrap; }
  .row { display: flex; gap: 10px; align-items: stretch; margin: 6px 0; }
  table.counts { border-collapse: collapse; flex: 1; }
  table.counts th, table.counts td { border: 1px solid #23211f; text-align: center; padding: 3px 4px; }
  table.counts th { font-size: 11px; background: #ebe4d4; letter-spacing: 0.1em; }
  table.counts td { font-size: 22px; font-family: "IBM Plex Mono", monospace; font-weight: 600; }
  table.counts td small { display: block; font-size: 9.5px; font-family: inherit; font-weight: 400; color: #4a4641; }
  .overall { width: 150px; border: 2px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; }
  .overall .lbl { font-size: 9.5px; letter-spacing: 0.4em; }
  .seal { width: 58px; height: 58px; border: 3px solid currentColor; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 800; transform: rotate(-7deg); margin: 2px 0; }
  .overall .word { font-size: 15px; font-weight: 800; letter-spacing: 0.1em; }
  .overall .sub { font-size: 9.5px; text-align: center; }
  h2 { font-size: 12.5px; margin: 7px 0 2px; padding: 1px 0 1px 8px; border-left: 4px solid #b2321c; letter-spacing: 0.08em; }
  ol, ul { margin: 0; padding-left: 0; list-style: none; }
  li { margin: 0; padding: 2px 0 2px 2.6em; text-indent: -2.6em; border-bottom: 1px dotted #b9aa93; }
  .id { display: inline-block; width: 2.4em; text-indent: 0; font-family: "IBM Plex Mono", monospace; font-weight: 600; }
  .q { font-weight: 700; }
  .muted { color: #7a746b; }
  .conclusion { border: 2px solid #23211f; padding: 7px 10px; font-size: 14px; font-weight: 800; margin-top: 8px; letter-spacing: 0.04em; }
  .checks span { display: inline-block; margin-right: 14px; font-family: "IBM Plex Mono", monospace; }
  .notes li { padding-left: 1em; text-indent: -1em; }
  .notes li::before { content: "※ "; }
  .disclaimer { font-size: 10px; color: #4a4641; border-top: 1px solid #23211f; margin-top: 8px; padding-top: 4px; }
  .caution { font-size: 10px; color: #4a4641; }
  .paid { border: 1px dashed #23211f; padding: 4px 8px; font-size: 11.5px; }
  .break { word-break: break-all; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  @media print { body { font-size: 11.5px; } .sheet { max-width: none; } .no-print { display: none !important; } }
`;

export function renderSheetBody(d: SheetData): string {
  const col = COLORS[d.overall];
  const e = escapeHtml;
  const li = (rows: SheetRow[]) => rows.map((r) => `<li><span class="id">${e(r.id)}</span><span class="q">${e(r.question)}</span>：${e(r.text)}</li>`).join('');
  const seal: Record<Overall, string> = { red: '止', yellow: '待', blue: '可' };
  return `
<div class="sheet">
  <div class="head">
    <h1><small>投資の話の点検　うまい話チェック</small>判定票</h1>
    <span class="tag">${d.version ? `第${d.version}版` : '未確定（下書き）'}</span>
  </div>
  <table class="meta"><tbody>
    <tr><th>件名</th><td><b>${e(d.caseName)}</b></td><th>調べた日</th><td>${e(d.dateLabel)}</td></tr>
    <tr><th>調べた人</th><td>${d.investigator ? e(d.investigator) : '—'}</td><th>確定</th><td>${d.confirmedAt ? e(formatDate(d.confirmedAt)) : '—'}</td></tr>
  </tbody></table>
  <div class="row">
    <table class="counts"><tbody>
      <tr><th style="color:${COLORS.red.fg}">✕ 赤</th><th style="color:${COLORS.yellow.fg}">△ 黄</th><th style="color:${COLORS.blue.fg}">○ 青</th></tr>
      <tr>
        <td style="color:${COLORS.red.fg}">${d.counts.red}<small>やめる理由</small></td>
        <td style="color:${COLORS.yellow.fg}">${d.counts.yellow + d.counts.unchecked}<small>うち未調査 ${d.counts.unchecked}</small></td>
        <td style="color:${COLORS.blue.fg}">${d.counts.blue + d.counts.na}<small>うち該当なし ${d.counts.na}</small></td>
      </tr>
    </tbody></table>
    <div class="overall" style="color:${col.fg};background:${col.bg}">
      <span class="lbl">総合判定</span>
      <span class="seal mincho">${seal[d.overall]}</span>
      <span class="word mincho">${VERDICT_ICON[d.overall]} ${VERDICT_LABEL[d.overall]}</span>
      <span class="sub">${d.overall === 'red' ? 'やめる' : d.overall === 'yellow' ? '確かめるまで払わない' : '大きな問題は見つからなかった（保証ではない）'}</span>
    </div>
  </div>
  <h2>赤になった項目と理由${d.redMore ? `（上から${d.reds.length}つ。ほか${d.redMore}件）` : ''}</h2>
  ${d.reds.length ? `<ol>${li(d.reds)}</ol>` : '<div class="muted">なし</div>'}
  <h2>黄になった項目と、払う前に確かめること${d.yellowMore ? `（ほか${d.yellowMore}件はチェック表を参照）` : ''}</h2>
  ${d.yellows.length ? `<ul>${li(d.yellows)}</ul>` : '<div class="muted">なし</div>'}
  <h2>自分の手で確かめた項目</h2>
  <div class="checks">${d.selfChecked.map((s) => `<span>${s.done ? '☑' : '☐'} ${e(s.id)}</span>`).join('')}</div>
  <div class="conclusion mincho">${e(d.conclusion)}</div>
  <h2>証拠の置き場所</h2>
  <div class="break mono">${e(d.evidenceLocation)}</div>
  ${d.notes.length ? `<h2>注記</h2><ul class="notes">${d.notes.map((n) => `<li>${e(n)}</li>`).join('')}</ul>` : ''}
  ${d.paid ? `<h2>すでに払ってしまった場合の記録</h2><div class="paid">${d.paid.lines.map((l) => `<div>${e(l)}</div>`).join('')}</div>` : ''}
  <div class="disclaimer">${e(d.disclaimer)}</div>
  <div class="caution">${e(d.shareCaution)}</div>
</div>`;
}

export function renderSheetHtml(d: SheetData): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>判定の1枚 ${escapeHtml(d.caseName)}</title><style>${SHEET_CSS}</style></head><body>${renderSheetBody(d)}</body></html>`;
}
