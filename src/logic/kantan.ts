// かんたん版：質問への答えを、チェック表の項目の判定に写す
import kantanRaw from '../../config/kantan.json';
import type { Case, KantanAnswer, Overall, Verdict } from '../types';
import { emptyItemResult } from '../types';

export interface KantanQuestion {
  id: string;
  itemId: string;
  text: string;
  sub?: string;
  type?: 'registry';
  yes?: 'red' | 'yellow';
  no?: 'blue';
  linkKey?: string;
}
export interface KantanConfig {
  questions: KantanQuestion[];
  results: Record<Overall, { title: string; body: string }>;
}
export const kantan = kantanRaw as KantanConfig;

export function answerToVerdict(q: KantanQuestion, a: KantanAnswer | undefined): Verdict {
  if (!a) return 'unchecked';
  if (q.type === 'registry') return a === 'listed' ? 'blue' : a === 'not_listed' ? 'red' : 'yellow';
  if (a === 'yes') return q.yes ?? 'yellow';
  if (a === 'no') return q.no ?? 'blue';
  return 'yellow';
}

export const ANSWER_LABEL: Record<KantanAnswer, string> = {
  yes: 'はい',
  no: 'いいえ',
  unknown: 'わからない',
  listed: '載っていた',
  not_listed: '載っていなかった',
  not_yet: 'まだ見ていない',
};

/** 聞いた質問だけで全体を決める（聞いていない項目は数えない） */
export function kantanOverall(answers: Record<string, KantanAnswer>): { overall: Overall; reds: KantanQuestion[]; yellows: KantanQuestion[]; answered: number } {
  const reds: KantanQuestion[] = [];
  const yellows: KantanQuestion[] = [];
  let answered = 0;
  for (const q of kantan.questions) {
    const a = answers[q.id];
    if (!a) continue;
    answered += 1;
    const v = answerToVerdict(q, a);
    if (v === 'red') reds.push(q);
    else if (v === 'yellow') yellows.push(q);
  }
  return { overall: reds.length ? 'red' : yellows.length ? 'yellow' : 'blue', reds, yellows, answered };
}

/** 答えを案件のチェック表に書き込む（くわしく調べるときに続きから使える） */
export function applyKantanToCase(c: Case, fsaUrl: string, now: string): void {
  const answers = c.kantan?.answers ?? {};
  for (const q of kantan.questions) {
    const a = answers[q.id];
    const cur = c.items[q.itemId] ?? emptyItemResult();
    if (!a) {
      if (cur.memo?.startsWith('かんたん版')) c.items[q.itemId] = { ...cur, verdict: 'unchecked', provisional: false, quotes: cur.quotes.filter((x) => !x.startsWith('かんたん版')), memo: undefined };
      continue;
    }
    const v = answerToVerdict(q, a);
    const quote = `かんたん版の答え：「${q.text}」→ ${ANSWER_LABEL[a]}`;
    const quotes = [...cur.quotes.filter((x) => !x.startsWith('かんたん版')), ...(v === 'red' ? [quote] : [])];
    const urls = q.type === 'registry' && (a === 'listed' || a === 'not_listed') && !cur.urls.some((u) => u.url === fsaUrl) ? [...cur.urls, { url: fsaUrl, viewedAt: now }] : cur.urls;
    c.items[q.itemId] = { ...cur, verdict: v, provisional: false, checkedBy: 'self', quotes, urls, memo: `かんたん版：${ANSWER_LABEL[a]}`, updatedAt: now };
  }
}
