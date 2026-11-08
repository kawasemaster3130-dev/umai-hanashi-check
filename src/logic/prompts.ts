// 仕様書 7章 AIへの依頼文（テンプレートは prompts/ に分け、{{key}} を差し込む）
import step1 from '../../prompts/step1_card.md?raw';
import step2 from '../../prompts/step2_research.md?raw';
import step6 from '../../prompts/step6_review.md?raw';
import type { Case, ChecklistItem, MaskWord } from '../types';
import { VERDICT_LABEL } from '../types';
import type { LinksConfig } from '../data/config';
import { getResult } from './verdict';
import { isBlank } from './util';

export const NOT_WRITTEN = '（書かれていない）';

/** 伏せる言葉を置き換える（長い言葉から先に） */
export function applyMask(text: string, maskWords: MaskWord[]): string {
  let out = text;
  const sorted = [...maskWords].filter((m) => !isBlank(m.word)).sort((a, b) => b.word.length - a.word.length);
  for (const m of sorted) {
    const label = isBlank(m.label) ? '【伏せ字】' : m.label;
    out = out.split(m.word).join(label);
  }
  return out;
}

export function fillTemplate(tpl: string, vars: Record<string, string | undefined>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = vars[k];
    return isBlank(v) ? NOT_WRITTEN : (v as string);
  });
}

const joinOr = (arr: string[] | undefined): string | undefined => (arr && arr.length ? arr.join('、') : undefined);

export function cardVars(c: Case): Record<string, string | undefined> {
  const k = c.card;
  const intro = [k.introducer?.name, k.introducer?.snsNames?.length ? `SNS：${k.introducer.snsNames.join('、')}` : undefined, k.introducer?.relation ? `関係：${k.introducer.relation}` : undefined]
    .filter(Boolean)
    .join('／');
  const payee = [k.payee?.accountName ? `名義：${k.payee.accountName}` : undefined, k.payee?.bank ? `銀行：${k.payee.bank}` : undefined, k.payee?.cryptoAddresses?.length ? `暗号資産：${k.payee.cryptoAddresses.join('、')}` : undefined]
    .filter(Boolean)
    .join('／');
  const recv = [k.receivedAt?.date, k.receivedAt?.channel].filter(Boolean).join('／');
  return {
    caseName: k.caseName,
    companyNames: joinOr(k.companyNames),
    claimedRegistrationNo: k.claimedRegistrationNo,
    companyAddress: k.companyAddress,
    companyPhone: k.companyPhone,
    representative: k.representative,
    introducer: intro || undefined,
    urls: joinOr(k.urls),
    payee: payee || undefined,
    amount: k.amount,
    promisedReturn: k.promisedReturn,
    withdrawal: k.withdrawal,
    receivedAt: recv || undefined,
    deadline: k.deadline,
    celebrities: k.celebrities,
    previousNames: joinOr(c.previousNames),
    notablePhrases: joinOr(k.notablePhrases),
  };
}

/** 7.1 案件カードを作る */
export function buildCardPrompt(c: Case): string {
  const body = fillTemplate(step1, { messages: c.rawMessages || '（ここに勧誘のやり取りを貼ってください）' });
  return applyMask(body, c.maskWords);
}

export function itemListText(items: ChecklistItem[]): string {
  return items.map((it) => `   ${it.id} ${it.question}`).join('\n');
}

/** 7.2 AI下調べ */
export function buildResearchPrompt(c: Case, items: ChecklistItem[], links: LinksConfig): string {
  const linkList = links.links
    .filter((l) => l.official !== false)
    .map((l) => `- ${l.name}：${l.url}`)
    .join('\n');
  const body = fillTemplate(step2, {
    ...cardVars(c),
    itemList: itemListText(items),
    itemCount: String(items.length),
    linkList,
    linksAsOf: links.asOf,
  });
  return applyMask(body, c.maskWords);
}

/** チェック表を文字の表にする（見落としチェックに貼る／書き出しにも使う） */
export function sheetTableText(c: Case, items: ChecklistItem[]): string {
  const lines = ['番号 | 確かめること | 判定 | 確認した人 | 結果メモ | 見たURL'];
  for (const it of items) {
    const r = getResult(c.items, it.id);
    const by = r.checkedBy === 'self' ? '自分' : r.checkedBy === 'ai' ? 'AI下調べ' : '—';
    const v = `${VERDICT_LABEL[r.verdict]}${r.provisional ? '（仮）' : ''}${r.verdict === 'na' && r.naReason ? `（理由：${r.naReason}）` : ''}`;
    const memo = (r.memo ?? '').replace(/\s+/g, ' ');
    const urls = r.urls.map((u) => u.url).join(' ');
    lines.push(`${it.id} | ${it.question} | ${v} | ${by} | ${memo || '—'} | ${urls || '—'}`);
  }
  return lines.join('\n');
}

/** 7.3 見落としチェック */
export function buildReviewPrompt(c: Case, items: ChecklistItem[]): string {
  const body = fillTemplate(step6, {
    ...cardVars(c),
    sheetTable: sheetTableText(c, items),
    researchRaw: c.aiResearchRaw || '（AIの下調べは使っていません。チェック表だけを見てください）',
  });
  return applyMask(body, c.maskWords);
}

/** 依頼文に、自分の個人情報らしきものが残っていないかの軽い点検（確認を促すだけ） */
export function personalInfoWarnings(text: string): string[] {
  const out: string[] = [];
  if (/\d{2,4}-\d{2,4}-\d{3,4}/.test(text.normalize('NFKC'))) out.push('電話番号のような数字があります。自分の番号なら伏せてください（相手の番号は調べるのに要るので残します）。');
  if (/(普通|当座)\s*[0-9]{6,8}/.test(text.normalize('NFKC'))) out.push('口座番号のような数字があります。自分の口座なら伏せてください。');
  if (/[都道府県].{1,8}[市区町村].{0,12}\d+-\d+/.test(text.normalize('NFKC'))) out.push('住所のような文字列があります。自分の住所なら伏せてください。');
  return out;
}
