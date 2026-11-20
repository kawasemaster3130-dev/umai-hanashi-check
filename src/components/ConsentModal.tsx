import { useState } from 'react';
import { COLLECT_NOT_SENT, COLLECT_SENDS, collectConfig, collectEnabled } from '../logic/collect';
import { saveSettings } from '../app/store';
import { nowIso } from '../logic/util';

export const CONSENT_POINTS = [
  'この判定は、払うかどうかを決めるための材料です。安全や利益の保証ではありません。',
  'ある会社や人を「詐欺」と決めつけるものではありません。',
  'AIは間違えます。登録の有無・警告の有無は、元のページを自分で開いて確かめてください。',
  '法律の助言ではありません。お金を取り戻したいとき、相手と争うときは相談窓口や弁護士へ。',
  '特定の銘柄や商品を勧めるものではありません。',
  '記録や貼った文章は、この端末の中だけに保存されます。',
];

export function ShareChoice({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="border border-ink bg-paper-3 p-3">
      <div className="mincho font-bold">調べた結果を、{collectConfig.operator}に送りますか？</div>
      <p className="mt-1 text-sm text-ink-2">あぶない話の傾向を知り、アプリを良くするために使います。ほかの目的には使わず、外には出しません。</p>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <div className="font-bold">送るもの</div>
          <ul className="list-disc pl-5">{COLLECT_SENDS.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div>
          <div className="font-bold">送らないもの</div>
          <ul className="list-disc pl-5">{COLLECT_NOT_SENT.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className={`s-choice s-choice-sm ${value ? 's-choice-on' : ''}`} aria-pressed={value} onClick={() => onChange(true)}>送る</button>
        <button type="button" className={`s-choice s-choice-sm ${!value ? 's-choice-on' : ''}`} aria-pressed={!value} onClick={() => onChange(false)}>送らない</button>
      </div>
      <p className="mt-2 text-xs text-ink-3">あとから「設定」でいつでも変えられます。</p>
    </div>
  );
}

export function ConsentModal({ shareOnly = false }: { shareOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(true);
  const ask = collectEnabled();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-ink bg-paper-2 p-5 outline outline-1 outline-offset-4 outline-ink">
        <div className="mb-2 flex items-center gap-3">
          <span className="seal seal-lg text-shu">注</span>
          <h2 id="consent-title" className="h2">
            {shareOnly ? 'お知らせ：結果を送るかどうか' : 'はじめにお読みください'}
          </h2>
        </div>
        {!shareOnly && <p className="mb-3 text-sm text-ink-2">このアプリは、人から勧められた投資の話を、お金を払う前に41項目で点検するためのものです。</p>}
        {!shareOnly && (
          <ul className="mb-4 list-disc space-y-2 border-y border-rule py-3 pl-5 marker:text-shu">
            {CONSENT_POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {ask && (
          <div className="mb-4">
            <ShareChoice value={share} onChange={setShare} />
          </div>
        )}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const now = nowIso();
            await saveSettings(shareOnly ? { share: ask && share, shareAskedAt: now } : { consentedAt: now, ...(ask ? { share, shareAskedAt: now } : {}) });
          }}
        >
          {shareOnly ? '決めた' : '上の注意を読みました。同意して使う'}
        </button>
      </div>
    </div>
  );
}
