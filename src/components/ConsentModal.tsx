import { useState } from 'react';
import { saveSettings } from '../app/store';
import { nowIso } from '../logic/util';

export const CONSENT_POINTS = [
  'この判定は、払うかどうかを決めるための材料です。安全や利益の保証ではありません。',
  'ある会社や人を「詐欺」と決めつけるものではありません。',
  'AIは間違えます。登録の有無・警告の有無は、元のページを自分で開いて確かめてください。',
  '法律の助言ではありません。お金を取り戻したいとき、相手と争うときは相談窓口や弁護士へ。',
  '特定の銘柄や商品を勧めるものではありません。',
  '入力したデータは、この端末の中だけに保存されます。サーバーには送りません。',
];

export function ConsentModal() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-ink bg-paper-2 p-5 outline outline-1 outline-offset-4 outline-ink">
        <div className="mb-2 flex items-center gap-3">
          <span className="seal seal-lg text-shu">注</span>
          <h2 id="consent-title" className="h2">
            はじめにお読みください
          </h2>
        </div>
        <p className="mb-3 text-sm text-ink-2">このアプリは、人から勧められた投資の話を、お金を払う前に41項目で点検するためのものです。</p>
        <ul className="mb-4 space-y-2 border-y border-rule py-3 pl-5 list-[\'一\'] marker:text-shu">
          {CONSENT_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await saveSettings({ consentedAt: nowIso() });
          }}
        >
          上の注意を読みました。同意して使う
        </button>
      </div>
    </div>
  );
}
