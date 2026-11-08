import { describe, expect, it } from 'vitest';
import { answerToVerdict, applyKantanToCase, kantan, kantanOverall } from '../logic/kantan';
import { newCase } from '../types';
import { NOW, makeCtx } from './helpers';
import { countVerdicts, overallVerdict } from '../logic/verdict';
import { getActiveItems } from '../data/checklist';

describe('かんたん版', () => {
  it('質問の項目IDはすべてチェック表にある', () => {
    const ids = new Set(getActiveItems().map((i) => i.id));
    for (const q of kantan.questions) expect(ids.has(q.itemId), q.id).toBe(true);
    expect(kantan.questions).toHaveLength(10);
  });
  it('はい→赤/黄、いいえ→青、わからない→黄。登記の質問は3択', () => {
    const q1 = kantan.questions[0];
    expect(answerToVerdict(q1, 'yes')).toBe('red');
    expect(answerToVerdict(q1, 'no')).toBe('blue');
    expect(answerToVerdict(q1, 'unknown')).toBe('yellow');
    const reg = kantan.questions.find((q) => q.type === 'registry')!;
    expect(answerToVerdict(reg, 'listed')).toBe('blue');
    expect(answerToVerdict(reg, 'not_listed')).toBe('red');
    expect(answerToVerdict(reg, 'not_yet')).toBe('yellow');
    expect(answerToVerdict(reg, undefined)).toBe('unchecked');
  });
  it('聞いた質問だけで全体を決める', () => {
    expect(kantanOverall({}).overall).toBe('blue');
    expect(kantanOverall({ k1: 'no', k7: 'yes' }).overall).toBe('yellow');
    expect(kantanOverall({ k1: 'yes', k7: 'no' }).overall).toBe('red');
    expect(kantanOverall({ k1: 'no', k2: 'no', k10: 'listed' }).overall).toBe('blue');
  });
  it('答えをチェック表に写すと、赤には引用（証拠）が付き、1-1は自分＋URL', () => {
    const c = newCase('k', NOW);
    c.kantan = { answers: { k1: 'yes', k2: 'no', k10: 'not_listed' } };
    applyKantanToCase(c, 'https://search.fsa.go.jp/', NOW);
    expect(c.items['7-3'].verdict).toBe('red');
    expect(c.items['7-3'].quotes.length).toBe(1);
    expect(c.items['9-2'].verdict).toBe('blue');
    expect(c.items['1-1'].verdict).toBe('red');
    expect(c.items['1-1'].checkedBy).toBe('self');
    expect(c.items['1-1'].urls[0].url).toBe('https://search.fsa.go.jp/');
    const ctx = makeCtx();
    expect(overallVerdict(countVerdicts(ctx.items, c.items))).toBe('red');
    // 答えを消すと元に戻る
    c.kantan = { answers: { k2: 'no' } };
    applyKantanToCase(c, 'https://search.fsa.go.jp/', NOW);
    expect(c.items['7-3'].verdict).toBe('unchecked');
    expect(c.items['7-3'].quotes).toEqual([]);
  });
});
