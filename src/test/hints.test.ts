import { describe, expect, it } from 'vitest';
import { keywords } from '../data/config';
import { getActiveItems } from '../data/checklist';
import { applyAutoHints, computeAutoHints, payeeLooksPersonal } from '../logic/hints';
import { newCase } from '../types';
import { NOW } from './helpers';
import demo from '../../demo/gold-ai-plan.json';
import type { Case } from '../types';

const items = getActiveItems();

describe('4.6 自動の気づき', () => {
  it('デモのやり取りの文から 7-3・9-1・9-2・9-4・7-4・7-5 の候補が出る', () => {
    const c = newCase('h1', NOW);
    c.rawMessages = ['月利8%、元本保証', '今週の金曜日で締め切り', '家族に話すと反対されるから', 'AIが自動で', '友達を紹介すると、その人の入金額の10%', '出金のときは手数料として利益の20%を先に'].join('\n');
    const h = computeAutoHints(c, keywords, items);
    for (const id of ['7-3', '9-1', '9-2', '9-4', '7-4', '7-5']) {
      expect(h[id]?.length ?? 0, id).toBeGreaterThan(0);
    }
    expect(h['7-3'][0].suggest).toBe('red');
    expect(h['9-1'][0].suggest).toBe('yellow');
    expect(h['9-2'][0].suggest).toBe('red');
    expect(h['9-4'][0].suggest).toBe('yellow');
    expect(h['7-4'][0].suggest).toBe('red');
    expect(h['7-5'][0].suggest).toBe('red');
    expect(h['7-3'][0].quote).toContain('元本保証');
  });
  it('デモ案件そのものからも同じ候補が出る', () => {
    const h = computeAutoHints(demo as unknown as Case, keywords, items);
    for (const id of ['7-3', '9-1', '9-2', '9-4', '7-4', '7-5', '7-1', '6-4']) expect(h[id]?.length ?? 0, id).toBeGreaterThan(0);
    expect(h['9-3']).toBeUndefined();
  });
  it('何もない文章からは候補が出ない', () => {
    const c = newCase('h2', NOW);
    c.rawMessages = 'こんにちは。来週の予定を教えてください。';
    expect(Object.keys(computeAutoHints(c, keywords, items))).toEqual([]);
  });
  it('有名人の名前があると 9-3 の候補、暗号資産アドレスがあると 7-2 の候補', () => {
    const c = newCase('h3', NOW);
    c.card.celebrities = '◯◯（有名投資家）';
    c.card.payee = { cryptoAddresses: ['0x1234567890abcdef1234567890abcdef12345678'] };
    const h = computeAutoHints(c, keywords, items);
    expect(h['9-3'][0].suggest).toBe('red');
    expect(h['7-2'].length).toBeGreaterThan(0);
    c.card.celebrities = 'なし';
    expect(computeAutoHints(c, keywords, items)['9-3']).toBeUndefined();
  });
  it('7-1：個人名義らしい口座は候補、法人略号や会社名と重なる名義は候補にしない', () => {
    const markers = keywords.payeeRule.corporateMarkers;
    expect(payeeLooksPersonal({ companyNames: ['合同会社ミライ架空キャピタル'], urls: [], notablePhrases: [], payee: { accountName: 'カクウ タロウ', cryptoAddresses: [] } }, markers)).toBe(true);
    expect(payeeLooksPersonal({ companyNames: ['合同会社ミライキャピタル'], urls: [], notablePhrases: [], payee: { accountName: 'ド）ミライキャピタル', cryptoAddresses: [] } }, markers)).toBe(false);
    expect(payeeLooksPersonal({ companyNames: ['ミライキャピタル'], urls: [], notablePhrases: [], payee: { accountName: 'ミライキャピタル', cryptoAddresses: [] } }, markers)).toBe(false);
    expect(payeeLooksPersonal({ companyNames: [], urls: [], notablePhrases: [], payee: { cryptoAddresses: [] } }, markers)).toBe(false);
  });
  it('applyAutoHints は変わったときだけ true', () => {
    const c = newCase('h4', NOW);
    c.rawMessages = '元本保証です';
    const h = computeAutoHints(c, keywords, items);
    expect(applyAutoHints(c, h, items)).toBe(true);
    expect(c.items['7-3'].autoHints?.length).toBe(1);
    expect(c.items['7-3'].verdict).toBe('unchecked'); // 自動で判定はしない
    expect(applyAutoHints(c, h, items)).toBe(false);
  });
});
