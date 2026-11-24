// 利用者の結果を運営者に送る（受け取り口のURLがあるときだけ。貼った文章・スクショ・メモは送らない）
import collectRaw from '../../config/collect.json';
import type { QuickResult } from './quick';
import type { SimpleReport } from './simple';
import { topics, type TopicAnswers } from './topics';
import { nowIso, uuid } from './util';
import { seller } from '../data/config';
import { introSummary } from './intro';
import type { IntroAnswers } from '../types';

export const collectConfig = collectRaw as { url: string; operator: string };
export const COLLECT_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
export const collectEnabled = (): boolean => COLLECT_URL_RE.test(collectConfig.url.trim());

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
  // 最初の5つの質問（同じ人の結果の行にも付ける）
  introYears: string;
  introProducts: string;
  introPnl: string;
  introSurplus: string;
  introGoal: string;
}

/** 最初の5つの質問の答え（シートの「最初の5問」のタブに、端末ごとに1行） */
export interface IntroPayload {
  app: 'umai-hanashi-check';
  kind: 'intro';
  version: string;
  device: string;
  answeredAt: string;
  years: string;
  products: string;
  pnl: string;
  surplus: string;
  goalYears: string;
  goalText: string;
}

export function buildIntroPayload(a: IntroAnswers): IntroPayload {
  const s = introSummary(a);
  return { app: 'umai-hanashi-check', kind: 'intro', version: seller.appVersion, device: deviceId(), answeredAt: a.answeredAt ?? nowIso(), years: s.years, products: s.products, pnl: s.pnl, surplus: s.surplus, goalYears: s.goalYears, goalText: s.goalText };
}

function introColumns(a: IntroAnswers | undefined): Pick<CollectPayload, 'introYears' | 'introProducts' | 'introPnl' | 'introSurplus' | 'introGoal'> {
  const s = introSummary(a);
  return { introYears: s.years, introProducts: s.products, introPnl: s.pnl, introSurplus: s.surplus, introGoal: [s.goalYears, s.goalText].filter(Boolean).join('：') };
}

export function buildPayload(runId: string, checkedAt: string, query: string, r: QuickResult, rep: SimpleReport, activity: keyof typeof ACT, picked: string[], ans: TopicAnswers, intro?: IntroAnswers): CollectPayload {
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
    ...introColumns(intro),
  };
}

/** 送る（失敗しても利用者には何もしない） */
export function sendPayload(p: CollectPayload | IntroPayload): void {
  if (!collectEnabled()) return;
  try {
    void fetch(collectConfig.url.trim(), { method: 'POST', mode: 'no-cors', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p), keepalive: true }).catch(() => undefined);
  } catch {
    // 送れない環境では何もしない
  }
}

export const newRunId = (): string => uuid();
