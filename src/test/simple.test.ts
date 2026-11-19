import { describe, expect, it } from 'vitest';
import { buildSimpleReport, tidyDate } from '../logic/simple';
import { quickCheck } from '../logic/quick';
import { keywords } from '../data/config';
import { getActiveItems } from '../data/checklist';
import type { RegistryData } from '../logic/registry';
import { NOW } from './helpers';
import { findForbidden } from '../logic/forbidden';

const items = getActiveItems();
const data: RegistryData = {
  fetchedAt: NOW,
  sources: [],
  registered: [
    { s: 'kinsho', no: '関東財務局長(金商)第2086号', name: '株式会社チャートマスター', date: '11/14/08', addr: '東京都杉並区', tel: '03-3390-0272', types: ['投資助言・代理業'] },
    { s: 'kinsho', no: '関東財務局長(金商)第44号', name: '株式会社おおきな証券', date: '9/30/07', types: ['第一種', '第二種', '投資運用業'] },
  ],
  warned: [{ name: 'わるい名前トレード', what: '店頭デリバティブ取引の勧誘', when: '令和８年10月' }],
  pages: [],
};
const rep = (query: string, activity: 'advise' | 'manage' | 'unknown', text = '') => buildSimpleReport(quickCheck({ text, query }, [], keywords, items, NOW, data), activity);
const card = (r: ReturnType<typeof rep>, key: string) => r.cards.find((c) => c.key === key)!;

describe('かんたんな結果', () => {
  it('日付をそろえる', () => {
    expect(tidyDate('11/14/08')).toBe('2008年11月');
    expect(tidyDate('ggg2021年10月14日')).toBe('2021年10月');
    expect(tidyDate(undefined)).toBeUndefined();
  });
  it('助言だけの登録：助言は範囲内、お金を預かるのは範囲の外（赤）', () => {
    const a = rep('株式会社チャートマスター', 'advise');
    expect(card(a, 'register').headline).toBe('登録があります');
    expect(card(a, 'register').lines.some((l) => l.text.includes('投資助言・代理業'))).toBe(true);
    expect(card(a, 'doing').tone).toBe('blue');
    expect(card(a, 'history').lines[0].text).toContain('2008年11月');
    expect(a.overall).toBe('blue');
    const m = rep('株式会社チャートマスター', 'manage');
    expect(card(m, 'doing').tone).toBe('red');
    expect(card(m, 'doing').headline).toBe('登録の範囲の外です');
    expect(m.overall).toBe('red');
    expect(card(rep('株式会社チャートマスター', 'unknown'), 'doing').tone).toBe('yellow');
  });
  it('運用の登録がある会社は、お金を預かっても範囲内', () => {
    expect(card(rep('おおきな証券', 'manage'), 'doing').tone).toBe('blue');
  });
  it('登録なし：黄。何をするかを選ぶと赤', () => {
    expect(rep('どこかの会社', 'unknown').overall).toBe('yellow');
    expect(card(rep('どこかの会社', 'manage'), 'doing').tone).toBe('red');
  });
  it('警告あり：赤', () => {
    const r = rep('わるい名前トレード', 'unknown');
    expect(card(r, 'warning').tone).toBe('red');
    expect(card(r, 'warning').lines[0].mark).toBe('red');
    expect(r.title).toBe('あぶない点があります');
  });
  it('「元本保証」は登録があっても赤', () => {
    const r = rep('株式会社チャートマスター', 'advise', '月利8%、元本保証です');
    expect(card(r, 'doing').tone).toBe('red');
    expect(card(r, 'doing').lines.some((l) => l.mark === 'red')).toBe(true);
  });
  it('決めつける言葉を使わない', () => {
    for (const q of ['どこかの会社', 'わるい名前トレード', '株式会社チャートマスター']) {
      for (const a of ['advise', 'manage', 'unknown'] as const) expect(findForbidden(JSON.stringify(rep(q, a)))).toEqual([]);
    }
  });
});

import { buildRumorPrompt, parseRumorReport, rumorSearchLinks } from '../logic/rumor';

describe('口コミ・うわさ', () => {
  it('出どころ（URL）のないものは出さない。levelを読む', () => {
    const r = parseRumorReport('```json\n{"summary":"まとめ","career":[{"text":"2008年に登録","url":"https://a.example/","level":"none"}],"reviews":[{"text":"URLなし","level":"red"}],"rumors":[{"text":"返金の相談が複数","url":"https://b.example/","level":"red"},{"text":"x","url":"https://c.example/","level":"purple"}],"notes":["同じ名前の別の会社かも"]}\n```');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.career).toHaveLength(1);
    expect(r.report.reviews).toHaveLength(0);
    expect(r.report.rumors.map((x) => x.level)).toEqual(['red', 'none']);
    expect(r.report.notes).toHaveLength(1);
    expect(parseRumorReport('こわれた答え').ok).toBe(false);
  });
  it('依頼文と検索ボタン', () => {
    const p = buildRumorPrompt(['株式会社チャートマスター'], '登録あり');
    expect(p).toContain('「株式会社チャートマスター」');
    expect(findForbidden(p)).toEqual([]);
    expect(rumorSearchLinks(['A社'])).toHaveLength(3);
  });
});

import { buildTopicCard, detectTopics, topicNotes, topicWordHits, topics } from '../logic/topics';
import { findRates, rateTone } from '../logic/rates';
import topicsJson from '../../config/topics.json';

const T = (id: string) => topics.find((t) => t.id === id)!;

describe('話の種類ごとの見分け（EA・コピートレード・仮想通貨）', () => {
  it('3つの種類があり、EAは値段・IB・ナンピンマーチン・最初のお金を聞く', () => {
    expect(topics.map((t) => t.id)).toEqual(['ea', 'copy', 'crypto']);
    expect(T('ea').questions.map((q) => q.id)).toEqual(['price', 'ib', 'martin', 'deposit']);
    expect(T('copy').questions.map((q) => q.id)).toEqual(['ib', 'proof', 'fee', 'control', 'martin', 'deposit']);
    expect(T('crypto').questions.map((q) => q.id)).toEqual(['rate', 'exchange', 'send', 'newcoin', 'fee']);
  });
  it('言葉から種類を見つける', () => {
    expect(detectTopics('このＥＡは勝率90%')).toEqual(['ea']);
    expect(detectTopics('コピトレで月利10%')).toEqual(['copy']);
    expect(detectTopics('USDTをウォレットに送ってください')).toEqual(['crypto']);
    expect(detectTopics('EAとコピートレードとビットコイン')).toEqual(['ea', 'copy', 'crypto']);
    expect(detectTopics('不動産の話です。IDEAがあります')).toEqual([]);
  });
  it('EA：高い・IB・ナンピンマーチン・10万円より多い → 赤4つ', () => {
    const a = { price: 'high', ib: 'yes', martin: 'yes', deposit: 'no' };
    const c = buildTopicCard(T('ea'), a, false);
    expect(c.tone).toBe('red');
    expect(c.headline).toBe('あぶない点が4つあります');
    expect(c.lines.at(-1)?.text).toContain('登録は見つかっていません');
    expect(topicNotes({ ea: a })).toHaveLength(4);
    expect(buildTopicCard(T('ea'), { price: 'low', ib: 'no', martin: 'no', deposit: 'yes' }, true).tone).toBe('blue');
    expect(buildTopicCard(T('ea'), { price: 'free' }, true).tone).toBe('yellow');
  });
  it('コピートレード：成績が画像だけ・相手がお金を動かす → 赤', () => {
    const c = buildTopicCard(T('copy'), { proof: 'no', control: 'yes', fee: 'low' }, true);
    expect(c.tone).toBe('red');
    expect(c.headline).toBe('あぶない点が2つあります');
    expect(c.lines.at(-1)?.text).toContain('投資運用業');
  });
  it('仮想通貨：月に10%以上は赤、年に20%以上は黄', () => {
    expect(buildTopicCard(T('crypto'), { rate: 'm10' }, false).tone).toBe('red');
    expect(buildTopicCard(T('crypto'), { rate: 'y20' }, true).tone).toBe('yellow');
    expect(buildTopicCard(T('crypto'), { rate: 'low', exchange: 'yes', send: 'no', newcoin: 'no', fee: 'no' }, true).tone).toBe('blue');
    expect(buildTopicCard(T('crypto'), { send: 'yes', newcoin: 'yes', fee: 'yes', exchange: 'no' }, false).headline).toBe('あぶない点が4つあります');
  });
  it('貼った文章から、質問に関係する言葉を拾う', () => {
    const h = topicWordHits(T('ea'), 'このリンクから口座開設してください。ナンピンで取り返します。最低入金は30万円から。');
    expect(Object.keys(h).sort()).toEqual(['deposit', 'ib', 'martin', 'price']);
  });
  it('利回りの数字：月利10%は赤、年利20%は黄、月利1%は線の下。年にした数字を出す', () => {
    const r = findRates('月利10%です。年利20％。日利1%。月利1%。APY 300%');
    expect(r.map((x) => [x.annual, x.tone])).toEqual([[120, 'red'], [20, 'yellow'], [365, 'red'], [12, 'none'], [300, 'red']]);
    expect(r[0].label).toBe('月に10%（年にすると約120%）');
    expect(rateTone(19)).toBe('none');
    const rep2 = buildSimpleReport(quickCheck({ text: 'ステーキングで年利25%', query: '株式会社チャートマスター' }, [], keywords, items, NOW, data), 'advise');
    expect(rep2.cards.find((c) => c.key === 'doing')!.lines.some((l) => l.text.includes('年に25%') && l.mark === 'yellow')).toBe(true);
  });
  it('結果に入れると全体が赤になり、決めつける言葉はない', () => {
    const r = buildSimpleReport(quickCheck({ text: '', query: '株式会社チャートマスター' }, [], keywords, items, NOW, data), 'advise', [buildTopicCard(T('ea'), { martin: 'yes' }, true)]);
    expect(r.overall).toBe('red');
    expect(r.cards.map((c) => c.key)).toEqual(['register', 'warning', 'doing', 'topic', 'history']);
    expect(findForbidden(JSON.stringify(topicsJson))).toEqual([]);
  });
});
