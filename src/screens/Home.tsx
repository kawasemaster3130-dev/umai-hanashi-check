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
      <PageTitle title="うまい話チェック" sub="人から勧められた投資の話を、お金を払う前に41項目で点検し、赤・黄・青の判定の1枚と証拠を残します。" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-lg" onClick={newCase}>
          ＋ 新しく調べる
        </button>
        <Link to="/paid" className="btn-danger">
          すでに払ってしまった人へ
        </Link>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="note-info">本当にもうかる話が、自分のところに来ることはありません。</div>
        <div className="note-info">一番大事なのは、売っている人と会社の過去。あわせて国の登録を確かめます。</div>
        <div className="note-info">AIは間違えます。登録の有無は必ず自分で一覧を開きます。</div>
      </div>

      <section className="card space-y-2">
        <label className="block">
          <span className="label">過去の案件を横断検索（会社名・人名・SNS表示名・口座名義・URL・電話・暗号資産アドレス）</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="例：会社名、口座名義、ドメイン" />
        </label>
        {results && (
          <ul className="space-y-1 text-sm">
            {results.length === 0 && <li className="text-gray-600">一致する案件はありません。</li>}
            {results.map(({ c, hits }) => (
              <li key={c.id}>
                <Link className="link font-semibold" to={`/case/${c.id}/sheet`}>
                  {caseTitle(c)}
                </Link>
                <span className="ml-2 text-gray-700">{hits.map((h) => `${h.field}：${h.value}`).join('、')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="h2">案件の一覧</h2>
        {!cases ? (
          <Spinner />
        ) : cases.length === 0 ? (
          <div className="card space-y-3">
            <p>まだ案件がありません。「新しく調べる」から始めるか、教材の通しの例（デモ）を読み込んで画面の流れを確かめられます。</p>
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
                    <div className="text-sm text-gray-700">
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
