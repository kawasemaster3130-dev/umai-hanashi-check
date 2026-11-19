// 利回りの数字（月利・日利・年利）を拾って、年にした数字で線引きする
import topicsRaw from '../../config/topics.json';

export interface RateHit { quote: string; label: string; percent: number; annual: number; tone: 'red' | 'yellow' | 'none' }
const RATES = (topicsRaw as unknown as { rates: { yellowAnnual: number; redAnnual: number } }).rates;
const UNIT: [RegExp, number, string][] = [
  [/日利|日次|1日/, 365, '日'],
  [/週利|週次/, 52, '週'],
  [/月利|月次|月間|毎月|月に|月/, 12, '月'],
  [/年利|年率|年間|APY|APR|年に|年/, 1, '年'],
];

export function rateTone(annual: number): RateHit['tone'] {
  return annual >= RATES.redAnnual ? 'red' : annual >= RATES.yellowAnnual ? 'yellow' : 'none';
}

/** 文章の中の「月利8%」「年利20％」「日利1%」「APY 300%」を拾う */
export function findRates(text: string): RateHit[] {
  const t = text.normalize('NFKC');
  const out: RateHit[] = [];
  const re = /(日利|週利|月利|年利|年率|APY|APR|月次|月間|年間|毎月|月に|年に)[^\d%]{0,6}(\d+(?:\.\d+)?)\s*(?:%|パーセント)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const unit = UNIT.find(([r]) => r.test(m![1].toUpperCase()) || r.test(m![1]));
    if (!unit) continue;
    const percent = Number(m[2]);
    const annual = Math.round(percent * unit[1]);
    const label = unit[2] === '年' ? `年に${percent}%` : `${unit[2]}に${percent}%（年にすると約${annual}%）`;
    if (!out.some((x) => x.label === label)) out.push({ quote: m[0], label, percent, annual, tone: rateTone(annual) });
  }
  return out;
}

export const RATE_LIMITS = RATES;
