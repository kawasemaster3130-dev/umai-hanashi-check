import { Link, useParams } from 'react-router-dom';
import { PageTitle } from '../components/Layout';
import { LinkList } from '../components/LinkList';
import { guides, links, linksForGuide } from '../data/config';
import { CATEGORIES, getActiveItems } from '../data/checklist';
import { useSettings } from '../app/hooks';

export function GuidesScreen() {
  const { guideId } = useParams();
  const settings = useSettings();
  const items = getActiveItems(settings?.enabledOptionalItems ?? []);
  const g = guideId ? guides.guides.find((x) => x.id === guideId) : undefined;

  if (g) {
    const cats = CATEGORIES.filter((k) => k.guide === g.id);
    const used = items.filter((it) => cats.some((k) => k.no === it.cat));
    return (
      <div className="space-y-4">
        <Link to="/guides" className="link text-sm">
          ← 手引きの一覧
        </Link>
        <PageTitle title={g.title} sub={g.intro} />
        <section className="card space-y-2">
          <h2 className="h3">手順</h2>
          <ol className="list-decimal space-y-1 pl-6">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
        {g.tips.length > 0 && (
          <section className="card space-y-2">
            <h2 className="h3">コツ・注意</h2>
            <ul className="list-disc space-y-1 pl-6">
              {g.tips.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="card space-y-2">
          <h2 className="h3">見る場所（{links.asOf}時点）</h2>
          <LinkList links={linksForGuide(g.id)} />
        </section>
        <section className="card space-y-2">
          <h2 className="h3">この手引きを使う項目</h2>
          <ul className="space-y-1 text-sm">
            {used.map((it) => (
              <li key={it.id}>
                <span className="font-bold">{it.id}</span> {it.question}
              </li>
            ))}
          </ul>
          <div className="text-xs text-gray-600">{used.length ? `${used[0].id}〜${used[used.length - 1].id}` : ''}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTitle title="調べ方の手引き" sub="チェック表の各項目から直接開けます。URLと説明文は設定ファイルから読み込みます。" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {guides.guides.map((x) => {
          const cats = CATEGORIES.filter((k) => k.guide === x.id);
          const used = items.filter((it) => cats.some((k) => k.no === it.cat));
          return (
            <li key={x.id} className="card">
              <Link to={`/guides/${x.id}`} className="h3 link no-underline hover:underline">
                {x.title}
              </Link>
              <p className="mt-1 line-clamp-3 text-sm text-gray-700">{x.intro}</p>
              <div className="mt-1 text-xs text-gray-600">使う項目：{used.length ? `${used[0].id}〜${used[used.length - 1].id}` : '—'}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
