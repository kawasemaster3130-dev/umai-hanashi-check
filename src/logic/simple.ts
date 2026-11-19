// かんたんな結果：名前を入れたら「国の登録・国の警告・やっていること・これまで」を短い言葉で出す
import type { QuickResult } from './quick';
import type { RegisteredEntry } from './registry';
import { SOURCE_LABEL } from './registry';

export type Tone = 'red' | 'yellow' | 'blue' | 'none';
/** 相手が何をすると言っているか */
export type Activity = 'advise' | 'manage' | 'unknown';

export interface SimpleLine {
  text: string;
  mark?: 'red' | 'yellow'; // 赤字・黄色マーカー
}
export interface SimpleCard {
  key: 'register' | 'warning' | 'doing' | 'history';
  label: string;
  tone: Tone;
  headline: string;
  lines: SimpleLine[];
}
export interface SimpleReport {
  overall: Tone;
  title: string;
  sub: string;
  cards: SimpleCard[];
}

const MANAGE_TYPES = ['投資運用業', '第一種', '第二種'];
const ADVISE_TYPE = '投資助言・代理業';

/** 一覧の日付（9/30/07、ggg2021年10月14日 など）を「2007年9月」の形に */
export function tidyDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const t = raw.normalize('NFKC').replace(/^g+/i, '').trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (m) {
    const y = Number(m[3]) < 100 ? (Number(m[3]) < 50 ? 2000 + Number(m[3]) : 1900 + Number(m[3])) : Number(m[3]);
    return `${y}年${Number(m[1])}月`;
  }
  m = /^(\d{4})年(\d{1,2})月/.exec(t);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  m = /^(\d{4})[-/.](\d{1,2})/.exec(t);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  return t || undefined;
}

function jobs(e: RegisteredEntry): string {
  if (e.s === 'crypto') return '暗号資産の交換';
  return e.types.length ? e.types.join('・') : '（種類の記載なし）';
}

export function buildSimpleReport(r: QuickResult, activity: Activity): SimpleReport {
  const reg = r.registry;
  const has = reg.available;
  const names = reg.names;
  const first = reg.registered[0];
  const cards: SimpleCard[] = [];

  // 1. 国の登録
  if (!has || !names.length) {
    cards.push({ key: 'register', label: '国の登録', tone: 'none', headline: names.length ? '登録の一覧を読み込めませんでした' : '名前を入れると、ここに出ます', lines: [] });
  } else if (first) {
    cards.push({
      key: 'register',
      label: '国の登録',
      tone: 'blue',
      headline: '登録があります',
      lines: reg.registered.slice(0, 3).flatMap((e) => [
        { text: `${e.name}（${SOURCE_LABEL[e.s] ?? e.s}）` },
        { text: `できること：${jobs(e)}` },
        { text: `${e.no}${tidyDate(e.date) ? `／${tidyDate(e.date)}から` : ''}` },
        ...(e.addr || e.tel ? [{ text: `${e.addr ?? ''}${e.tel ? `　電話 ${e.tel}` : ''}` }] : []),
      ]),
    });
    cards[0].lines.push({ text: '同じ名前を名乗る「なりすまし」があります。相手の住所・電話が上と同じか見てください。', mark: 'yellow' });
  } else {
    cards.push({
      key: 'register',
      label: '国の登録',
      tone: 'yellow',
      headline: '登録が見つかりません',
      lines: [
        { text: `「${reg.notFoundNames.join('」「')}」は、投資の会社の登録の一覧にありません。`, mark: 'yellow' },
        { text: '投資を勧めたり、お金を集めたりするには、国の登録が要ります。' },
        { text: '商品名や人の名前では出ません。会社の正式な名前でも入れてみてください。' },
      ],
    });
  }

  // 2. 国の警告
  const pageHits = r.overview.filter((o) => o.kind === 'auto' && o.suggest === 'red' && !['1-1', '1-2'].includes(o.item.id) && !reg.warned.length);
  const badNo = reg.numberOwners.filter((x) => !x.owner || (names.length > 0 && !x.matchesName));
  if (reg.warned.length || pageHits.length || badNo.length) {
    cards.push({
      key: 'warning',
      label: '国の警告',
      tone: 'red',
      headline: reg.warned.length ? '国が警告を出しています' : badNo.length ? '登録番号がおかしいです' : '国の発表に名前があります',
      lines: [
        ...reg.warned.slice(0, 3).flatMap((w) => [{ text: `${w.name}（${w.when ?? ''}）`, mark: 'red' as const }, ...(w.what ? [{ text: w.what }] : [])]),
        ...badNo.map((x) => ({ text: x.owner ? `言われた番号 ${x.no} は「${x.owner.name}」のものです。名乗っている会社と違います。` : `言われた番号 ${x.no} は、登録の一覧にありません。`, mark: 'red' as const })),
        ...pageHits.map((o) => ({ text: o.reason ?? '', mark: 'red' as const })),
      ],
    });
  } else if (has && names.length) {
    cards.push({ key: 'warning', label: '国の警告', tone: 'blue', headline: '警告の一覧に名前はありません', lines: [{ text: '載っていないことは、安全という意味ではありません。' }] });
  } else {
    cards.push({ key: 'warning', label: '国の警告', tone: 'none', headline: '名前を入れると、ここに出ます', lines: [] });
  }

  // 3. やっていること（法律に合うか）
  const doing: SimpleCard = { key: 'doing', label: 'やっていること', tone: 'none', headline: '', lines: [] };
  const types = first?.types ?? [];
  const canManage = !!first && (first.s === 'crypto' || types.some((t) => MANAGE_TYPES.some((m) => t.includes(m))));
  const canAdvise = !!first && types.some((t) => t.includes(ADVISE_TYPE));
  if (!names.length || !has) {
    doing.headline = '名前を入れると、ここに出ます';
  } else if (!first) {
    doing.tone = activity === 'unknown' ? 'yellow' : 'red';
    doing.headline = activity === 'unknown' ? '登録がないまま勧めていれば、法律違反のおそれ' : '登録なしでは、してはいけないことです';
    doing.lines.push({ text: activity === 'manage' ? '登録のない相手がお金を預かる・運用するのは、法律違反のおそれがあります。' : activity === 'advise' ? '登録のない相手がお金をとって投資の助言をするのは、法律違反のおそれがあります。' : '投資を勧める・助言する・お金を預かるには、どれも国の登録が要ります。', mark: activity === 'unknown' ? 'yellow' : 'red' });
  } else if (activity === 'manage') {
    if (canManage) {
      doing.tone = 'blue';
      doing.headline = '登録の範囲に入っています';
      doing.lines.push({ text: `お金を預かる・運用する登録があります（${jobs(first)}）。` });
    } else {
      doing.tone = 'red';
      doing.headline = '登録の範囲の外です';
      doing.lines.push({ text: `この会社の登録は「${jobs(first)}」だけです。お金を預かる・運用を任せるのは、登録の範囲の外（法律違反のおそれ）。`, mark: 'red' });
    }
  } else if (activity === 'advise') {
    doing.tone = canAdvise || canManage ? 'blue' : 'yellow';
    doing.headline = canAdvise ? '登録の範囲に入っています' : '助言の登録は見当たりません';
    doing.lines.push(canAdvise ? { text: '投資の助言（教える・サインを配る）の登録があります。' } : { text: `登録は「${jobs(first)}」です。助言の登録（投資助言・代理業）は見当たりません。`, mark: 'yellow' });
    if (canAdvise && !canManage) doing.lines.push({ text: 'ただし、お金を預かる・運用を任せろと言われたら、範囲の外です。', mark: 'yellow' });
  } else {
    doing.tone = 'yellow';
    doing.headline = '相手が何をするかで決まります';
    doing.lines.push({ text: `この会社にできること：${jobs(first)}` });
    if (canAdvise && !canManage) doing.lines.push({ text: '助言だけの登録です。お金を預かる・運用を任せろと言われたら、範囲の外（法律違反のおそれ）。', mark: 'yellow' });
  }
  // 言われた言葉の中の、禁止されている言い方
  const promise = r.hits.find((h) => h.itemId === '7-3');
  if (promise) {
    doing.tone = 'red';
    doing.lines.push({ text: `「${promise.quotes[0]}」`, mark: 'red' });
    doing.lines.push({ text: '「必ずもうかる」「元本保証」「損は補う」と言って勧めるのは、登録のある会社でも禁止されています。' });
    if (!doing.headline || doing.headline.startsWith('名前を')) doing.headline = '禁止されている言い方があります';
  }
  for (const h of r.hits.filter((x) => x.itemId !== '7-3').slice(0, 4)) doing.lines.push({ text: `${h.label}：「${h.quotes[0]}」`, mark: h.suggest });
  if (doing.tone !== 'red' && r.hits.some((h) => h.suggest === 'red')) doing.tone = 'red';
  else if (doing.tone === 'blue' && r.hits.length) doing.tone = 'yellow';
  cards.push(doing);

  // 4. これまで（経歴）
  const hist: SimpleCard = { key: 'history', label: 'これまで', tone: 'none', headline: '', lines: [] };
  for (const e of reg.registered.slice(0, 3)) {
    const d = tidyDate(e.date);
    hist.lines.push({ text: `${d ? `${d}　` : ''}${e.name} が ${SOURCE_LABEL[e.s] ?? e.s} として登録` });
  }
  for (const w of reg.warned.slice(0, 3)) hist.lines.push({ text: `${w.when ?? ''}　国が警告（${w.name}）`, mark: 'red' });
  for (const p of r.past) hist.lines.push({ text: `前にこのアプリで調べた記録：${p.caseName}（${p.overall === 'red' ? '赤' : p.overall === 'yellow' ? '黄' : '青'}）`, mark: p.overall === 'red' ? 'red' : p.overall === 'yellow' ? 'yellow' : undefined });
  hist.headline = hist.lines.length ? '国の記録から分かること' : '国の記録には、まだ何もありません';
  hist.tone = reg.warned.length ? 'red' : 'none';
  cards.push(hist);

  const overall: Tone = cards.some((c) => c.tone === 'red') ? 'red' : cards.some((c) => c.tone === 'yellow') ? 'yellow' : first ? 'blue' : 'none';
  const title = overall === 'red' ? 'あぶない点があります' : overall === 'yellow' ? '気をつける点があります' : overall === 'blue' ? '国の記録では、問題は見つかりませんでした' : '名前だけでは分かりませんでした';
  const sub = overall === 'red' ? '赤いところを読んでください。払う前に、家族に見せましょう。' : overall === 'yellow' ? '黄色いところを確かめるまで、払わないでください。' : overall === 'blue' ? '安全の保証ではありません。口コミ・うわさも見てください。' : '会社の正式な名前を入れてみてください。';
  return { overall, title, sub, cards };
}
