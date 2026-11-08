import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCases, useSettings, ctxFor } from '../app/hooks';
import { createCase, deleteCase } from '../app/store';
import { PageTitle } from '../components/Layout';
import { CountsBar, OverallBadge, Spinner } from '../components/ui';
import { caseTitle, searchCases } from '../logic/crossref';
import { countVerdicts, overallVerdict } from '../logic/verdict';
import { formatDate } from '../logic/util';
import { loadDemoCase } from '../app/demo';

export function Home() {
  const cases = useCases();
  const settings = useSettings();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const results = useMemo(() => (cases && q.trim() ? searchCases(cases, q) : null), [cases, q]);

  const newCase = async () => {
    const c = await createCase(settings?.investigatorDefault);
    navigate(`/case/${c.id}/card`);
  };

  return (
    <div className="space-y-4">
      <PageTitle title="保存した記録" sub="調べた話の一覧です。新しく調べるときは、上の題字から「この話、だいじょうぶ？」へ。" />
      <Link to="/" className="k-btn k-btn-ink">
        新しい話をぱっとチェック
      </Link>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-lg" onClick={newCase}>
          ＋ くわしく調べる（41項目）
        </button>
        <Link to="/paid" className="btn-danger">
          すでに払ってしまった人へ
        </Link>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="note-info">本当にもうかる話は、自分のところには来ません。</div>
        <div className="note-info">一番大事なのは、売っている人と会社の過去。それと国の登録。</div>
        <div className="note-info">AIは間違えます。登録は自分の目で見ます。</div>
      </div>

      <section className="card space-y-2">
        <label className="block">
          <span className="label">記録の中をさがす（会社名・名前・口座名義・URL・電話）</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：会社名、口座名義、ドメイン" />
        </label>
        {results && (
          <ul className="space-y-1 text-sm">
            {results.length === 0 && <li className="text-ink-3">一致する案件はありません。</li>}
            {results.map(({ c, hits }) => (
              <li key={c.id}>
                <Link className="link font-semibold" to={`/case/${c.id}/sheet`}>
                  {caseTitle(c)}
                </Link>
                <span className="ml-2 text-ink-2">{hits.map((h) => `${h.field}：${h.value}`).join('、')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="h2 dai">一覧</h2>
        {!cases ? (
          <Spinner />
        ) : cases.length === 0 ? (
          <div className="card space-y-3">
            <p>まだ記録がありません。教材の例（デモ）を読み込むと、画面の流れを見られます。</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                const id = await loadDemoCase(settings);
                navigate(`/case/${id}/sheet`);
              }}
            >
              デモの案件（ゴールドAIプラン）を読み込む
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {cases.map((c) => {
              const ctx = ctxFor(c, settings);
              const counts = countVerdicts(ctx.items, c.items);
              const overall = overallVerdict(counts);
              const decided = ctx.items.length - counts.unchecked;
              const latest = c.snapshots.at(-1);
              return (
                <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link className="h3 link no-underline hover:underline" to={`/case/${c.id}/${latest ? 'sheet' : decided > 0 ? 'check' : 'card'}`}>
                      {caseTitle(c)}
                    </Link>
                    <div className="text-sm text-ink-2">
                      調べた日：{formatDate(c.createdAt)}　進み具合：{decided}/{ctx.items.length} 項目{c.stoppedEarly ? '（赤で打ち切り）' : ''}
                      {latest ? `　確定済み（第${latest.version}版）` : '　未確定'}
                    </div>
                    <CountsBar counts={counts} compact />
                  </div>
                  <div className="flex items-center gap-2">
                    <OverallBadge o={overall} />
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={async () => {
                        if (!window.confirm(`案件「${caseTitle(c)}」を削除しますか？ スクリーンショットも消えます。先にZIPで書き出すことを勧めます。`)) return;
                        await deleteCase(c.id);
                      }}
                    >
                      削除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
