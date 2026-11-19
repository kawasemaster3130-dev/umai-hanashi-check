// 話の種類（EA・コピートレード・仮想通貨）ごとの見分け。質問にボタンで答えると、赤字・黄色マーカーのカードになる
import topicsRaw from '../../config/topics.json';
import type { SimpleCard, SimpleLine, Tone } from './simple';

export interface TopicAnswerDef { key: string; label: string; tone: 'red' | 'yellow' | 'blue'; result: string }
export interface TopicQuestion { id: string; text: string; words: string[]; answers: TopicAnswerDef[] }
export interface TopicDef { id: string; label: string; detect: string[]; always: string; questions: TopicQuestion[] }
export const topics = (topicsRaw as unknown as { topics: TopicDef[] }).topics;
/** 種類ごとの答え：{ ea: { price: 'high' }, crypto: { rate: 'm10' } } */
export type TopicAnswers = Record<string, Record<string, string>>;

const up = (s: string) => s.normalize('NFKC').toUpperCase();

/** 文章や名前から、話の種類を見つける */
export function detectTopics(text: string): string[] {
  const t = up(text);
  return topics.filter((tp) => tp.detect.some((w) => (/^[A-Z0-9]{2,4}$/.test(up(w)) ? new RegExp(`(^|[^A-Z0-9])${up(w)}([^A-Z0-9]|$)`).test(t) : t.includes(up(w))))).map((tp) => tp.id);
}

/** 質問ごとに、貼った文章の中の関係する言葉を拾う */
export function topicWordHits(topic: TopicDef, text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!text.trim()) return out;
  const t = text.normalize('NFKC');
  const T = t.toUpperCase();
  for (const q of topic.questions) {
    const found: string[] = [];
    for (const w of q.words) {
      const i = T.indexOf(up(w));
      if (i < 0) continue;
      const s = Math.max(0, i - 14);
      const e = Math.min(t.length, i + w.length + 14);
      const quote = `${s > 0 ? '…' : ''}${t.slice(s, e).replace(/\s+/g, ' ').trim()}${e < t.length ? '…' : ''}`;
      if (!found.some((f) => f.includes(quote) || quote.includes(f))) found.push(quote);
      if (found.length >= 2) break;
    }
    if (found.length) out[q.id] = found;
  }
  return out;
}

export function buildTopicCard(topic: TopicDef, answers: Record<string, string>, registered: boolean): SimpleCard {
  const lines: SimpleLine[] = [];
  let tone: Tone = 'none';
  let reds = 0;
  let answered = 0;
  for (const q of topic.questions) {
    const a = q.answers.find((x) => x.key === answers[q.id]);
    if (!a) continue;
    answered += 1;
    lines.push({ text: a.result, mark: a.tone === 'blue' ? undefined : a.tone });
    if (a.tone === 'red') {
      reds += 1;
      tone = 'red';
    } else if (a.tone === 'yellow' && tone !== 'red') tone = 'yellow';
    else if (a.tone === 'blue' && tone === 'none') tone = 'blue';
  }
  if (answered && !registered) lines.push({ text: `${topic.always}この名前の登録は見つかっていません。`, mark: 'yellow' });
  else if (answered) lines.push({ text: topic.always });
  const headline = !answered ? '上の質問に答えると、ここに出ます' : reds >= 1 ? `あぶない点が${reds}つあります` : tone === 'yellow' ? '確かめることがあります' : '聞いた点では、問題は見つかりませんでした';
  return { key: 'topic', label: topic.label, tone, headline, lines };
}

/** 判定の1枚の注記に出す文（赤の答えだけ） */
export function topicNotes(all: TopicAnswers | undefined): string[] {
  if (!all) return [];
  const out: string[] = [];
  for (const tp of topics) {
    for (const q of tp.questions) {
      const a = q.answers.find((x) => x.key === all[tp.id]?.[q.id]);
      if (a && a.tone === 'red') out.push(`${tp.label}：${q.text} → ${a.label}`);
    }
  }
  return out;
}
