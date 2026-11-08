import { describe, expect, it } from 'vitest';
import { quickCheck, looksLikePhone } from '../logic/quick';
import { normalizeOcrText } from '../logic/ocr';
import { keywords } from '../data/config';
import { getActiveItems } from '../data/checklist';
import demo from '../../demo/gold-ai-plan.json';
import type { Case } from '../types';
import { NOW } from './helpers';

const items = getActiveItems();

describe('ぱっとチェック', () => {
  it('貼った文章から、気になる言葉が短い言い方で出る', () => {
    const r = quickCheck({ text: '月利8%、元本保証です。家族には内緒で。出金のときは手数料を先に。', query: '' }, [], keywords, items, NOW);
    expect(r.level).toBe('red');
    expect(r.hits.map((h) => h.label)).toEqual(expect.arrayContaining(['もうかる約束', 'ないしょにさせる', '出すのに先払い']));
    expect(r.hits[0].suggest).toBe('red');
    expect(r.actions).toEqual([]);
  });
  it('何もなければ none（安全の意味ではない）', () => {
    expect(quickCheck({ text: '明日の予定を教えて', query: '' }, [], keywords, items, NOW).level).toBe('none');
  });
  it('会社名を入れると、国の登録・警告・評判の3つのボタンと、過去の案件との一致が出る', () => {
    const r = quickCheck({ text: '', query: 'ミライ架空キャピタル' }, [demo as unknown as Case], keywords, items, NOW);
    expect(r.actions.map((a) => a.key)).toEqual(['fsa', 'warn', 'web']);
    expect(r.actions[0].copy).toBe('ミライ架空キャピタル');
    expect(r.past.length).toBeGreaterThan(0);
    expect(r.past[0].caseName).toBe('ゴールドAIプラン');
  });
  it('電話番号なら番号検索だけ', () => {
    expect(looksLikePhone('03-0000-0000')).toBe(true);
    expect(looksLikePhone('ミライ')).toBe(false);
    const r = quickCheck({ text: '', query: '03-0000-0000' }, [demo as unknown as Case], keywords, items, NOW);
    expect(r.actions.map((a) => a.key)).toEqual(['phone:03-0000-0000']);
    expect(r.past.some((m) => m.field === '電話番号')).toBe(true);
  });
});

describe('OCRの文章のそろえ方', () => {
  it('行の途中の改行と日本語の間の空白を詰める', () => {
    const t = normalizeOcrText('月利8%、元本保証で\nす。\n\n家族に話すと反対される\nから。\n振込先: 架空 銀行');
    expect(t).toBe('月利8%、元本保証です。\n家族に話すと反対されるから。\n振込先: 架空銀行');
  });
});

describe('複数の言葉・案件名', () => {
  it('案件名でも記録が見つかる', () => {
    const r = quickCheck({ text: '', query: 'ゴールドAI' }, [demo as unknown as Case], keywords, items, NOW);
    expect(r.past.some((m) => m.otherField === '案件名')).toBe(true);
  });
  it('空白で区切った複数の言葉は、すべて含む記録だけ。電話番号は番号検索に', () => {
    const ok = quickCheck({ text: '', query: 'ゴールド ミライ 03-0000-0000' }, [demo as unknown as Case], keywords, items, NOW);
    expect(ok.past.length).toBeGreaterThan(0);
    expect(ok.actions.map((a) => a.key)).toEqual(['fsa', 'warn', 'web', 'phone:03-0000-0000']);
    expect(ok.actions[0].copies).toEqual(['ゴールド', 'ミライ']);
    expect(ok.draft.card.companyNames).toEqual(['ゴールド', 'ミライ']);
    const ng = quickCheck({ text: '', query: 'ゴールド 別の会社' }, [demo as unknown as Case], keywords, items, NOW);
    expect(ng.past).toEqual([]);
  });
});
