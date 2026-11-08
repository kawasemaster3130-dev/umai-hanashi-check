import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCases, useSettings, activeItemsFor } from '../app/hooks';
import { saveCase } from '../app/store';
import { keywords } from '../data/config';
import { quickCheck, type QuickResult } from '../logic/quick';
import { recognizeImages } from '../logic/ocr';
import { applyAutoHints, computeAutoHints } from '../logic/hints';
import { nowIso, uuid, ymd, formatDate } from '../logic/util';
import { CopyButton, Seal } from '../components/ui';

export function QuickScreen() {
  const cases = useCases();
  const settings = useSettings();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [ocr, setOcr] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const items = activeItemsFor(settings);

  const run = () => {
    if (!text.trim() && !query.trim()) return;
    setResult(quickCheck({ text, query }, cases ?? [], keywords, items, nowIso()));
    setTimeout(() => document.getElementById('quick-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const startCase = async (to: 'kantan' | 'card') => {
    const r = result ?? quickCheck({ text, query }, cases ?? [], keywords, items, nowIso());
    const c = { ...r.draft, id: uuid(), createdAt: nowIso(), updatedAt: nowIso() };
    if (!c.card.caseName) c.card.caseName = c.card.companyNames[0] ? `${c.card.companyNames[0]}の話` : `チェック ${ymd()}`;
    applyAutoHints(c, computeAutoHints(c, keywords, items), items);
    if (to === 'kantan') c.kantan = { answers: {} };
    await saveCase(c);
    navigate(to === 'kantan' ? `/kantan/${c.id}?q=1` : `/case/${c.id}/card`);
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
        <h1 className="h1">この話、だいじょうぶ？</h1>
      </div>
      <p className="k-lead">言われたことを貼るか、スクショを選ぶか、会社の名前を入れてください。すぐに見ます。</p>

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
        <span className="label text-base">会社の名前・人の名前・電話番号（どれか1つ）</span>
        <input className="input text-lg" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：◯◯キャピタル／03-0000-0000" onKeyDown={(e) => e.key === 'Enter' && run()} />
      </label>
      <button type="button" className="k-btn k-btn-ink" onClick={run} disabled={!text.trim() && !query.trim()}>
        チェックする
      </button>

      {result && (
        <div id="quick-result" className="flex flex-col gap-4 pt-4">
          <div className={`k-result k-result-${result.level === 'none' ? 'blue' : result.level}`}>
            <Seal v={result.level === 'none' ? 'blue' : result.level} size="xl" />
            <h2 className="k-q">{result.level === 'red' ? 'やめる理由になる言葉があります' : result.level === 'yellow' ? '気になる言葉があります' : '言葉からは見つかりませんでした'}</h2>
            <p className="k-sub">{result.level === 'none' ? '安全という意味ではありません。下のボタンで、国の登録と評判を自分で見てください。' : '下に、見つかった言葉を出します。'}</p>
          </div>

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
              <div className="k-list-title text-shu">前にも出てきた相手です</div>
              <ul>
                {result.past.map((m, i) => (
                  <li key={i}>
                    {m.otherField}「{m.otherValue}」が、
                    <Link className="link" to={`/case/${m.caseId}/sheet`}>
                      {m.caseName}
                    </Link>
                    （{formatDate(m.caseDate)}）と同じ
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.actions.length > 0 && (
            <div className="k-list">
              <div className="k-list-title">自分の目で見る（ここが一番大事）</div>
              <div className="flex flex-col gap-3 pt-2">
                {result.actions.map((a) => (
                  <div key={a.key}>
                    <a
                      className="k-btn"
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (a.copy) void navigator.clipboard?.writeText(a.copy).catch(() => undefined);
                      }}
                    >
                      {a.label}
                    </a>
                    <p className="k-sub mt-1 flex flex-wrap items-center gap-2">
                      {a.how}
                      {a.copy && <CopyButton text={a.copy} label={`「${a.copy}」をコピー`} />}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="k-sub">ここまでは「言葉」と「前の記録」から分かることだけです。払う前に、続きで確かめます。</p>
          <button type="button" className="k-btn k-btn-ink" onClick={() => void startCase('kantan')}>
            10問で確かめる（2分）
          </button>
          <button type="button" className="k-btn" onClick={() => void startCase('card')}>
            くわしく調べる（教材の41項目）
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
