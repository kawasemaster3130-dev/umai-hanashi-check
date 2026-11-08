import { describe, expect, it } from 'vitest';
import demo from '../../demo/gold-ai-plan.json';
import type { Case } from '../types';
import { makeCtx } from './helpers';
import { confirmBlockers, countVerdicts, overallVerdict } from '../logic/verdict';
import { buildSheetData, renderSheetHtml } from '../logic/sheet';
import { findForbidden } from '../logic/forbidden';

const c = demo as unknown as Case;
const ctx = makeCtx(c.previousNames);

describe('12.1 原本の通しの例（ゴールドAIプラン）', () => {
  it('原本に書かれている判定が入っている', () => {
    const reds = ['1-1', '1-2', '1-3', '4-4', '5-1', '6-2', '7-1', '7-3', '7-4', '7-5', '9-2'];
    const yellows = ['4-2', '6-1', '6-3', '8-1', '9-1', '9-4', '9-6'];
    const blues = ['2-1', '3-1', '3-2', '3-3', '3-4', '4-1'];
    for (const id of reds) expect(c.items[id].verdict, id).toBe('red');
    for (const id of yellows) expect(c.items[id].verdict, id).toBe('yellow');
    for (const id of blues) expect(c.items[id].verdict, id).toBe('blue');
    expect(Object.keys(c.items)).toHaveLength(41);
  });
  it('全体判定は赤、赤の上位3つ、結論の1文', () => {
    const counts = countVerdicts(ctx.items, c.items);
    expect(counts.red).toBe(11);
    expect(overallVerdict(counts)).toBe('red');
    const d = buildSheetData(c, ctx);
    expect(d.overall).toBe('red');
    expect(d.reds.map((r) => r.id)).toEqual(['1-1', '1-2', '1-3']);
    expect(d.redMore).toBe(8);
    expect(d.conclusion).toBe('赤が1つ以上あるので、払いません。');
    expect(d.selfChecked).toEqual([
      { id: '1-1', done: true },
      { id: '1-2', done: true },
      { id: '1-3', done: true },
      { id: '2-1', done: true },
    ]);
    expect(d.notes).toContain('登記簿は未確認');
  });
  it('該当なしには理由が書いてある', () => {
    for (const [id, r] of Object.entries(c.items)) if (r.verdict === 'na') expect(r.naReason, id).toBeTruthy();
  });
  it('デモは確定できる（4.4の条件をすべて満たす）', () => {
    expect(confirmBlockers(c, ctx)).toEqual([]);
  });
  it('判定の1枚のHTMLに断定する文言がない', () => {
    const html = renderSheetHtml(buildSheetData(c, ctx, { evidenceFileName: 'ゴールドAIプラン_2026-10-15.zip' }));
    expect(findForbidden(html)).toEqual([]);
    expect(html).toContain('赤が1つ以上あるので、払いません。');
    expect(html).toContain('ゴールドAIプラン_2026-10-15.zip');
  });
});
