import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCases, useRegistry, useSettings, activeItemsFor } from '../app/hooks';
import { saveCase } from '../app/store';
import { keywords } from '../data/config';
import { quickCheck, type QuickResult } from '../logic/quick';
import { recognizeImages } from '../logic/ocr';
import { applyAutoHints, computeAutoHints } from '../logic/hints';
import { applyOverviewToCase } from '../logic/overview';
import { buildSimpleReport, type Activity, type SimpleCard } from '../logic/simple';
import { fetchRumorReport, rumorSearchLinks, RUMOR_MODEL_DEFAULT, type RumorItem, type RumorReport } from '../logic/rumor';
import { countVerdicts } from '../logic/verdict';
import { buildTopicCard, detectTopics, topicWordHits, topics, type TopicAnswers } from '../logic/topics';
import { nowIso, uuid, ymd } from '../logic/util';
import { OverviewTable } from '../components/OverviewTable';
import { Seal } from '../components/ui';
import { Icon, type IconName } from '../components/Icons';
import { feel } from '../app/feedback';
import { buildPayload, newRunId, sendPayload } from '../logic/collect';
import { useEffect } from 'react';

const TONE_SEAL = { red: 'red', yellow: 'yellow', blue: 'blue', none: 'unchecked' } as const;
const TONE_WORD = { red: 'あぶない', yellow: '気をつける', blue: '問題なし', none: '—' } as const;
const TONE_ICON = { red: 'cross', yellow: 'triangle', blue: 'circle', none: 'circle' } as const;
const CARD_ICON: Record<string, IconName> = { register: 'building', warning: 'flag', doing: 'hand', history: 'clock', topic: 'robot' };
const TOPIC_ICON: Record<string, IconName> = { ea: 'robot', copy: 'copy', crypto: 'coin' };

function Card({ c, i = 0 }: { c: SimpleCard; i?: number }) {
  const icon = c.key === 'topic' ? (c.label.includes('コピー') ? 'copy' : c.label.includes('通貨') ? 'coin' : 'robot') : CARD_ICON[c.key] ?? 'circle';
  return (
    <section className={`s-card s-${c.tone} reveal`} style={{ ['--i' as string]: i }}>
      <div className="s-head">
        <span className="s-label">
          <span className="s-ico">
            <Icon name={icon} size={20} />
          </span>
          {c.label}
        </span>
        <span className="s-tone">
          <Icon name={TONE_ICON[c.tone]} size={14} strokeWidth={2.6} />
          {TONE_WORD[c.tone]}
        </span>
      </div>
      <h3 className="s-title">{c.headline}</h3>
      {c.lines.map((l, i) => (
        <p key={i} className="s-line">
          {l.mark ? <mark className={`mk-${l.mark}`}>{l.text}</mark> : l.text}
        </p>
      ))}
    </section>
  );
}

function RumorList({ title, list }: { title: string; list: RumorItem[] }) {
  if (!list.length) return null;
  return (
    <div>
      <div className="s-sub">{title}</div>
      {list.map((x, i) => (
        <p key={i} className="s-line">
          {x.level === 'none' ? x.text : <mark className={`mk-${x.level}`}>{x.text}</mark>}
          {x.when ? `（${x.when}）` : ''}{' '}
          {x.url && (
            <a className="link text-sm" href={x.url} target="_blank" rel="noopener noreferrer">
              出どころ
            </a>
          )}
        </p>
      ))}
    </div>
  );
}

export function QuickScreen() {
  const cases = useCases();
  const settings = useSettings();
  const registry = useRegistry();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [activity, setActivity] = useState<Activity>('unknown');
  const [ocr, setOcr] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });
  const [emptyMsg, setEmptyMsg] = useState(false);
  const [rumor, setRumor] = useState<{ busy: boolean; report?: RumorReport; error?: string }>({ busy: false });
  const [checking, setChecking] = useState(false);
  const [runId, setRunId] = useState(0);
  const sendRef = useRef<{ id: string; at: string; query: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const items = activeItemsFor(settings);
  const [picked, setPicked] = useState<string[]>([]);
  const [ans, setAns] = useState<TopicAnswers>({});
  const active = topics.filter((t) => picked.includes(t.id));
  const report = useMemo(() => (result ? buildSimpleReport(result, activity, topics.filter((t) => picked.includes(t.id)).map((t) => buildTopicCard(t, ans[t.id] ?? {}, result.registry.registered.length > 0))) : null), [result, activity, picked, ans]);
  const names = result?.registry.names ?? [];

  // 結果を運営者に送る。答えを変えたら、少し待って同じ回として送り直す
  useEffect(() => {
    if (!result || !report || !sendRef.current) return;
    const s = sendRef.current;
    const t = window.setTimeout(() => sendPayload(buildPayload(s.id, s.at, s.query, result, report, activity, picked, ans, settings?.intro)), 2500);
    return () => window.clearTimeout(t);
  }, [result, report, activity, picked, ans, settings?.intro]);

  const run = () => {
    if (!text.trim() && !query.trim()) {
      setEmptyMsg(true);
      return;
    }
    setEmptyMsg(false);
    setRumor({ busy: false });
    const found = detectTopics(`${query}\n${text}`);
    if (found.length) setPicked((cur) => Array.from(new Set([...cur, ...found])));
    const next = quickCheck({ text, query }, cases ?? [], keywords, items, nowIso(), registry);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setChecking(true);
    navigator.vibrate?.(8);
    window.setTimeout(
      () => {
        setChecking(false);
        setResult(next);
        setRunId((n) => n + 1);
        sendRef.current = { id: newRunId(), at: nowIso(), query };
        const o = buildSimpleReport(next, activity).overall;
        feel(`stamp-${o}`);
        window.setTimeout(() => document.getElementById('quick-result')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), 40);
      },
      reduced ? 0 : 720,
    );
  };

  const startCase = async (to: 'kantan' | 'card') => {
    const r = result ?? quickCheck({ text, query }, cases ?? [], keywords, items, nowIso(), registry);
    // 同じ内容の作りかけ（判定をまだ入れていない記録）があれば、それを使う
    const same = (cases ?? []).find((x) => x.rawMessages === r.draft.rawMessages && JSON.stringify(x.card.companyNames) === JSON.stringify(r.draft.card.companyNames) && (x.card.companyPhone ?? '') === (r.draft.card.companyPhone ?? '') && countVerdicts(items, x.items).unchecked === items.length);
    if (same) {
      if (to === 'kantan' && !same.kantan) await saveCase({ ...same, kantan: { answers: {} } });
      navigate(to === 'kantan' ? `/kantan/${same.id}?q=1` : `/case/${same.id}/check`);
      return;
    }
    const c = { ...r.draft, id: uuid(), createdAt: nowIso(), updatedAt: nowIso() };
    if (!c.card.caseName) c.card.caseName = c.card.companyNames[0] ? `${c.card.companyNames[0]}の話` : `チェック ${ymd()}`;
    applyAutoHints(c, computeAutoHints(c, keywords, items), items);
    applyOverviewToCase(c, r.overview, items, nowIso());
    if (to === 'kantan') c.kantan = { answers: {} };
    if (picked.length) c.topics = Object.fromEntries(picked.map((id) => [id, ans[id] ?? {}]));
    await saveCase(c);
    navigate(to === 'kantan' ? `/kantan/${c.id}?q=1` : `/case/${c.id}/check`);
  };

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    setOcr({ busy: true, msg: '読み取りの準備をしています…' });
    try {
      const t = await recognizeImages(files, (p) => setOcr({ busy: true, msg: p.status === 'recognizing text' ? `読み取り中… ${Math.round(p.progress * 100)}%` : '読み取りの準備をしています…' }));
      setText((cur) => (cur ? `${cur}\n\n${t}` : t));
      setOcr({ busy: false, msg: t.trim() ? `${files.length}枚から文字を読み取りました。` : '文字を読み取れませんでした。' });
    } catch (e) {
      setOcr({ busy: false, msg: `読み取れませんでした（${(e as Error).message}）。` });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const askAi = async () => {
    if (!settings?.aiKey || !result) return;
    setRumor({ busy: true });
    const reg = result.registry.registered[0];
    const official = [reg ? `登録あり：${reg.name}／${reg.no}／できること ${reg.types.join('・')}／${reg.addr ?? ''}` : '投資の会社の登録の一覧に名前なし', result.registry.warned.length ? `国の警告あり：${result.registry.warned[0].name}（${result.registry.warned[0].when ?? ''}）` : '国の警告の一覧に名前なし'].join('。');
    const r = await fetchRumorReport(settings.aiKey, settings.aiModel || RUMOR_MODEL_DEFAULT, names, official);
    setRumor(r.ok ? { busy: false, report: r.report } : { busy: false, error: r.error });
  };

  return (
    <div className="k-wrap">
      <div className="hero">
        <div className="hero-kicker">払う前に、パッとチェック</div>
        <h1 className="hero-title">
          <span className="nowrap">その話、</span>
          <span className="nowrap">だいじょうぶ？</span>
        </h1>
      </div>
      <div className="search-box">
        <Icon name="search" size={26} className="search-ico" />
        <label className="sr-only" htmlFor="q">
          会社名・商品名・売っている人の名前
        </label>
        <input id="q" className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="会社名・商品名・人の名前" enterKeyHint="search" autoComplete="off" onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && run()} />
        {query && (
          <button type="button" className="search-clear" aria-label="消す" onClick={() => setQuery('')}>
            <Icon name="close" size={20} />
          </button>
        )}
      </div>
      <p className="-mt-2 text-sm text-ink-3">空白で区切れば、いくつでも。電話番号も入れられます。</p>
      <details className="s-more">
        <summary>
          <Icon name="camera" size={20} />
          言われたこと・スクショも入れる
          {text.trim() && <span className="more-dot" aria-label="入力あり" />}
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <textarea className="textarea min-h-32 text-lg" value={text} onChange={(e) => setText(e.target.value)} placeholder="LINEやメールで言われたことを、ここに貼る" />
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(Array.from(e.target.files ?? []))} />
          <button type="button" className="k-btn" disabled={ocr.busy} onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size={26} className="mr-2" />
            {ocr.busy ? ocr.msg : 'スクショから読み取る'}
          </button>
          {!ocr.busy && ocr.msg && <p className="k-sub">{ocr.msg}</p>}
          <p className="text-sm text-ink-3">読み取りはこの端末の中で行い、外には送りません。</p>
        </div>
      </details>

      <div className="sos-wrap">
        <button type="button" className={`sos-btn ${checking ? 'is-checking' : ''}`} aria-label="チェック" aria-busy={checking} onClick={run} disabled={checking}>
          <span className="sos-ring" aria-hidden="true" />
          {checking ? <span className="sos-checking">照合中</span> : 'チェック'}
        </button>
        <div className="sos-cap" aria-live="polite">
          {checking ? '金融庁の一覧とくらべています…' : '押すと、すぐに見ます'}
        </div>
        {emptyMsg && <p className="note-danger text-lg">名前を入れてから押してください。</p>}
      </div>

      {result && report && (
        <div id="quick-result" key={runId} className="flex scroll-mt-20 flex-col gap-4 pt-2">
          <div className={`verdict verdict-${report.overall}`}>
            <div className="verdict-stamp">
              <Seal v={TONE_SEAL[report.overall]} size="xl" />
              <span className="verdict-splash" aria-hidden="true" />
            </div>
            <div className="verdict-body">
              <div className="verdict-name">{names.length ? names.map((n) => `「${n}」`).join('') : '入れた内容'}の結果</div>
              <h2 className="verdict-title">{report.title}</h2>
              <p className="verdict-sub">{report.sub}</p>
              <div className="verdict-tally">
                {(['red', 'yellow', 'blue'] as const).map((t) => {
                  const n = report.cards.filter((c) => c.tone === t).length;
                  return n ? (
                    <span key={t} className={`tally tally-${t}`}>
                      <Icon name={TONE_ICON[t]} size={14} strokeWidth={2.6} />
                      {TONE_WORD[t]} {n}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>

          <div className="s-ask">
            <div className="s-ask-q">相手は、何をすると言っていますか？</div>
            <div className="s-ask-btns">
              {(
                [
                  ['advise', '教えるだけ', '情報・サイン・助言を売る'],
                  ['manage', 'お金を預かる', '運用する・増やして返す'],
                  ['unknown', 'わからない', ''],
                ] as const
              ).map(([k, label, sub]) => (
                <button key={k} type="button" className={`s-choice ${activity === k ? 's-choice-on' : ''}`} aria-pressed={activity === k} onClick={() => setActivity(k)}>
                  {label}
                  {sub && <small>{sub}</small>}
                </button>
              ))}
            </div>
          </div>

          <div className="s-ask">
            <div className="s-ask-q">どんな話ですか？（当てはまるものを押す）</div>
            <div className="s-ask-btns">
              {topics.map((t) => {
                const on = picked.includes(t.id);
                return (
                  <button key={t.id} type="button" className={`s-choice s-tile ${on ? 's-choice-on' : ''}`} aria-pressed={on} onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}>
                    <Icon name={TOPIC_ICON[t.id] ?? 'circle'} size={30} strokeWidth={1.6} />
                    {t.label}
                    {on && (
                      <span className="tile-check" aria-hidden="true">
                        <Icon name="check" size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {active.map((t) => {
              const hits = topicWordHits(t, text);
              return (
                <div key={t.id} className="s-topic">
                  <div className="s-topic-t">{t.label}</div>
                  {t.questions.map((q) => (
                    <div key={q.id} className="s-eaq">
                      <div className="s-eaq-t">{q.text}</div>
                      {(hits[q.id] ?? []).map((h) => (
                        <p key={h} className="text-sm text-ink-2">
                          言われたことの中に：<mark className="mk-yellow">「{h}」</mark>
                        </p>
                      ))}
                      <div className="s-eaq-btns">
                        {q.answers.map((a) => (
                          <button key={a.key} type="button" className={`s-choice s-choice-sm ${ans[t.id]?.[q.id] === a.key ? 's-choice-on' : ''}`} aria-pressed={ans[t.id]?.[q.id] === a.key} onClick={() => setAns((cur) => ({ ...cur, [t.id]: { ...(cur[t.id] ?? {}), [q.id]: a.key } }))}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {report.cards.map((c, i) => (
            <Card key={c.key + c.label} c={c} i={i} />
          ))}

          <section style={{ ['--i' as string]: report.cards.length }} className={`reveal s-card s-${rumor.report?.rumors.some((x) => x.level === 'red') ? 'red' : rumor.report?.rumors.length ? 'yellow' : 'none'}`}>
            <div className="s-head">
              <span className="s-label">
                <span className="s-ico">
                  <Icon name="talk" size={20} />
                </span>
                口コミ・うわさ
              </span>
            </div>
            {names.length === 0 ? (
              <h3 className="s-title">名前を入れると、ここに出ます</h3>
            ) : rumor.report ? (
              <>
                <h3 className="s-title">{rumor.report.summary || 'AIが調べた結果'}</h3>
                <RumorList title="悪いうわさ・被害の話" list={rumor.report.rumors} />
                <RumorList title="口コミ" list={rumor.report.reviews} />
                <RumorList title="これまでの経歴" list={rumor.report.career} />
                {rumor.report.notes.map((n) => (
                  <p key={n} className="s-line">
                    <mark className="mk-yellow">{n}</mark>
                  </p>
                ))}
                {!rumor.report.rumors.length && !rumor.report.reviews.length && !rumor.report.career.length && <p className="s-line">出どころのある情報は見つかりませんでした（安全という意味ではありません）。</p>}
                <p className="text-xs text-ink-3">AIがネットを調べてまとめたものです。AIは間違えます。出どころを開いて確かめてください。</p>
              </>
            ) : (
              <>
                <h3 className="s-title">ネットの声を見る</h3>
                {settings?.aiKey ? (
                  <button type="button" className="k-btn k-btn-ink" disabled={rumor.busy} onClick={() => void askAi()}>
                    {rumor.busy ? 'AIが調べています…（1分ほど）' : 'AIに調べてもらう'}
                  </button>
                ) : null}
                {rumor.error && <p className="note-danger">{rumor.error}</p>}
                <div className="flex flex-col gap-2 pt-1">
                  {rumorSearchLinks(names).map((l) => (
                    <a key={l.label} className="btn-secondary" href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label} →
                    </a>
                  ))}
                </div>
                <p className="text-sm text-ink-3">同じ名前の別の会社に注意。会社名・場所・時期のうち2つ以上が合うか見てください。</p>
              </>
            )}
          </section>

          <details className="s-more">
            <summary>もっとくわしく（41項目の表）</summary>
            <div className="pt-3">
              <OverviewTable rows={result.overview} />
            </div>
          </details>

          <button type="button" className="k-btn k-btn-ink" onClick={() => void startCase('kantan')}>
            10問で確かめる（2分）
          </button>
          <button type="button" className="k-btn" onClick={() => void startCase('card')}>
            記録して、くわしく調べる
          </button>
          <Link to="/paid" className="k-btn k-btn-shu">
            もう払ってしまった
          </Link>
        </div>
      )}

      {!result && (
        <div className="flex flex-col gap-3 pt-2">
          <Link to="/kantan" className="k-btn">
            名前がわからない → 10問で確かめる
          </Link>
          <Link to="/paid" className="k-btn k-btn-shu">
            もう払ってしまった
          </Link>
          <Link to="/cases" className="link block text-center text-lg">
            前に調べた記録を見る
          </Link>
        </div>
      )}
    </div>
  );
}
