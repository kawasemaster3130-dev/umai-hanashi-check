// EA（FXの自動売買ソフト）の話のときの4つの見分け：高いEA／IB目的／ナンピン・マーチン／最初のお金
import eaRaw from '../../config/ea.json';
import type { SimpleCard, SimpleLine, Tone } from './simple';

export interface EaAnswerDef { key: string; label: string; tone: 'red' | 'yellow' | 'blue'; result: string }
export interface EaQuestion { id: string; text: string; words: string[]; answers: EaAnswerDef[] }
export interface EaConfig { detect: string[]; questions: EaQuestion[]; always: string }
export const eaConfig = eaRaw as unknown as EaConfig;
export type EaAnswers = Record<string, string>;

/** 貼った文章や名前が、EAの話らしいか */
export function looksLikeEa(text: string): boolean {
  const t = text.normalize('NFKC').toUpperCase();
  return eaConfig.detect.some((w) => t.includes(w.normalize('NFKC').toUpperCase()));
}

/** 質問ごとに、貼った文章の中の関係する言葉を拾う */
export function eaWordHits(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!text.trim()) return out;
  const t = text.normalize('NFKC');
  for (const q of eaConfig.questions) {
    const found: string[] = [];
    for (const w of q.words) {
      const i = t.toUpperCase().indexOf(w.normalize('NFKC').toUpperCase());
      if (i < 0) continue;
      const s = Math.max(0, i - 14);
      const e = Math.min(t.length, i + w.length + 14);
      const quote = `${s > 0 ? '…' : ''}${t.slice(s, e).replace(/\s+/g, ' ').trim()}${e < t.length ? '…' : ''}`;
      if (!found.includes(quote)) found.push(quote);
      if (found.length >= 2) break;
    }
    if (found.length) out[q.id] = found;
  }
  return out;
}

export function buildEaCard(answers: EaAnswers, registered: boolean): SimpleCard {
  const lines: SimpleLine[] = [];
  let tone: Tone = 'none';
  let reds = 0;
  let answered = 0;
  for (const q of eaConfig.questions) {
    const a = q.answers.find((x) => x.key === answers[q.id]);
    if (!a) continue;
    answered += 1;
    lines.push({ text: a.result, mark: a.tone === 'blue' ? undefined : a.tone });
    if (a.tone === 'red') reds += 1;
    if (a.tone === 'red') tone = 'red';
    else if (a.tone === 'yellow' && tone !== 'red') tone = 'yellow';
    else if (a.tone === 'blue' && tone === 'none') tone = 'blue';
  }
  if (answered && !registered) lines.push({ text: `${eaConfig.always}この名前の登録は見つかっていません。`, mark: 'yellow' });
  else if (answered) lines.push({ text: eaConfig.always });
  const headline = !answered ? '上の4つに答えると、ここに出ます' : reds >= 2 ? `あぶない点が${reds}つあります` : reds === 1 ? 'あぶない点が1つあります' : tone === 'yellow' ? '確かめることがあります' : '4つの点では、問題は見つかりませんでした';
  return { key: 'ea', label: 'EA（自動売買）', tone, headline, lines };
}

/** 判定の1枚の注記に出す文 */
export function eaNotes(answers: EaAnswers | undefined): string[] {
  if (!answers) return [];
  const out: string[] = [];
  for (const q of eaConfig.questions) {
    const a = q.answers.find((x) => x.key === answers[q.id]);
    if (a && a.tone === 'red') out.push(`EA：${q.text} → ${a.label}`);
  }
  return out;
}
