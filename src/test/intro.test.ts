import { describe, expect, it } from 'vitest';
import { applyYears, formatMan, introDone, introSummary, missingIntro, parseAmount, toggleProduct } from '../logic/intro';
import { buildIntroPayload, buildPayload } from '../logic/collect';
import { buildSimpleReport } from '../logic/simple';
import { quickCheck } from '../logic/quick';
import { keywords } from '../data/config';
import { getActiveItems } from '../data/checklist';
import type { IntroAnswers } from '../types';
import { NOW } from './helpers';

const full: IntroAnswers = { years: '1to3', products: ['fx', 'stock'], pnlSign: 'minus', pnlMan: '50', surplusMan: '100', goalYears: '10', goalText: '資産を2,000万円にしたい' };

describe('最初の5つの質問', () => {
  it('何も答えていなければ5問とも未回答。全部答えると進める', () => {
    expect(missingIntro(undefined)).toEqual([1, 2, 3, 4, 5]);
    expect(missingIntro(full)).toEqual([]);
    expect(introDone(full)).toBe(false); // 「答えて、次へ進む」を押すまでは進めない
    expect(introDone({ ...full, answeredAt: NOW })).toBe(true);
  });
  it('プラス・マイナスを選んだら金額が要る。その他を選んだら名前が要る', () => {
    expect(missingIntro({ ...full, pnlMan: '' })).toEqual([3]);
    expect(missingIntro({ ...full, pnlMan: '0' })).toEqual([3]);
    expect(missingIntro({ ...full, pnlSign: 'zero', pnlMan: '' })).toEqual([]);
    expect(missingIntro({ ...full, products: ['other'] })).toEqual([2]);
    expect(missingIntro({ ...full, products: ['other'], productsOther: '金' })).toEqual([]);
  });
  it('投資に回せるお金は0でもよい。目標は年数と中身の両方が要る', () => {
    expect(missingIntro({ ...full, surplusMan: '0' })).toEqual([]);
    expect(missingIntro({ ...full, surplusMan: 'たくさん' })).toEqual([4]);
    expect(missingIntro({ ...full, goalText: '  ' })).toEqual([5]);
    expect(missingIntro({ ...full, goalYears: '0' })).toEqual([5]);
  });
  it('金額は全角・カンマ・円でも読める', () => {
    expect(parseAmount('１２０')).toBe(120);
    expect(parseAmount('1,200')).toBe(1200);
    expect(parseAmount('3.5万円')).toBe(3.5);
    expect(parseAmount('1200000円')).toBe(120);
    expect(parseAmount('')).toBeUndefined();
    expect(formatMan(12000)).toBe('1億2,000万円');
    expect(formatMan(50)).toBe('50万円');
  });
  it('投資歴が「まだない」なら、商品と収支も「まだ」にそろう。「まだない」はほかと一緒に選べない', () => {
    const a = applyYears({}, 'none');
    expect(a.products).toEqual(['none']);
    expect(a.pnlSign).toBe('none');
    expect(toggleProduct({ products: ['none'] }, 'fx').products).toEqual(['fx']);
    expect(toggleProduct({ products: ['fx', 'stock'] }, 'none').products).toEqual(['none']);
  });
  it('運営者に送る言葉', () => {
    const s = introSummary({ ...full, products: ['fx', 'other'], productsOther: '金' });
    expect(s).toMatchObject({ years: '1〜3年', products: 'FX、その他：金', pnl: '－50万円', surplus: '100万円', goalYears: '10年後' });
    const p = buildIntroPayload({ ...full, answeredAt: NOW });
    expect(p.kind).toBe('intro');
    expect(p.answeredAt).toBe(NOW);
    expect(p.pnl).toBe('－50万円');
    expect(p).not.toHaveProperty('runId'); // 古い受け取り口は、この送り物を結果の行にしない
  });
  it('結果の行にも同じ人の5問の答えが付く', () => {
    const items = getActiveItems();
    const r = quickCheck({ text: '', query: 'テスト' }, [], keywords, items, NOW, undefined);
    const p = buildPayload('run1', NOW, 'テスト', r, buildSimpleReport(r, 'unknown'), 'unknown', [], {}, full);
    expect(p.introYears).toBe('1〜3年');
    expect(p.introProducts).toBe('FX、株');
    expect(p.introGoal).toBe('10年後：資産を2,000万円にしたい');
    const none = buildPayload('run2', NOW, 'テスト', r, buildSimpleReport(r, 'unknown'), 'unknown', [], {});
    expect(none.introYears).toBe('');
  });
});
