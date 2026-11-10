import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCases, useRegistry, useSettings, activeItemsFor } from '../app/hooks';
import { RegistryPanel } from '../components/RegistryPanel';
import { OverviewTable } from '../components/OverviewTable';
import { applyOverviewToCase } from '../logic/overview';
import { VerdictBadge } from '../components/ui';
import { saveCase } from '../app/store';
import { keywords } from '../data/config';
import { quickCheck, type QuickResult } from '../logic/quick';
import { recognizeImages } from '../logic/ocr';
import { applyAutoHints, computeAutoHints } from '../logic/hints';
import { nowIso, uuid, ymd, formatDate } from '../logic/util';
import { countVerdicts } from '../logic/verdict';
import { Seal } from '../components/ui';

export function QuickScreen() {
  const cases = useCases();
  const settings = useSettings();
  const registry = useRegistry();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [ocr, setOcr] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [emptyMsg, setEmptyMsg] = useState(false);
  const items = activeItemsFor(settings);

  const run = () => {
    if (!text.trim() && !query.trim()) return;
    setResult(quickCheck({ text, query }, cases ?? [], keywords, items, nowIso(), registry));
    setTimeout(() => document.getElementById('quick-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const startCase = async (to: 'kantan' | 'card') => {
    const r = result ?? quickCheck({ text, query }, cases ?? [], keywords, items, nowIso(), registry);
    // 同じ内容の作りかけ（判定をまだ入れていない記録）があれば、それを使う。同じ記録を増やさない
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
    await saveCase(c);
    navigate(to === 'kantan' ? `/kantan/${c.id}?q=1` : `/case/${c.id}/check`);
  };

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    setOcr({ busy: true, msg: '読み取りの準備をしています…' });
    try {
      const t = await recognizeImages(files, (p) => setOcr({ busy: true, msg: p.status === 'recognizing text' ? `読み取り中… ${Math.round(p.progress * 100)}%` : '読み取りの準備をしています…' }));
      setText((cur) => (cur ? `${cur}\n\n${t}` : t));
      setOcr({ busy: false, msg: t.trim() ? `${files.length}枚から文字を読み取りました。間違いがあれば直してください。` : '文字を読み取れませんでした。画面を大きめに写したスクショを試してください。' });
    } catch (e) {
      setOcr({ busy: false, msg: `読み取れませんでした（${(e as Error).message}）。文章を手で貼ってください。` });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="k-wrap">
      <div className="k-title">
        <Seal v="unchecked" size="lg" />
        <h1 className="h1">新しい話をパッとチェック</h1>
      </div>
      <p className="k-lead">言われたことを貼る・スクショを選ぶ・名前を入れる。どれか1つで、赤いボタンを押すだけ。</p>

      <label className="block">
        <span className="label text-base">言われたこと（LINE・DM・メールの文）</span>
        <textarea className="textarea min-h-36 text-lg" value={text} onChange={(e) => setText(e.target.value)} placeholder="ここに貼る" />
      </label>
      <div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(Array.from(e.target.files ?? []))} />
        <button type="button" className="k-btn" disabled={ocr.busy} onClick={() => fileRef.current?.click()}>
          {ocr.busy ? ocr.msg : 'スクショから読み取る'}
        </button>
        {!ocr.busy && ocr.msg && <p className="k-sub mt-2">{ocr.msg}</p>}
        <p className="mt-1 text-sm text-ink-3">読み取りはこの端末の中で行います。外には送りません。初回だけ部品の読み込みに少し時間がかかります。</p>
      </div>
      <label className="block">
        <span className="label text-base">会社の名前・話の名前・人の名前・電話番号（いくつでも。空白で区切る）</span>
        <input className="input text-lg" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：◯◯キャピタル ゴールドプラン 03-0000-0000" onKeyDown={(e) => e.key === 'Enter' && run()} />
      </label>
      <div className="sos-wrap">
        <button
          type="button"
          className="sos-btn"
          aria-label="チェック"
          onClick={() => {
            if (!text.trim() && !query.trim()) {
              setEmptyMsg(true);
              return;
            }
            setEmptyMsg(false);
            run();
          }}
        >
          チェック
        </button>
        <div className="sos-cap">押すと、すぐに見ます</div>
        {emptyMsg && <p className="note-danger text-lg">上に、言われたことを貼るか、スクショを選ぶか、名前を入れてから押してください。</p>}
      </div>

      {result && (
        <div id="quick-result" className="flex flex-col gap-4 pt-4">
          <div className={`k-result ${result.level === 'none' ? '' : `k-result-${result.level}`}`}>
            <Seal v={result.level === 'none' ? 'unchecked' : result.level} size="xl" />
            <h2 className="k-q">{result.headline.title}</h2>
            <p className="k-sub">{result.headline.sub}</p>
          </div>

          <RegistryPanel r={result.registry} big />

          {result.hits.length > 0 && (
            <div className="k-list">
              <div className="k-list-title">見つかった言葉</div>
              <ul>
                {result.hits.map((h) => (
                  <li key={h.itemId} className="k-hit">
                    <Seal v={h.suggest} size="sm" />
                    <span>
                      <span className="font-bold">{h.label}</span>
                      <span className="block text-base text-ink-2">「{h.quotes[0]}」{h.quotes.length > 1 ? ` ほか${h.quotes.length - 1}か所` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.past.length > 0 && (
            <div className="k-list border-shu">
              <div className="k-list-title text-shu">前に調べた記録があります</div>
              <div className="flex flex-col gap-2 pt-1">
                {result.past.map((p) => (
                  <Link key={p.caseId} to={`/case/${p.caseId}/${p.confirmed ? 'sheet' : 'check'}`} className="flex flex-wrap items-center gap-2 border border-rule bg-paper-3 px-3 py-2 no-underline">
                    <VerdictBadge v={p.overall} size="lg" />
                    <span className="font-bold text-ink">{p.caseName}</span>
                    <span className="text-base text-ink-2">
                      {formatDate(p.caseDate)}・{p.decided}項目を調べた・同じもの：{p.matches.slice(0, 2).join('、')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <OverviewTable rows={result.overview} />

          <p className="k-sub">残りは、続きで確かめます。自動で分かった分は「仮」として引き継ぎます。</p>
          <button type="button" className="k-btn k-btn-ink" onClick={() => void startCase('kantan')}>
            10問で確かめる（2分）
          </button>
          <button type="button" className="k-btn" onClick={() => void startCase('card')}>
            41項目を順に答える（記録する）
          </button>
          <Link to="/paid" className="k-btn k-btn-shu">
            もう払ってしまった
          </Link>
        </div>
      )}

      {!result && (
        <div className="flex flex-col gap-3 pt-2">
          <Link to="/kantan" className="k-btn">
            文章がなくても10問で確かめる
          </Link>
          <button type="button" className="k-btn" onClick={() => void startCase('card')}>
            くわしく調べる（教材の41項目）
          </button>
          <Link to="/paid" className="k-btn k-btn-shu">
            もう払ってしまった
          </Link>
          <Link to="/cases" className="link block text-center text-lg">
            保存した記録を見る
          </Link>
        </div>
      )}
    </div>
  );
}
