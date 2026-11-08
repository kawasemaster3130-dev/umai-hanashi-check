import { describe, expect, it } from 'vitest';
import { makeCtx, allBlueCase, res, NOW } from './helpers';
import { canStopEarly, conclusionSentence, confirmBlockers, countVerdicts, overallVerdict, previousNameProgress, validateResult, validateVerdictChange, yellowItems } from '../logic/verdict';
import { findItem } from '../data/checklist';

describe('4.2 全体の判定', () => {
  const ctx = makeCtx();
  it('赤1つ＋ほか青 → 赤', () => {
    const c = allBlueCase(ctx);
    c.items['7-3'] = res('red', { quotes: ['元本保証'] });
    const counts = countVerdicts(ctx.items, c.items);
    expect(counts.red).toBe(1);
    expect(overallVerdict(counts)).toBe('red');
  });
  it('赤0・未調査1・ほか青 → 黄', () => {
    const c = allBlueCase(ctx);
    c.items['6-3'] = res('unchecked');
    const counts = countVerdicts(ctx.items, c.items);
    expect(counts.unchecked).toBe(1);
    expect(overallVerdict(counts)).toBe('yellow');
  });
  it('青と該当なしだけ → 青', () => {
    const c = allBlueCase(ctx);
    c.items['1-4'] = res('na', { naReason: '国内の会社' });
    c.items['4-3'] = res('na', { naReason: '有料のため未確認' });
    const counts = countVerdicts(ctx.items, c.items);
    expect(counts.na).toBe(2);
    expect(overallVerdict(counts)).toBe('blue');
  });
  it('41項目を数える', () => {
    const c = allBlueCase(ctx);
    const counts = countVerdicts(ctx.items, c.items);
    expect(counts.red + counts.yellow + counts.blue + counts.na + counts.unchecked).toBe(41);
  });
});

describe('4.3 入力チェック', () => {
  const ctx = makeCtx();
  it('1-1が「自分」でない → 確定できない', () => {
    const c = allBlueCase(ctx);
    c.items['1-1'] = res('blue', { checkedBy: 'ai', urls: [{ url: 'https://search.fsa.go.jp/', viewedAt: NOW }] });
    const b = confirmBlockers(c, ctx);
    expect(b.some((x) => x.code === 'self_required' && x.itemId === '1-1')).toBe(true);
  });
  it('1-1が証拠なし → 確定できない', () => {
    const c = allBlueCase(ctx);
    c.items['1-1'] = res('blue', { checkedBy: 'self' });
    const b = confirmBlockers(c, ctx);
    expect(b.some((x) => x.code === 'self_needs_evidence' && x.itemId === '1-1')).toBe(true);
  });
  it('赤には証拠が要る', () => {
    const item = findItem(ctx.items, '7-3')!;
    expect(validateVerdictChange(item, res('unchecked'), 'red', ctx).map((p) => p.code)).toContain('red_needs_evidence');
    expect(validateVerdictChange(item, res('unchecked', { quotes: ['月利8%'] }), 'red', ctx)).toHaveLength(0);
  });
  it('5-1を手がかり1つで赤にしようとすると止まる', () => {
    const item = findItem(ctx.items, '5-1')!;
    const one = res('unchecked', { urls: [{ url: 'https://example.com/news', viewedAt: NOW }], identityMatches: ['company'] });
    const p = validateVerdictChange(item, one, 'red', ctx);
    expect(p.map((x) => x.code)).toContain('identity_needs_two');
    const two = { ...one, identityMatches: ['company', 'place'] as const };
    expect(validateVerdictChange(item, { ...two, identityMatches: [...two.identityMatches] }, 'red', ctx)).toHaveLength(0);
  });
  it('該当なしには理由が要り、naAllowed の項目だけ選べる', () => {
    const ok = findItem(ctx.items, '1-4')!;
    expect(validateVerdictChange(ok, res('unchecked'), 'na', ctx).map((p) => p.code)).toEqual(['na_needs_reason']);
    expect(validateVerdictChange(ok, res('unchecked'), 'na', ctx, { naReason: '国内の会社' })).toHaveLength(0);
    const ng = findItem(ctx.items, '1-1')!;
    expect(validateVerdictChange(ng, res('unchecked'), 'na', ctx, { naReason: 'x' }).map((p) => p.code)).toEqual(['na_not_allowed']);
  });
  it('前の名前が登録済みで2-1の前の名前確認が未完 → 4-4を青にできない', () => {
    const ctx2 = makeCtx(['合同会社ネクスト架空トレード']);
    const c = allBlueCase(ctx2);
    for (const id of ctx2.rules.previousNameRecheck.rangeItems) c.items[id].previousNameChecked = { 合同会社ネクスト架空トレード: true };
    c.items['2-1'].previousNameChecked = {};
    const item = findItem(ctx2.items, '4-4')!;
    const p = validateVerdictChange(item, res('unchecked'), 'blue', ctx2, {}, c.items);
    expect(p.map((x) => x.code)).toContain('prev_name_unchecked');
    expect(previousNameProgress(c.items, ctx2).missing).toEqual([{ itemId: '2-1', name: '合同会社ネクスト架空トレード' }]);
    c.items['2-1'].previousNameChecked = { 合同会社ネクスト架空トレード: true };
    expect(validateVerdictChange(item, res('unchecked'), 'blue', ctx2, {}, c.items)).toHaveLength(0);
  });
  it('前の名前がなければ4-4は青にできる', () => {
    const item = findItem(ctx.items, '4-4')!;
    expect(validateVerdictChange(item, res('unchecked'), 'blue', ctx, {}, {})).toHaveLength(0);
  });
  it('赤にしたあとで証拠を消すと、確定前の点検で拾う', () => {
    const item = findItem(ctx.items, '7-3')!;
    const r = res('red');
    expect(validateResult(item, r, ctx, {}).map((p) => p.code)).toContain('red_needs_evidence');
  });
});

describe('4.4 確定できる条件 / 赤で打ち切る', () => {
  const ctx = makeCtx();
  it('条件を満たす案件はブロッカーなし', () => {
    expect(confirmBlockers(allBlueCase(ctx), ctx)).toEqual([]);
  });
  it('未調査が残っていると確定できない', () => {
    const c = allBlueCase(ctx);
    c.items['8-1'] = res('unchecked');
    expect(confirmBlockers(c, ctx).some((b) => b.code === 'unchecked' && b.itemId === '8-1')).toBe(true);
  });
  it('赤がないと「赤で打ち切る」は押せない', () => {
    const c = allBlueCase(ctx);
    expect(canStopEarly(countVerdicts(ctx.items, c.items))).toBe(false);
    c.stoppedEarly = true;
    c.items['8-1'] = res('unchecked');
    const b = confirmBlockers(c, ctx);
    expect(b.some((x) => x.code === 'stop_without_red')).toBe(true);
    expect(b.some((x) => x.code === 'unchecked')).toBe(true);
  });
  it('赤があれば打ち切れて、残りの未調査は黄として数える', () => {
    const c = allBlueCase(ctx);
    c.items['7-3'] = res('red', { quotes: ['元本保証'] });
    c.items['8-1'] = res('unchecked');
    c.items['8-2'] = res('unchecked');
    c.stoppedEarly = true;
    expect(canStopEarly(countVerdicts(ctx.items, c.items))).toBe(true);
    expect(confirmBlockers(c, ctx)).toEqual([]);
    expect(overallVerdict(countVerdicts(ctx.items, c.items))).toBe('red');
    expect(yellowItems(ctx.items, c.items).map((i) => i.id)).toEqual(['8-1', '8-2']);
  });
  it('仮の判定が残っていると確定できない', () => {
    const c = allBlueCase(ctx);
    c.items['3-1'] = res('blue', { provisional: true, checkedBy: 'ai' });
    expect(confirmBlockers(c, ctx).some((b) => b.code === 'provisional' && b.itemId === '3-1')).toBe(true);
  });
  it('見落としチェックが未実施／理由なし省略だと確定できない', () => {
    const c = allBlueCase(ctx);
    c.review = { status: 'pending', flaggedCategories: [], findings: [] };
    expect(confirmBlockers(c, ctx).some((b) => b.code === 'review_pending')).toBe(true);
    c.review = { status: 'skipped', flaggedCategories: [], findings: [] };
    expect(confirmBlockers(c, ctx).some((b) => b.code === 'skip_needs_reason')).toBe(true);
    c.review = { status: 'skipped', skipReason: '検索できるAIがない', flaggedCategories: [], findings: [] };
    expect(confirmBlockers(c, ctx)).toEqual([]);
  });
  it('指摘を受けた分類は全項目「見直し済み」が要る', () => {
    const c = allBlueCase(ctx);
    c.review = { status: 'done', flaggedCategories: [2], findings: [{ id: '2-1', type: 'no_url', comment: '' }] };
    const b = confirmBlockers(c, ctx).filter((x) => x.code === 'needs_review');
    expect(b.map((x) => x.itemId)).toEqual(['2-1', '2-2', '2-3', '2-4', '2-5']);
    for (const id of ['2-1', '2-2', '2-3', '2-4', '2-5']) c.items[id].reviewed = true;
    expect(confirmBlockers(c, ctx)).toEqual([]);
  });
});

describe('4.5 結論の1文', () => {
  const ctx = makeCtx();
  it('赤', () => expect(conclusionSentence('red', [])).toBe('赤が1つ以上あるので、払いません。'));
  it('黄は最大5つ', () => {
    const ys = ctx.items.slice(0, 7);
    const s = conclusionSentence('yellow', ys, 5);
    expect(s.startsWith('確かめ終わるまで払いません。確かめること：1-1 ')).toBe(true);
    expect(s).toContain('（ほか2件）');
  });
  it('青', () => expect(conclusionSentence('blue', [])).toContain('安全の保証ではありません'));
});

describe('追加項目', () => {
  it('X-1〜X-4 を有効にすると項目が増え、ロジックがそのまま動く', () => {
    const ctx = makeCtx([], ['X-1', 'X-3']);
    expect(ctx.items).toHaveLength(43);
    const c = allBlueCase(ctx);
    expect(confirmBlockers(c, ctx)).toEqual([]);
    c.items['X-3'] = res('unchecked');
    expect(overallVerdict(countVerdicts(ctx.items, c.items))).toBe('yellow');
  });
});
