import { describe, expect, it } from 'vitest';
import { getActiveItems } from '../data/checklist';
import { applyOverviewToCase, buildOverview, overviewConfig, overviewSummary } from '../logic/overview';
import { lookupRegistry, type RegistryData } from '../logic/registry';
import { newCase } from '../types';
import { NOW } from './helpers';

const items = getActiveItems();
const data: RegistryData = {
  fetchedAt: NOW,
  sources: [
    { key: 'kinsho', name: '金融商品取引業者の一覧', url: 'https://www.fsa.go.jp/menkyo/menkyoj/kinyushohin.xlsx', kind: 'registered', ok: true, count: 1 },
    { key: 'warn', name: '警告', url: 'https://www.fsa.go.jp/ordinary/chuui/mutouroku/04.html', kind: 'warned', ok: true, count: 1 },
  ],
  registered: [{ s: 'kinsho', no: '関東財務局長(金商)第2086号', name: '株式会社チャートマスター', corp: '2011601013164', addr: '東京都杉並区', tel: '03-3390-0272', types: ['投資助言・代理業'] }],
  warned: [{ name: 'わるい名前トレード', when: '令和８年10月' }],
  pages: [
    { key: 'crypto_warn_jp', itemId: '2-2', name: '暗号資産の警告（国内）', url: 'https://example.com/a.pdf', text: 'わるいコイン取引所（WARUI COIN EXCHANGE）' },
    { key: 'sesc', itemId: '2-3', name: '監視委員会の申立て', url: 'https://example.com/s.html', text: '合同会社わるい投資に対する申立て' },
    { key: 'tokurei', itemId: '1-5', name: '特例業務', url: 'https://example.com/t.html', text: '一覧はPDFを参照' },
  ],
};
const run = (names: string[], phones: string[] = [], text = '') => buildOverview(items, { names, phones, text, registry: lookupRegistry(data, { names, phones, text }), data, hints: {} });
const row = (rows: ReturnType<typeof run>, id: string) => rows.find((r) => r.item.id === id)!;

describe('41項目の早見表', () => {
  it('41項目すべてに易しい言い方があり、全部の行が出る', () => {
    for (const it of items) expect(overviewConfig.short[it.id], it.id).toBeTruthy();
    expect(run(['株式会社チャートマスター'])).toHaveLength(41);
  });
  it('登録のある会社：1-1青・1-3は見比べ・2-1青・4-1青・2-2/2-3は名前なし', () => {
    const rows = run(['株式会社チャートマスター']);
    expect(row(rows, '1-1').suggest).toBe('blue');
    expect(row(rows, '1-1').reason).toContain('第2086号');
    expect(row(rows, '1-2').suggest).toBe('yellow');
    expect(row(rows, '1-3').reason).toContain('投資助言・代理業');
    expect(row(rows, '2-1').suggest).toBe('blue');
    expect(row(rows, '2-2').suggest).toBe('blue');
    expect(row(rows, '2-3').suggest).toBe('blue');
    expect(row(rows, '4-1').reason).toContain('2011601013164');
    expect(row(rows, '1-5').kind).toBe('self'); // 載っていないことに意味がないページ
    expect(row(rows, '5-1').link?.url).toContain('google.com/search');
    expect(row(rows, '7-3').kind).toBe('talk');
    const s = overviewSummary(rows);
    expect(s.auto).toBe(7);
    expect(s.auto + s.self + s.talk).toBe(41);
  });
  it('電話番号も入れると1-2が決まる', () => {
    expect(row(run(['チャートマスター'], ['03-3390-0272']), '1-2').suggest).toBe('blue');
    expect(row(run(['チャートマスター'], ['03-0000-0000']), '1-2').suggest).toBe('yellow');
  });
  it('登録なし・警告あり・ページに名前あり・登録番号のなりすまし', () => {
    expect(row(run(['どこかの会社']), '1-1').suggest).toBe('red');
    expect(row(run(['わるい名前トレード']), '2-1').suggest).toBe('red');
    expect(row(run(['WARUI COIN EXCHANGE']), '2-2').suggest).toBe('red');
    expect(row(run(['合同会社わるい投資']), '2-3').suggest).toBe('red');
    expect(row(run(['どこかの会社'], [], '関東財務局長（金商）第2086号'), '1-2').suggest).toBe('red');
  });
  it('名前がなければ自動の行はなく、言葉の候補は「相手の言葉」に出る', () => {
    const rows = buildOverview(items, { names: [], phones: [], text: '元本保証', registry: lookupRegistry(data, { names: [], phones: [], text: '元本保証' }), data, hints: { '7-3': [{ suggest: 'red', quote: '元本保証' }] } });
    expect(overviewSummary(rows).auto).toBe(0);
    expect(row(rows, '7-3').suggest).toBe('red');
    expect(row(rows, '7-3').quote).toBe('元本保証');
  });
  it('記録にすると、自動の分は「仮」で入り、1-1は自分で確かめるまで確定できない', () => {
    const c = newCase('o1', NOW);
    const n = applyOverviewToCase(c, run(['株式会社チャートマスター']), items, NOW);
    expect(n).toBe(7);
    expect(c.items['1-1'].verdict).toBe('blue');
    expect(c.items['1-1'].provisional).toBe(true);
    expect(c.items['1-1'].checkedBy).toBe('ai');
    expect(c.items['1-1'].ai?.source).toBe('app');
    expect(c.items['1-1'].urls[0].url).toContain('fsa.go.jp');
    expect(c.items['3-1']).toBeUndefined();
  });
});
