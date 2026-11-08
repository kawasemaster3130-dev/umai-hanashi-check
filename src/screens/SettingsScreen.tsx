import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle } from '../components/Layout';
import { Section } from '../components/ui';
import { useCases, useSettings, ctxFor } from '../app/hooks';
import { deleteAll, saveSettings } from '../app/store';
import { OPTIONAL_ITEMS } from '../data/checklist';
import { contacts, keywords, links, seller, sellerIncomplete, guides } from '../data/config';
import { buildAllZip, describePayload, downloadBlob, existingCaseIds, importPayload, readImportFile } from '../app/exportImport';
import { DEMO_CASE_ID, loadDemoCase } from '../app/demo';
import { CONSENT_POINTS } from '../components/ConsentModal';

export function SettingsScreen() {
  const settings = useSettings();
  const cases = useCases();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = settings?.enabledOptionalItems ?? [];
  const incomplete = sellerIncomplete();

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const payloads = await readImportFile(file, file.name);
      const exist = await existingCaseIds(payloads.map((p) => p.c.id));
      const lines = payloads.map((p) => `・${describePayload(p)}${exist.includes(p.c.id) ? '（同じIDの案件があるので置き換えます）' : ''}`);
      if (!window.confirm(`次の案件を読み込みます。\n${lines.join('\n')}\n\nよろしいですか？`)) return;
      for (const p of payloads) await importPayload(p);
      const warn = payloads.flatMap((p) => p.warnings);
      setMsg(`${payloads.length} 件の案件を読み込みました。${warn.length ? `注意：${warn.join(' ')}` : ''}`);
    } catch (e) {
      setMsg(`読み込めませんでした：${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle title="設定・このアプリについて" />

      <Section title="追加項目（原本にない提案。既定は無効）">
        <p className="text-sm text-ink-2">有効にすると、チェック表に項目が増えます（原本の41項目と数が合わなくなります）。作者の確認後に有効化してください。</p>
        <ul className="space-y-2">
          {OPTIONAL_ITEMS.map((it) => (
            <li key={it.id} className="flex items-start gap-2 rounded-lg border border-rule p-3">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={enabled.includes(it.id)}
                onChange={(e) => saveSettings({ enabledOptionalItems: e.target.checked ? [...enabled, it.id] : enabled.filter((x) => x !== it.id) })}
              />
              <div>
                <div className="font-semibold">
                  {it.id}（分類{it.cat}）{it.question}
                </div>
                <div className="text-sm text-ink-2">
                  {it.red ? `赤：${it.red}　` : ''}
                  {it.yellow ? `黄：${it.yellow}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="データの書き出し・読み込み・全削除">
        <p className="text-sm text-ink-2">データはこの端末の中（ブラウザの保存領域）だけにあります。機種変更やブラウザのデータ消去に備えて、ZIPで書き出しておいてください。</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !cases?.length}
            onClick={async () => {
              if (!cases) return;
              setBusy(true);
              try {
                const { blob, fileName } = await buildAllZip(cases, (c) => ctxFor(c, settings));
                downloadBlob(blob, fileName);
                setMsg(`${fileName} を書き出しました（${cases.length} 件）。`);
              } finally {
                setBusy(false);
              }
            }}
          >
            全案件をZIPで書き出す
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
            読み込む（case.json または ZIP）
          </button>
          <input ref={fileRef} type="file" accept=".zip,.json,application/zip,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              const exist = await existingCaseIds([DEMO_CASE_ID]);
              if (exist.length && !window.confirm('デモの案件はすでにあります。初期の内容に戻しますか？')) return;
              const id = await loadDemoCase(settings);
              navigate(`/case/${id}/sheet`);
            }}
          >
            デモの案件（ゴールドAIプラン）を読み込む
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('すべての案件・スクリーンショット・設定を削除します。元に戻せません。よろしいですか？')) return;
              if (!window.confirm('本当に削除しますか？ 書き出していないデータは失われます。')) return;
              await deleteAll();
              setMsg('すべて削除しました。');
            }}
          >
            全削除（確認2回）
          </button>
        </div>
        {msg && <div className="note-info">{msg}</div>}
      </Section>

      <Section title="自動の気づきの言葉（表示のみ。編集は将来）">
        <p className="text-xs text-ink-3">
          {keywords.note}（{keywords.asOf}時点）
        </p>
        <ul className="space-y-1 text-sm">
          {keywords.rules.map((r) => (
            <li key={r.itemId}>
              <span className="font-bold">{r.itemId}</span>（候補：{r.suggest === 'red' ? '赤' : '黄'}）：{(r.words ?? []).join('、')}
              {r.patterns?.length ? <span className="text-ink-3">　＋パターン {r.patterns.length} 件</span> : null}
            </li>
          ))}
          <li>
            <span className="font-bold">{keywords.celebrityRule.itemId}</span>：{keywords.celebrityRule.note}
          </li>
          <li>
            <span className="font-bold">{keywords.payeeRule.itemId}</span>：{keywords.payeeRule.note}
          </li>
        </ul>
      </Section>

      <Section title="このアプリについて">
        {incomplete && <div className="note-danger font-bold">開発版：販売者情報が未記入です（config/seller.json）。配布前に埋めてください。</div>}
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold">アプリ名・版</dt>
          <dd>
            {seller.appName} v{seller.appVersion}
          </dd>
          <dt className="font-semibold">もとになった教材</dt>
          <dd>{seller.sourceTitle}</dd>
          <dt className="font-semibold">販売者</dt>
          <dd>{seller.seller.name || '（未記入）'}</dd>
          <dt className="font-semibold">代表者</dt>
          <dd>{seller.seller.representative || '（未記入）'}</dd>
          <dt className="font-semibold">所在地</dt>
          <dd>{seller.seller.address || '（未記入）'}</dd>
          <dt className="font-semibold">登録番号</dt>
          <dd>{seller.seller.registrationNo || '（未記入）'}</dd>
          <dt className="font-semibold">業務の種別</dt>
          <dd>{seller.seller.businessType || '（未記入）'}</dd>
          <dt className="font-semibold">加入協会</dt>
          <dd>{seller.seller.association || '（未記入）'}</dd>
          <dt className="font-semibold">問い合わせ先</dt>
          <dd>{seller.seller.contact || '（未記入）'}</dd>
          <dt className="font-semibold">代金</dt>
          <dd>{seller.seller.price || '（未記入）'}</dd>
        </dl>
        <p className="text-xs text-ink-3">教材が教えるとおり、販売者の登録番号は金融庁の一覧で確かめられます（1-1・1-2）。</p>
        <div>
          <div className="font-semibold">免責</div>
          <ul className="list-disc pl-5 text-sm">
            {CONSENT_POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-ink-3">
          URL・電話番号の基準日：調べる場所 {links.asOf}／相談先 {contacts.asOf}／手引き {guides.asOf}。役所のURLは変わることがあります。
        </div>
        <div className="text-xs text-ink-3">同意日：{settings?.consentedAt ? new Date(settings.consentedAt).toLocaleString('ja-JP') : '—'}</div>
      </Section>
    </div>
  );
}
