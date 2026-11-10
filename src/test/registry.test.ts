import { describe, expect, it } from 'vitest';
import { coreName, findRegistrationNos, lookupRegistry, type RegistryData } from '../logic/registry';

const data: RegistryData = {
  fetchedAt: '2026-11-10T00:00:00Z',
  sources: [],
  registered: [
    { s: 'kinsho', no: '関東財務局長（金商）第1234号', name: '株式会社チャート マスター', addr: '東京都千代田区1-1', tel: '03-1111-2222', types: ['投資助言・代理業'] },
    { s: 'kinsho', no: '関東財務局長（金商）第9999号', name: 'ほんもの投資顧問株式会社', addr: '東京都中央区', tel: '03-9999-0000', types: ['投資助言・代理業'] },
    { s: 'crypto', no: '関東財務局長第00003号', name: '株式会社bitFlyer', types: [] },
  ],
  warned: [{ name: '合同会社ネクスト架空トレード（Next Fictional Trade）', what: '店頭デリバティブ取引の勧誘', when: '令和７年３月', where: '国内' }],
};

describe('金融庁の一覧との照合', () => {
  it('名前は「株式会社」や空白のちがいを気にせず見つける', () => {
    expect(coreName('株式会社チャート　マスター')).toBe(coreName('チャートマスター'));
    const r = lookupRegistry(data, { names: ['株式会社チャートマスター'], phones: [], text: '' });
    expect(r.registered.map((e) => e.no)).toEqual(['関東財務局長（金商）第1234号']);
    expect(r.notFoundNames).toEqual([]);
    expect(r.level).toBe('info');
    expect(lookupRegistry(data, { names: ['BITFLYER'], phones: [], text: '' }).registered).toHaveLength(1);
  });
  it('登録の一覧にない名前は黄', () => {
    const r = lookupRegistry(data, { names: ['合同会社ミライ架空キャピタル'], phones: [], text: '' });
    expect(r.registered).toEqual([]);
    expect(r.notFoundNames).toEqual(['合同会社ミライ架空キャピタル']);
    expect(r.level).toBe('yellow');
  });
  it('警告の一覧にある名前は赤（英語名でも）', () => {
    expect(lookupRegistry(data, { names: ['ネクスト架空トレード'], phones: [], text: '' }).level).toBe('red');
    expect(lookupRegistry(data, { names: ['Next Fictional Trade'], phones: [], text: '' }).warned).toHaveLength(1);
  });
  it('電話番号でも登録業者が見つかる', () => {
    const r = lookupRegistry(data, { names: [], phones: ['０３－１１１１－２２２２'], text: '' });
    expect(r.registered[0].name).toBe('株式会社チャート マスター');
  });
  it('文章の登録番号の持ち主が、名乗っている会社と違えば赤（なりすまし）', () => {
    expect(findRegistrationNos('関東財務局長（金商）第9999号を取っているので安心です')).toEqual(['関東財務局長第9999号']);
    const r = lookupRegistry(data, { names: ['合同会社ミライ架空キャピタル'], phones: [], text: '関東財務局長（金商）第９９９９号を取っています' });
    expect(r.numberOwners[0].owner?.name).toBe('ほんもの投資顧問株式会社');
    expect(r.numberOwners[0].matchesName).toBe(false);
    expect(r.level).toBe('red');
    const ok = lookupRegistry(data, { names: ['ほんもの投資顧問'], phones: [], text: '関東財務局長(金商)第9999号' });
    expect(ok.numberOwners[0].matchesName).toBe(true);
    expect(ok.level).toBe('info');
    const none = lookupRegistry(data, { names: [], phones: [], text: '関東財務局長（金商）第77777号' });
    expect(none.numberOwners[0].owner).toBeUndefined();
    expect(none.level).toBe('red');
  });
  it('写しがなければ available=false', () => {
    expect(lookupRegistry(undefined, { names: ['x社'], phones: [], text: '' }).available).toBe(false);
  });
});
