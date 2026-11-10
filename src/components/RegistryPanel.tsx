import type { RegistryLookup } from '../logic/registry';
import { SOURCE_LABEL } from '../logic/registry';
import { formatDate } from '../logic/util';

/** 金融庁の一覧の写しと照合した結果（参考） */
export function RegistryPanel({ r, big }: { r: RegistryLookup; big?: boolean }) {
  if (!r.available) return null;
  const nothing = !r.registered.length && !r.warned.length && !r.numberOwners.length && !r.notFoundNames.length;
  if (nothing) return null;
  return (
    <div className={`k-list ${big ? '' : '!text-base'}`}>
      <div className="k-list-title">金融庁の一覧とくらべた結果</div>
      {r.warned.length > 0 && (
        <div className="note-danger mb-2 space-y-1">
          <div className="mincho text-lg font-extrabold">警告の一覧に載っています（{r.warned.length}件）</div>
          {r.warned.map((w, i) => (
            <div key={i} className="border-t border-shu/40 pt-1">
              <div className="font-bold">{w.name}</div>
              <div className="text-sm">
                {w.what}
                {w.when ? `（${w.when}・${w.where ?? ''}）` : ''}
              </div>
              {w.note && <div className="text-sm text-ink-2">{w.note}</div>}
            </div>
          ))}
        </div>
      )}
      {r.numberOwners.map((x) => (
        <div key={x.no} className={`${x.owner && x.matchesName ? 'note-info' : 'note-danger'} mb-2`}>
          <div className="font-bold">言われた登録番号：{x.no}</div>
          {x.owner ? (
            <div>
              この番号の持ち主は「{x.owner.name}」です。{x.matchesName ? '名乗っている会社と同じです。' : '名乗っている会社と違います（番号だけ借りた、なりすましのおそれ）。'}
            </div>
          ) : (
            <div>この番号は、登録の一覧に見つかりません。</div>
          )}
        </div>
      ))}
      {r.registered.length > 0 && (
        <div className="note-info mb-2 space-y-1">
          <div className="mincho text-lg font-extrabold">登録の一覧にあります（{r.registered.length}件）</div>
          {r.registered.map((e) => (
            <div key={e.s + e.no} className="border-t border-ai/40 pt-1">
              <div className="font-bold">{e.name}</div>
              <div className="text-sm">
                {SOURCE_LABEL[e.s] ?? e.s}／{e.no}
              </div>
              {e.types.length > 0 && <div className="text-sm font-bold">できる仕事：{e.types.join('・')}</div>}
              {(e.assoc?.length ?? 0) > 0 && <div className="text-sm">加入している協会：{e.assoc!.join('・')}</div>}
              {(e.addr || e.tel) && (
                <div className="text-sm">
                  {e.addr}
                  {e.tel ? `　電話 ${e.tel}` : ''}
                </div>
              )}
            </div>
          ))}
          <div className="text-sm font-bold">名前をかたる「なりすまし」があります。相手の住所・電話番号が上と同じか見比べてください。「できる仕事」が投資助言・代理業だけなのに「お金を預かる」と言うなら、合っていません。</div>
        </div>
      )}
      {r.notFoundNames.length > 0 && (
        <div className="note mb-2">
          <div className="mincho text-lg font-extrabold">登録の一覧に見つかりません</div>
          <div>{r.notFoundNames.map((n) => `「${n}」`).join('')}</div>
          <div className="text-sm">金融商品取引業者・暗号資産交換業者の一覧の中にありません。正式な名前・英語名でも入れてみてください。不動産や貸金など、ほかの登録は入っていません。</div>
        </div>
      )}
      <div className="text-xs text-ink-3">
        金融庁の一覧を{r.fetchedAt ? formatDate(r.fetchedAt) : ''}に取り込んだ写しとくらべています（週に1回取り直します）。参考です。最後は下のボタンで本物の一覧を見てください。
      </div>
    </div>
  );
}
