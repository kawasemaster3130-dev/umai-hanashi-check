// 利用者の結果を運営者に送る（同意した人だけ。貼った文章・スクショ・メモは送らない）
import collectRaw from '../../config/collect.json';
import type { QuickResult } from './quick';
import type { SimpleReport } from './simple';
import { topics, type TopicAnswers } from './topics';
import { uuid } from './util';
import { seller } from '../data/config';

export const collectConfig = collectRaw as { url: string; operator: string };
export const COLLECT_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
export const collectEnabled = (): boolean => COLLECT_URL_RE.test(collectConfig.url.trim());

/** 送る内容の説明（同意の画面・設定の画面で同じ文を使う） */
export const COLLECT_SENDS = ['調べた言葉（会社名・商品名・人の名前・電話番号）', '結果（赤・黄・青）と、国の登録・警告で見つかった名前', '話の種類と、質問への答え', '調べた日時と、端末ごとの番号（あなたの名前ではありません）'];
export const COLLECT_NOT_SENT = ['貼った文章・スクショ', '記録のメモ・見たページ', 'あなたの名前・電話・住所'];

const WORD = { red: 'あぶない', yellow: '気をつける', blue: '問題なし', none: '—' } as const;
const ACT = { advise: '教えるだけ', manage: 'お金を預かる', unknown: 'わからない' } as const;

export function deviceId(): string {
  try {
    let id = localStorage.getItem('uhc-device');
    if (!id) {
      id = uuid().slice(0, 8);
      localStorage.setItem('uhc-device', id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

export interface CollectPayload {
  app: 'umai-hanashi-check';
  version: string;
  runId: string;
  device: string;
  checkedAt: string;
  query: string;
  overall: string;
  register: string;
  warning: string;
  doing: string;
  history: string;
  activity: string;
  topics: string;
  topicReds: string;
  registered: string;
  warned: string;
  hits: string;
}

export function buildPayload(runId: string, checkedAt: string, query: string, r: QuickResult, rep: SimpleReport, activity: keyof typeof ACT, picked: string[], ans: TopicAnswers): CollectPayload {
  const tone = (k: string) => WORD[rep.cards.find((c) => c.key === k)?.tone ?? 'none'];
  const reds: string[] = [];
  for (const t of topics.filter((x) => picked.includes(x.id))) {
    for (const q of t.questions) {
      const a = q.answers.find((x) => x.key === ans[t.id]?.[q.id]);
      if (a && a.tone !== 'blue') reds.push(`${t.label}／${q.text} → ${a.label}`);
    }
  }
  return {
    app: 'umai-hanashi-check',
    version: seller.appVersion,
    runId,
    device: deviceId(),
    checkedAt,
    query: query.trim().slice(0, 300),
    overall: WORD[rep.overall],
    register: tone('register'),
    warning: tone('warning'),
    doing: tone('doing'),
    history: tone('history'),
    activity: ACT[activity],
    topics: topics.filter((t) => picked.includes(t.id)).map((t) => t.label).join('、'),
    topicReds: reds.join('\n'),
    registered: r.registry.registered.map((e) => `${e.name}（${e.no}）`).join('\n'),
    warned: r.registry.warned.map((w) => `${w.name}（${w.when ?? ''}）`).join('\n'),
    hits: r.hits.map((h) => h.label).join('、'),
  };
}

/** 送る（失敗しても利用者には何もしない） */
export function sendPayload(p: CollectPayload): void {
  if (!collectEnabled()) return;
  try {
    void fetch(collectConfig.url.trim(), { method: 'POST', mode: 'no-cors', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p), keepalive: true }).catch(() => undefined);
  } catch {
    // 送れない環境では何もしない
  }
}

export const newRunId = (): string => uuid();
