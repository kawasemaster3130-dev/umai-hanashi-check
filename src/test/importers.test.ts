import { describe, expect, it } from 'vitest';
import { getActiveItems } from '../data/checklist';
import { applyResearchImport, applyReviewImport, extractJson, mergeCard, parseAiResearch, parseCardJson, parseReviewJson } from '../logic/importers';
import { newCase } from '../types';
import { NOW, res } from './helpers';

const items = getActiveItems();

function fullAnswer(overrides: Record<string, Partial<{ status: string; verdict: string; urls: string[]; result: string; naReason: string | null }>> = {}, drop: string[] = []) {
  const rows = items
    .filter((it) => !drop.includes(it.id))
    .map((it) => ({ id: it.id, status: 'not_found', result: '載っていなかった', urls: ['https://example.com/list'], verdict: 'blue', naReason: null, ...overrides[it.id] }));
  return `下調べの結果です。\n\n（表）\n\n「この結果はAIの下調べです。登録の有無は、金融庁の一覧を自分で開いて確かめてください。」\n\n\`\`\`json\n${JSON.stringify({ items: rows, overall: 'blue', selfCheck: ['金融庁の一覧を自分で開く'] }, null, 1)}\n\`\`\`\n`;
}

describe('JSONの取り出し', () => {
  it('```json の囲みから読む（最後のかたまりを優先）', () => {
    const r = extractJson('前置き ```json {"a":1} ``` 説明 ```json {"a":2} ```');
    expect(r.ok && r.value).toEqual({ a: 2 });
  });
  it('囲みがなくても { } から読む', () => {
    const r = extractJson('結果: {"items": []} 以上');
    expect(r.ok && r.value).toEqual({ items: [] });
  });
  it('末尾カンマを直して読む', () => {
    const r = extractJson('```json\n{"items": [{"id": "1-1",},],}\n```');
    expect(r.ok).toBe(true);
  });
  it('壊れたJSONは落ちずにエラー', () => {
    const r = extractJson('```json\n{"items": [ {"id": \n```');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('手で写す');
    expect(extractJson('').ok).toBe(false);
    expect(extractJson('JSONはありません').ok).toBe(false);
  });
});

describe('7.2 AI下調べの取り込み', () => {
  it('41行そろった答えを全部「仮」で取り込む', () => {
    const imp = parseAiResearch(fullAnswer(), items, NOW);
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(Object.keys(imp.results)).toHaveLength(41);
    expect(imp.missing).toEqual([]);
    const c = newCase('i1', NOW);
    const { applied, kept } = applyResearchImport(c, imp, items, NOW);
    expect(applied).toBe(41);
    expect(kept).toBe(0);
    expect(c.items['3-1'].provisional).toBe(true);
    expect(c.items['3-1'].checkedBy).toBe('ai');
    expect(c.items['3-1'].verdict).toBe('blue');
    expect(c.items['3-1'].urls[0].url).toBe('https://example.com/list');
    // 1-1 などはAIが青でも「自分で確認してください」の印
    expect(imp.results['1-1'].ai.warnings.some((w) => w.includes('自分で'))).toBe(true);
  });
  it('could_not_check は判定にかかわらず黄', () => {
    const imp = parseAiResearch(fullAnswer({ '3-2': { status: 'could_not_check', verdict: 'blue' } }), items, NOW);
    expect(imp.ok && imp.results['3-2'].ai.verdict).toBe('yellow');
  });
  it('found でURLが空なら取り込むが「URLなし」の警告つきで黄', () => {
    const imp = parseAiResearch(fullAnswer({ '2-1': { status: 'found', verdict: 'red', urls: [], result: '警告一覧に載っていた' } }), items, NOW);
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(imp.results['2-1'].ai.verdict).toBe('yellow');
    expect(imp.results['2-1'].ai.warnings.some((w) => w.includes('URLなし'))).toBe(true);
    expect(imp.warnings.some((w) => w.itemId === '2-1' && w.message.includes('URLなし'))).toBe(true);
  });
  it('41行に足りないJSONでも落ちず、足りない項目は未調査のまま', () => {
    const imp = parseAiResearch(fullAnswer({}, ['8-1', '8-2', '9-6']), items, NOW);
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(imp.missing).toEqual(['8-1', '8-2', '9-6']);
    const c = newCase('i2', NOW);
    applyResearchImport(c, imp, items, NOW);
    expect(c.items['8-1']).toBeUndefined();
    expect(imp.warnings.some((w) => w.message.includes('3 項目がありません'))).toBe(true);
  });
  it('壊れたJSONは ok:false', () => {
    const imp = parseAiResearch('```json\n{"items": [ {"id": "1-1", ', items, NOW);
    expect(imp.ok).toBe(false);
  });
  it('該当なしは naAllowed の項目だけ。それ以外は黄', () => {
    const imp = parseAiResearch(fullAnswer({ '1-4': { status: 'na', verdict: 'na', naReason: '国内の会社' }, '1-1': { status: 'na', verdict: 'na', naReason: 'x' } }), items, NOW);
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(imp.results['1-4'].ai.verdict).toBe('na');
    expect(imp.results['1-1'].ai.verdict).toBe('yellow');
  });
  it('知らない項目ID・読めない判定・日本語の判定', () => {
    const imp = parseAiResearch(fullAnswer({ '5-4': { verdict: '赤', status: 'found' }, '6-1': { verdict: 'purple' } }) + '', items, NOW);
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(imp.results['5-4'].ai.verdict).toBe('red');
    expect(imp.results['6-1'].ai.verdict).toBe('yellow');
    const imp2 = parseAiResearch('```json\n{"items":[{"id":"99-9","status":"found","verdict":"red","urls":["https://x"]}]}\n```', items, NOW);
    expect(imp2.ok && imp2.warnings.some((w) => w.itemId === '99-9')).toBe(true);
  });
  it('利用者が自分で確定した項目は上書きしない（AIの結果は ai 欄に残す）', () => {
    const c = newCase('i3', NOW);
    c.items['1-1'] = res('red', { checkedBy: 'self', urls: [{ url: 'https://search.fsa.go.jp/', viewedAt: NOW }] });
    const imp = parseAiResearch(fullAnswer({ '1-1': { verdict: 'blue', status: 'found' } }), items, NOW);
    if (!imp.ok) throw new Error('parse failed');
    const { kept } = applyResearchImport(c, imp, items, NOW);
    expect(kept).toBe(1);
    expect(c.items['1-1'].verdict).toBe('red');
    expect(c.items['1-1'].provisional).toBe(false);
    expect(c.items['1-1'].ai?.verdict).toBe('blue');
  });
  it('AIの赤でもURLがなければ仮判定は黄', () => {
    const c = newCase('i4', NOW);
    const imp = parseAiResearch(fullAnswer({ '7-3': { verdict: 'red', status: 'not_found', urls: [] } }), items, NOW);
    if (!imp.ok) throw new Error('parse failed');
    applyResearchImport(c, imp, items, NOW);
    expect(c.items['7-3'].verdict).toBe('yellow');
  });
});

describe('7.1 案件カードの取り込み', () => {
  it('null は空欄、配列は配列、「書かれていない」は空欄', () => {
    const txt = '```json\n' + JSON.stringify({ caseName: 'ゴールドAIプラン', companyNames: ['A社', 'A Inc.'], claimedRegistrationNo: null, representative: '書かれていない', introducer: { name: 'ユウキ', snsNames: ['yuki'], relation: null }, urls: ['https://a.example/'], payee: { accountName: 'ヤマダ', bank: null, cryptoAddresses: [] }, celebrities: 'なし', notablePhrases: ['a', 'b', 'c', 'd'] }) + '\n```';
    const r = parseCardJson(txt);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.card.caseName).toBe('ゴールドAIプラン');
    expect(r.card.representative).toBeUndefined();
    expect(r.card.celebrities).toBeUndefined();
    expect(r.card.notablePhrases).toHaveLength(3);
    const merged = mergeCard({ companyNames: ['A社'], urls: [], notablePhrases: [], caseName: '手で入れた名前' }, r.card);
    expect(merged.caseName).toBe('手で入れた名前');
    expect(merged.companyNames).toEqual(['A社', 'A Inc.']);
    expect(merged.introducer?.snsNames).toEqual(['yuki']);
  });
  it('壊れていれば ok:false', () => {
    expect(parseCardJson('{').ok).toBe(false);
  });
});

describe('7.3 見落としチェックの取り込み', () => {
  it('指摘のあった分類の全項目に「見直し」の印が付く', () => {
    const c = newCase('r1', NOW);
    const r = parseReviewJson('```json\n{"findings":[{"id":"2-1","type":"not_found_as_safe","comment":"前の名前で確認したか"},{"id":"9-9","type":"no_url","comment":"x"}]}\n```', items);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.findings).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
    applyReviewImport(c, r.findings, items, NOW);
    expect(c.review.status).toBe('done');
    expect(c.review.flaggedCategories).toEqual([2]);
    for (const id of ['2-1', '2-2', '2-3', '2-4', '2-5']) expect(c.items[id].reviewed).toBe(false);
    expect(c.items['3-1']).toBeUndefined();
  });
  it('指摘なし', () => {
    const c = newCase('r2', NOW);
    const r = parseReviewJson('```json\n{"findings":[]}\n```', items);
    if (!r.ok) throw new Error('parse failed');
    applyReviewImport(c, r.findings, items, NOW);
    expect(c.review.flaggedCategories).toEqual([]);
  });
});
