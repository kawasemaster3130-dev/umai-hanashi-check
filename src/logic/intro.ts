// 最初の5つの質問（投資歴・商品・収支・投資に回せるお金・目標）。全部に答えるとチェックに進める
import type { IntroAnswers } from '../types';

export const INTRO_YEARS = [
  ['none', 'まだない'],
  ['lt1', '1年未満'],
  ['1to3', '1〜3年'],
  ['3to5', '3〜5年'],
  ['5to10', '5〜10年'],
  ['10plus', '10年以上'],
] as const;

export const INTRO_PRODUCTS = [
  ['fx', 'FX'],
  ['stock', '株'],
  ['crypto', '仮想通貨'],
  ['nisa', 'NISA'],
  ['fund', '投資信託'],
  ['ideco', 'iDeCo'],
  ['ea', '自動売買（EA）'],
  ['copy', 'コピートレード'],
  ['other', 'その他'],
  ['none', 'まだない'],
] as const;

export const INTRO_PNL = [
  ['plus', 'プラス', 'もうかっている'],
  ['minus', 'マイナス', '損をしている'],
  ['zero', 'ほぼ0', 'とんとん'],
  ['none', 'まだしていない', ''],
] as const;

export const INTRO_GOAL_YEARS = [1, 3, 5, 10, 20] as const;

export const INTRO_TITLES = ['投資歴', '投資したことがある商品', 'トータル収支', '投資に回せるお金（投資余剰金）', '今後の目標'] as const;

/** 「１２０」「1,200」「3.5」などを数に。読めなければ undefined */
export function parseAmount(s?: string): number | undefined {
  if (s === undefined) return undefined;
  let t = s.normalize('NFKC').replace(/[,\s]/g, '');
  // 「1200000円」のように円で書いたときは万円に直す
  const yen = /\d円$/.test(t);
  t = t.replace(/万円?$|円$/, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return yen ? n / 10000 : n;
}

/** 万円の数を読みやすく：12000 → 1億2,000万円 */
export function formatMan(man: number): string {
  const r = Math.round(man * 100) / 100;
  if (r >= 10000) {
    const oku = Math.floor(r / 10000);
    const rest = Math.round((r - oku * 10000) * 100) / 100;
    return `${oku.toLocaleString('ja-JP')}億${rest ? `${rest.toLocaleString('ja-JP')}万` : ''}円`;
  }
  return `${r.toLocaleString('ja-JP')}万円`;
}

/** 万円 → 円（入力の下に「＝ 1,200,000円」と出す） */
export const manToYen = (man: number): string => `${Math.round(man * 10000).toLocaleString('ja-JP')}円`;

/** まだ答えていない質問の番号（1〜5） */
export function missingIntro(a: IntroAnswers | undefined): number[] {
  const x = a ?? {};
  const miss: number[] = [];
  if (!x.years) miss.push(1);
  const products = x.products ?? [];
  if (!products.length || (products.includes('other') && !x.productsOther?.trim())) miss.push(2);
  const pnl = parseAmount(x.pnlMan);
  if (!x.pnlSign || ((x.pnlSign === 'plus' || x.pnlSign === 'minus') && !(pnl !== undefined && pnl > 0))) miss.push(3);
  if (parseAmount(x.surplusMan) === undefined) miss.push(4);
  const gy = parseAmount(x.goalYears);
  if (!(gy !== undefined && gy > 0) || !x.goalText?.trim()) miss.push(5);
  return miss;
}

export const introDone = (a: IntroAnswers | undefined): boolean => !!a?.answeredAt && missingIntro(a).length === 0;

const label = <T extends readonly (readonly string[])[]>(list: T, k?: string): string => list.find((x) => x[0] === k)?.[1] ?? '';

/** 運営者のシート・設定画面に出す言葉 */
export function introSummary(a: IntroAnswers | undefined): { years: string; products: string; pnl: string; surplus: string; goalYears: string; goalText: string } {
  const x = a ?? {};
  const products = INTRO_PRODUCTS.filter(([k]) => (x.products ?? []).includes(k)).map(([k, l]) => (k === 'other' && x.productsOther?.trim() ? `その他：${x.productsOther.trim().slice(0, 100)}` : l));
  const pnlN = parseAmount(x.pnlMan);
  const pnl = x.pnlSign === 'plus' && pnlN !== undefined ? `＋${formatMan(pnlN)}` : x.pnlSign === 'minus' && pnlN !== undefined ? `－${formatMan(pnlN)}` : x.pnlSign === 'zero' ? 'ほぼ0（とんとん）' : x.pnlSign === 'none' ? 'まだしていない' : '';
  const surplusN = parseAmount(x.surplusMan);
  const gy = parseAmount(x.goalYears);
  return {
    years: label(INTRO_YEARS, x.years),
    products: products.join('、'),
    pnl,
    surplus: surplusN === undefined ? '' : formatMan(surplusN),
    goalYears: gy === undefined ? '' : `${gy}年後`,
    goalText: (x.goalText ?? '').trim().slice(0, 500),
  };
}

/** 投資歴を「まだない」にしたら、商品と収支も「まだ」にそろえる */
export function applyYears(a: IntroAnswers, years: string): IntroAnswers {
  if (years !== 'none') return { ...a, years };
  return { ...a, years, products: ['none'], productsOther: '', pnlSign: 'none', pnlMan: '' };
}

/** 商品を押したとき。「まだない」はほかと同時に選べない */
export function toggleProduct(a: IntroAnswers, k: string): IntroAnswers {
  const cur = a.products ?? [];
  const on = cur.includes(k);
  const next = on ? cur.filter((x) => x !== k) : k === 'none' ? ['none'] : [...cur.filter((x) => x !== 'none'), k];
  return { ...a, products: next, productsOther: next.includes('other') ? a.productsOther : '' };
}
