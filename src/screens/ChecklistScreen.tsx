import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCaseCtx } from '../app/CaseContext';
import { StepBar } from '../components/Layout';
import { CATEGORIES, itemsByCategory } from '../data/checklist';
import { guideById, linksForGuide } from '../data/config';
import { canStopEarly, getResult } from '../logic/verdict';
import { buildSearchLines, googleSearchUrl } from '../logic/search';
import { Collapsible, CopyButton, CountsBar, ExternalLink, Seal, VerdictBadge } from '../components/ui';
import { ItemEditor } from '../components/ItemEditor';
import { LinkList } from '../components/LinkList';

export function ChecklistScreen() {
  const v = useCaseCtx();
  const { c, items, counts, ctx, update } = v;
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const cat = Number(sp.get('cat') ?? '1') || 1;
  const byCat = useMemo(() => itemsByCategory(items), [items]);
  const catItems = byCat.get(cat) ?? [];
  const category = CATEGORIES.find((x) => x.no === cat);
  const guide = category ? guideById(category.guide) : undefined;
  const selfItems = items.filter((it) => it.selfRequired);
  const [highlight, setHighlight] = useState<string | null>(null);
  const searchLines = useMemo(() => buildSearchLines(c), [c]);
  const cardOnly = ctx.rules.cardOnlyCategories.includes(cat);
  const prevRed = useRef(counts.red);
  const [stopPanel, setStopPanel] = useState(false);
  useEffect(() => {
    if (prevRed.current === 0 && counts.red >= 1 && !c.stoppedEarly) setStopPanel(true);
    prevRed.current = counts.red;
  }, [counts.red, c.stoppedEarly]);
  const stopNow = () => {
    update((d) => {
      d.stoppedEarly = true;
      if (d.review.status === 'pending') d.review = { status: 'skipped', skipReason: '赤が出たので、ここで打ち切った', flaggedCategories: [], findings: [] };
    });
    setStopPanel(false);
    navigate(`/case/${c.id}/sheet`);
  };

  useEffect(() => {
    const hash = window.location.hash;
    const m = /#item-([\w-]+)$/.exec(hash);
    if (!m) return;
    const id = m[1];
    const t = setTimeout(() => {
      document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlight(id);
    }, 80);
    return () => clearTimeout(t);
  }, [cat]);

  const jumpTo = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    navigate(`/case/${c.id}/check?cat=${it.cat}#item-${id}`);
    setTimeout(() => {
      document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlight(id);
    }, 120);
  };

  const catCounts = (no: number) => {
    const list = byCat.get(no) ?? [];
    const done = list.filter((it) => getResult(c.items, it.id).verdict !== 'unchecked').length;
    const red = list.filter((it) => getResult(c.items, it.id).verdict === 'red').length;
    return { done, total: list.length, red };
  };

  return (
    <div className="space-y-4">
      {stopPanel && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-labelledby="stop-title">
          <div className="k-result k-result-red w-full max-w-md gap-4">
            <Seal v="red" size="xl" />
            <h2 id="stop-title" className="k-q">
              やめる理由が見つかりました
            </h2>
            <p className="k-sub">赤が1つあれば、答えは「払わない」です。ここで終わってかまいません。残りは調べなくても結果を出せます。</p>
            <button type="button" className="k-btn k-btn-ink w-full" onClick={stopNow}>
              ここで終わる（結果を見る）
            </button>
            <button type="button" className="k-btn w-full" onClick={() => setStopPanel(false)}>
              続けて調べる
            </button>
          </div>
        </div>
      )}
      <StepBar />
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CountsBar counts={counts} />
          <div className="flex items-center gap-2">
            {c.stoppedEarly ? (
              <button type="button" className="btn-secondary btn-sm" onClick={() => update((d) => void (d.stoppedEarly = false))}>
                打ち切りを取り消す
              </button>
            ) : (
              <button
                type="button"
                className="btn-danger btn-sm"
                disabled={!canStopEarly(counts)}
                title={canStopEarly(counts) ? '' : '赤が1つ以上あるときだけ使えます'}
                onClick={() => {
                  if (window.confirm(`赤が${counts.red}件あります。ここで打ち切りますか？\n残りの${counts.unchecked}項目は「未調査」のまま黄として数え、全体の判定は赤のままです。判定の1枚に「赤${counts.red}件の時点で打ち切り」と出ます。`)) {
                    update((d) => void (d.stoppedEarly = true));
                  }
                }}
              >
                赤で打ち切る
              </button>
            )}
          </div>
        </div>
        {c.stoppedEarly && (
          <div className="note-danger">
            赤{counts.red}件の時点で打ち切り中です。残り{counts.unchecked}項目は未調査（黄として数える）のまま、判定の1枚を確定できます。原本どおり、赤が出たら{ctx.rules.earlyStopMinutes}分で切り上げてかまいません。
          </div>
        )}
        <div className="border border-ink bg-paper-3 p-3">
          <div className="mincho mb-1 font-bold">自分の目で見る4つ（AIの答えは当てにしない）</div>
          <div className="flex flex-wrap gap-2">
            {selfItems.map((it) => {
              const r = getResult(c.items, it.id);
              const ok = r.checkedBy === 'self' && r.verdict !== 'unchecked' && (r.urls.length + r.screenshots.length) > 0;
              return (
                <button key={it.id} type="button" className={`chip ${ok ? 'bg-paper-2 text-shu' : 'bg-paper-2 text-ink-2'}`} onClick={() => jumpTo(it.id)}>
                  {ok ? '㊞' : '□'} <span className="mono">{it.id}</span> <VerdictBadge v={r.verdict} provisional={r.provisional} size="sm" />
                </button>
              );
            })}
          </div>
          <div className="mt-1 text-xs text-ink-2">金融庁の一覧はパソコンのほうが見やすいです。会社名をコピー → 開く → 検索。</div>
        </div>
      </div>

      <nav className="index-tabs -mx-4 px-4" aria-label="分類">
        {CATEGORIES.map((k) => {
          const cc = catCounts(k.no);
          const active = k.no === cat;
          const flagged = c.review.flaggedCategories.includes(k.no);
          return (
            <button key={k.no} type="button" className={`index-tab ${flagged && !active ? 'index-tab-flag' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => setSp({ cat: String(k.no) })}>
              <span className="mono mr-1">{k.no}</span>
              {k.title}
              <span className="mono ml-1 text-xs font-normal">
                {cc.done}/{cc.total}
                {cc.red ? <span className="text-shu"> 止{cc.red}</span> : ''}
              </span>
            </button>
          );
        })}
      </nav>

      <section className="index-sheet space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">
            分類{cat}　{category?.title}
          </h2>
          {guide && (
            <Link className="link" to={`/guides/${guide.id}`}>
              {guide.title} を開く
            </Link>
          )}
        </div>
        {guide && <p className="text-sm text-ink-2">{guide.intro}</p>}
        {cardOnly && <div className="note">ここは調べものは要りません。言われたことを思い出して答えるだけです。迷ったら7と9を先に。</div>}
        {cat >= 1 && cat <= 3 && <div className="note">「載っていない」は安全の意味ではありません。似た名前・英語名・前の名前でも探します。</div>}
        {c.review.flaggedCategories.includes(cat) && <div className="note">もう一人（別のAI）から、この分類に指摘がありました。ここの全部を見直して「見直し済み」にしてください。</div>}
        {guide && linksForGuide(guide.id).length > 0 && (
          <Collapsible title={`調べる場所（${guide.title.replace(/　.*/, '')}）`} defaultOpen={cat <= 3}>
            <LinkList links={linksForGuide(guide.id)} c={c} />
          </Collapsible>
        )}
        {cat >= 4 && cat <= 6 && (
          <Collapsible title={`ステップ4：検索の言葉（${searchLines.length}行。1行ずつコピーして検索）`} defaultOpen={cat === 5}>
            {searchLines.length === 0 ? (
              <p className="text-sm text-ink-2">案件カードに代表者・会社名・紹介者・口座名義を入れると、ここに検索の言葉が出ます。</p>
            ) : (
              <ul className="space-y-1">
                {searchLines.map((l, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-xs text-ink-3">{l.label}</span>
                    <code className="bg-paper-3 px-1.5 py-0.5">{l.query}</code>
                    <CopyButton text={l.query} className="btn-secondary btn-sm !min-h-7 !py-0 text-xs" />
                    <ExternalLink href={googleSearchUrl(l.query)} className="btn-secondary btn-sm !min-h-7 !py-0 text-xs no-underline">
                      検索を開く
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-2">同じ名前の別人に注意：会社名・地名・時期・SNSアカウントのうち2つ以上が一致してはじめて同じ人とみなします。</p>
          </Collapsible>
        )}
        {catItems.map((it) => (
          <ItemEditor key={it.id} item={it} highlight={highlight === it.id} />
        ))}
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className="btn-secondary" disabled={cat <= 1} onClick={() => setSp({ cat: String(cat - 1) })}>
          ← 分類{cat - 1}
        </button>
        {cat < 9 ? (
          <button type="button" className="btn-primary" onClick={() => setSp({ cat: String(cat + 1) })}>
            分類{cat + 1} →
          </button>
        ) : (
          <Link to={`/case/${c.id}/review`} className="btn-primary">
            ステップ6 もう一人に見てもらう →
          </Link>
        )}
      </div>
    </div>
  );
}
