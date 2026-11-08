import { describe, expect, it } from 'vitest';
import { applyMask, buildCardPrompt, buildResearchPrompt, buildReviewPrompt, fillTemplate, personalInfoWarnings, sheetTableText } from '../logic/prompts';
import { links } from '../data/config';
import { getActiveItems } from '../data/checklist';
import demo from '../../demo/gold-ai-plan.json';
import type { Case } from '../types';
import { buildSearchLines } from '../logic/search';
import { findCrossMatches, searchCases } from '../logic/crossref';
import { newCase } from '../types';
import { NOW } from './helpers';

const c = demo as unknown as Case;
const items = getActiveItems();

describe('7章 依頼文', () => {
  it('伏せる言葉が置き換わる（長い言葉から先に）', () => {
    expect(applyMask('山田花子さんと山田さん', [{ word: '山田', label: '【姓】' }, { word: '山田花子', label: '【自分の名前】' }])).toBe('【自分の名前】さんと【姓】さん');
    expect(applyMask('abc', [{ word: '', label: 'x' }])).toBe('abc');
  });
  it('空の差し込みは（書かれていない）', () => {
    expect(fillTemplate('a={{a}} b={{b}}', { a: 'x' })).toBe('a=x b=（書かれていない）');
  });
  it('案件カードの依頼文にはやり取りが入り、自分の名前は伏せられる', () => {
    const p = buildCardPrompt(c);
    expect(p).toContain('【自分の名前】さん、こんにちは');
    expect(p).not.toContain('山田花子');
    expect(p).toContain('"caseName": null');
  });
  it('下調べの依頼文には41項目のIDと公式リンクが入る', () => {
    const p = buildResearchPrompt(c, items, links);
    for (const it of items) expect(p).toContain(`${it.id} ${it.question}`);
    expect(p).toContain('https://www.fsa.go.jp/menkyo/menkyo.html');
    expect(p).toContain('次の41個');
    expect(p).toContain('合同会社ネクスト架空トレード');
    expect(p).not.toContain('{{');
  });
  it('見落としチェックの依頼文にはチェック表の表が入る', () => {
    const p = buildReviewPrompt(c, items);
    expect(p).toContain('1-1 | 会社が金融庁の一覧に載っているか');
    expect(p).toContain('赤 |');
    expect(sheetTableText(c, items).split('\n')).toHaveLength(42);
  });
  it('個人情報らしきものの注意', () => {
    expect(personalInfoWarnings('電話は 090-1234-5678 です').length).toBe(1);
    expect(personalInfoWarnings('こんにちは').length).toBe(0);
  });
});

describe('S3 検索の言葉', () => {
  it('案件カードの値で埋め、空の行は出さない。会社名は全部の名前で行を作る', () => {
    const lines = buildSearchLines(c);
    expect(lines.filter((l) => l.label === '代表者の名前')).toHaveLength(4);
    expect(lines.filter((l) => l.label === '会社の名前')).toHaveLength(6);
    expect(lines.some((l) => l.query === '"合同会社ネクスト架空トレード" 詐欺')).toBe(true);
    expect(lines.some((l) => l.query === '"yuki_fx_life" 投資')).toBe(true);
    expect(lines.some((l) => l.query === '"カクウ タロウ" 詐欺')).toBe(true);
    const empty = newCase('e', NOW);
    expect(buildSearchLines(empty)).toEqual([]);
  });
});

describe('過去案件との照合', () => {
  it('会社名・口座名義・URLのドメイン・電話で一致を知らせる', () => {
    const n = newCase('n1', NOW);
    n.card.companyNames = ['ミライ キャピタル'];
    n.card.payee = { accountName: 'カクウタロウ', cryptoAddresses: [] };
    n.card.urls = ['http://www.mirai-fictional-capital.example/signup'];
    n.card.companyPhone = '０３－００００－００００';
    const m = findCrossMatches(n, [c]);
    expect(m.map((x) => x.field).sort()).toEqual(['URL', '会社名', '口座名義', '電話番号']);
    expect(m[0].caseName).toBe('ゴールドAIプラン');
  });
  it('横断検索', () => {
    expect(searchCases([c], 'yuki').map((r) => r.c.id)).toEqual(['demo-gold-ai-plan']);
    expect(searchCases([c], '架空太郎')).toHaveLength(1);
    expect(searchCases([c], '0300000000')).toHaveLength(1);
    expect(searchCases([c], 'ぜんぜん別の名前')).toHaveLength(0);
    expect(searchCases([c], '')).toHaveLength(0);
  });
});
