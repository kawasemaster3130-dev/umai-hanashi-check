import type { Case } from '../types';
import type { LinkDef } from '../data/config';
import { resolveLinkUrl } from '../logic/search';
import { CopyButton, ExternalLink } from './ui';

/** 調べる場所のリンク一覧。案件の値で開きやすくする（Wayback の URL、ドメインのコピーなど） */
export function LinkList({ links, c, compact }: { links: LinkDef[]; c?: Case; compact?: boolean }) {
  if (!links.length) return <p className="text-sm text-ink-3">この手引きは外のサイトを見ません。手元のやり取りと案件カードで判定します。</p>;
  const names = c?.card.companyNames.filter(Boolean) ?? [];
  return (
    <div className="space-y-2">
    {names.length > 0 && !compact && (
      <div className="flex flex-wrap items-center gap-1 text-sm text-ink-2">
        会社名をコピー → 開く → Ctrl+F（スマホは「ページ内検索」）：
        {names.map((n) => (
          <CopyButton key={n} text={n} label={n} className="btn-secondary btn-sm !min-h-7 !py-0 text-xs" done="コピー済" />
        ))}
      </div>
    )}
    <ul className="space-y-2">
      {links.map((l) => {
        const resolved = c ? resolveLinkUrl(l, c) : [{ url: l.url }];
        return (
          <li key={l.key} className={`border-b border-dotted border-rule ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ExternalLink href={resolved[0].url} className="link font-semibold">
                {l.name}
              </ExternalLink>
              {l.official === false && <span className="chip bg-paper-3 text-xs font-normal text-ink-2">公式ではない</span>}
              {l.pc && <span className="chip bg-paper-3 text-xs font-normal text-ink-2">パソコン推奨</span>}
            </div>
            {l.how && <div className="text-sm text-ink-2">{l.how}</div>}
            {resolved.length > 1 || (resolved[0].param && resolved[0].url !== l.url) ? (
              <ul className="mt-1 space-y-1 text-sm">
                {resolved.map((r) => (
                  <li key={r.url} className="flex flex-wrap items-center gap-2">
                    <ExternalLink href={r.url}>{r.param ?? r.url}</ExternalLink>
                    {r.param && <CopyButton text={r.param} label="コピー" className="btn-secondary btn-sm !min-h-7 !py-0 text-xs" />}
                  </li>
                ))}
              </ul>
            ) : null}
            {l.paramHint === 'domain' && c && resolved.length === 1 && !resolved[0].param ? <div className="text-xs text-ink-3">案件カードにサイトのURLを入れると、ここにドメインが出ます。</div> : null}
          </li>
        );
      })}
    </ul>
    </div>
  );
}
