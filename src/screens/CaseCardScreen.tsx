import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCaseCtx } from '../app/CaseContext';
import { useCases } from '../app/hooks';
import { StepBar } from '../components/Layout';
import { CopyButton, Field, ListInput, Section, TextArea, TextInput, VerdictBadge } from '../components/ui';
import { Screenshots } from '../components/Screenshots';
import { keywords } from '../data/config';
import { applyAutoHints, computeAutoHints } from '../logic/hints';
import { buildCardPrompt, personalInfoWarnings } from '../logic/prompts';
import { mergeCard, parseCardJson } from '../logic/importers';
import { findCrossMatches } from '../logic/crossref';
import { deepClone, formatDate, isBlank } from '../logic/util';
import type { CaseCard } from '../types';

const BLANK = <span className="text-gray-500">（書かれていない）</span>;

export function CaseCardScreen() {
  const { c, items, update } = useCaseCtx();
  const allCases = useCases();
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'ng'; text: string } | null>(null);
  const [maskWord, setMaskWord] = useState('');
  const [maskLabel, setMaskLabel] = useState('【自分の名前】');
  const k = c.card;
  const setCard = (patch: Partial<CaseCard>) => update((d) => void Object.assign(d.card, patch));

  // 保存のたびに自動の気づきを更新（候補を付けるだけ。判定はしない）
  const cardKey = JSON.stringify(k);
  useEffect(() => {
    const t = setTimeout(() => {
      const h = computeAutoHints(c, keywords, items);
      const probe = deepClone(c);
      const keep = c.updatedAt;
      if (applyAutoHints(probe, h, items)) {
        update((d) => {
          applyAutoHints(d, h, items);
          d.updatedAt = keep; // 候補の付け直しは利用者の変更ではないので、更新日時は動かさない
        });
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.rawMessages, cardKey, items]);

  const hinted = items.filter((it) => (c.items[it.id]?.autoHints?.length ?? 0) > 0);
  const matches = useMemo(() => (allCases ? findCrossMatches(c, allCases) : []), [allCases, c]);
  const blanks = [k.caseName, k.companyNames.length ? 'x' : '', k.claimedRegistrationNo, k.companyAddress || k.companyPhone, k.representative, k.introducer?.name || k.introducer?.snsNames.length ? 'x' : '', k.urls.length ? 'x' : '', k.payee?.accountName || k.payee?.bank || k.payee?.cryptoAddresses.length ? 'x' : '', k.amount, k.promisedReturn, k.withdrawal, k.receivedAt?.date || k.receivedAt?.channel, k.deadline].filter((x) => isBlank(x)).length;
  const prompt = buildCardPrompt(c);
  const piWarn = personalInfoWarnings(prompt);

  return (
    <div className="space-y-4">
      <StepBar />
      <h2 className="h2">ステップ1　案件カードを作る</h2>
      <p className="text-sm text-gray-700">勧誘のやり取りを貼り、13項目に整理します。書かれていないことは「書かれていない」のままにします（空欄が多いこと自体が黄の材料です）。</p>

      <Section title="1. 勧誘のやり取りを貼る（LINE・DM・メール・案内文）">
        <TextArea value={c.rawMessages} onChange={(v) => update((d) => void (d.rawMessages = v))} rows={10} placeholder="ここに、言われたことをそのまま貼ります。画像しかないときは下に添付し、要点を手で打ちます。" />
        <div>
          <div className="label">画像の添付（証拠として保存）</div>
          <Screenshots caseId={c.id} itemId="card" ids={c.attachments.map((a) => a.blobId)} onChange={(ids) => update((d) => void (d.attachments = ids.map((id) => d.attachments.find((a) => a.blobId === id) ?? { blobId: id, name: '' })))} label="画像を添付" />
        </div>
      </Section>

      <Section title="2. 伏せる言葉（AIに渡したくない、自分の名前・電話・住所など）">
        <p className="text-sm text-gray-700">依頼文を作るときに、登録した言葉を「【自分の名前】」などに置き換えます。相手の口座名義・暗号資産アドレスは調べるのに要るので伏せません。</p>
        {c.maskWords.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {c.maskWords.map((m, i) => (
              <li key={i} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-sm">
                <span>{m.word}</span>
                <span className="text-gray-500">→</span>
                <span>{m.label}</span>
                <button type="button" className="ml-1 px-1 text-gray-600" aria-label="削除" onClick={() => update((d) => void d.maskWords.splice(i, 1))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="伏せる言葉（例：山田花子）" value={maskWord} onChange={(e) => setMaskWord(e.target.value)} />
          <select className="input" value={maskLabel} onChange={(e) => setMaskLabel(e.target.value)}>
            {['【自分の名前】', '【自分の電話番号】', '【自分の住所】', '【自分の口座】', '【自分のメール】', '【伏せ字】'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const w = maskWord.trim();
              if (!w) return;
              update((d) => void d.maskWords.push({ word: w, label: maskLabel }));
              setMaskWord('');
            }}
          >
            登録
          </button>
        </div>
      </Section>

      <Section title="3. AIで整理する（任意）">
        <p className="text-sm text-gray-700">依頼文をコピーして、お使いのAI（Claude・ChatGPT・Gemini など）に貼ります。返ってきた答え（JSONつき）を下に貼ると、カードに自動で入ります。手で入力してもかまいません。</p>
        {piWarn.length > 0 && (
          <ul className="note space-y-1">
            {piWarn.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}
        <div className="note-info">貼る前に確認：自分の名前・電話・口座番号が入っていませんか？ 入っていれば上の「伏せる言葉」に登録してください。</div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={prompt} label="依頼文を作ってコピー" className="btn-primary" />
          <details className="w-full">
            <summary className="cursor-pointer text-sm text-gray-700">依頼文を見る</summary>
            <textarea readOnly className="textarea mt-2 min-h-40 text-xs" value={prompt} />
          </details>
        </div>
        <Field label="返ってきた答えを貼る">
          <TextArea value={paste} onChange={setPaste} rows={6} placeholder="AIの答え全体を貼ってかまいません。```json … ``` の部分だけを読みます。" />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!paste.trim()}
            onClick={() => {
              const r = parseCardJson(paste);
              if (!r.ok) {
                setMsg({ kind: 'ng', text: r.error });
                return;
              }
              update((d) => void (d.card = mergeCard(d.card, r.card)));
              setMsg({ kind: 'ok', text: `取り込みました。空いていた欄だけ埋めています。${r.warnings.map((w) => w.message).join(' ')}` });
              setPaste('');
            }}
          >
            取り込む
          </button>
          {msg && <div className={msg.kind === 'ok' ? 'note-info' : 'note-danger'}>{msg.text}</div>}
        </div>
      </Section>

      <Section title="4. 案件カード（13項目）" right={<span className="text-sm text-gray-700">空欄 {blanks} 件</span>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="1. 案件の名前">
            <TextInput value={k.caseName} onChange={(v) => setCard({ caseName: v })} placeholder="例：ゴールドAIプラン" />
          </Field>
          <Field label="3. 会社が名乗っている登録番号">
            <TextInput value={k.claimedRegistrationNo} onChange={(v) => setCard({ claimedRegistrationNo: v })} placeholder="例：関東財務局長（金商）第◯号" />
          </Field>
          <div className="sm:col-span-2">
            <div className="label">2. 勧めている会社の名前（日本語名・英語名・略称を全部）</div>
            <ListInput values={k.companyNames} onChange={(v) => setCard({ companyNames: v })} placeholder="会社名を1つずつ" />
          </div>
          <Field label="4. 会社の住所">
            <TextInput value={k.companyAddress} onChange={(v) => setCard({ companyAddress: v })} />
          </Field>
          <Field label="4. 会社の電話番号">
            <TextInput value={k.companyPhone} onChange={(v) => setCard({ companyPhone: v })} type="tel" />
          </Field>
          <Field label="5. 代表者の名前">
            <TextInput value={k.representative} onChange={(v) => setCard({ representative: v })} />
          </Field>
          <Field label="6. 紹介者の名前">
            <TextInput value={k.introducer?.name} onChange={(v) => setCard({ introducer: { ...(k.introducer ?? { snsNames: [] }), name: v } })} />
          </Field>
          <div>
            <div className="label">6. 紹介者のSNSの表示名</div>
            <ListInput values={k.introducer?.snsNames ?? []} onChange={(v) => setCard({ introducer: { ...(k.introducer ?? { snsNames: [] }), snsNames: v } })} placeholder="表示名・アカウント名" />
          </div>
          <Field label="6. 紹介者と自分との関係">
            <TextInput value={k.introducer?.relation} onChange={(v) => setCard({ introducer: { ...(k.introducer ?? { snsNames: [] }), relation: v } })} placeholder="例：InstagramのDMで知り合った（会ったことはない）" />
          </Field>
          <div className="sm:col-span-2">
            <div className="label">7. サイト・アプリのURL（複数可）</div>
            <ListInput values={k.urls} onChange={(v) => setCard({ urls: v })} placeholder="https://…" />
          </div>
          <Field label="8. 振込先の口座名義">
            <TextInput value={k.payee?.accountName} onChange={(v) => setCard({ payee: { ...(k.payee ?? { cryptoAddresses: [] }), accountName: v } })} placeholder="名義をそのまま（カタカナなど）" />
          </Field>
          <Field label="8. 銀行名・支店・口座番号">
            <TextInput value={k.payee?.bank} onChange={(v) => setCard({ payee: { ...(k.payee ?? { cryptoAddresses: [] }), bank: v } })} />
          </Field>
          <div className="sm:col-span-2">
            <div className="label">8. 暗号資産のアドレス</div>
            <ListInput values={k.payee?.cryptoAddresses ?? []} onChange={(v) => setCard({ payee: { ...(k.payee ?? { cryptoAddresses: [] }), cryptoAddresses: v } })} placeholder="0x… / bc1… / T…" />
          </div>
          <Field label="9. 払う金額">
            <TextInput value={k.amount} onChange={(v) => setCard({ amount: v })} />
          </Field>
          <Field label="13. 「締め切り」と言われた日">
            <TextInput value={k.deadline} onChange={(v) => setCard({ deadline: v })} />
          </Field>
          <Field label="10. 約束されている利益・条件（言われた言葉をそのまま）">
            <TextArea value={k.promisedReturn} onChange={(v) => setCard({ promisedReturn: v })} rows={2} />
          </Field>
          <Field label="11. 出金の方法と条件">
            <TextArea value={k.withdrawal} onChange={(v) => setCard({ withdrawal: v })} rows={2} />
          </Field>
          <Field label="12. 話が来た日">
            <TextInput value={k.receivedAt?.date} onChange={(v) => setCard({ receivedAt: { ...(k.receivedAt ?? {}), date: v } })} placeholder="例：2026-10-10" />
          </Field>
          <Field label="12. 話が来た場所（LINE、DM、セミナーなど）">
            <TextInput value={k.receivedAt?.channel} onChange={(v) => setCard({ receivedAt: { ...(k.receivedAt ?? {}), channel: v } })} />
          </Field>
          <Field label="追加：有名人・有名企業の名前が出ているか（出ていれば名前）" hint="9-3で使います">
            <TextInput value={k.celebrities} onChange={(v) => setCard({ celebrities: v })} placeholder="出ていなければ空欄" />
          </Field>
          <div>
            <div className="label">追加：気になった言い回し（最大3つ。引用のまま）</div>
            <ListInput values={k.notablePhrases} onChange={(v) => setCard({ notablePhrases: v.slice(0, 3) })} placeholder="言われた言葉をそのまま" />
          </div>
        </div>
        <div className="text-xs text-gray-600">空欄は判定の1枚・依頼文では {BLANK} と表示されます。</div>
      </Section>

      <Section title="自動の気づき・過去の案件との照合">
        {hinted.length === 0 ? (
          <p className="text-sm text-gray-700">やり取りと案件カードの文章から、まだ候補は出ていません（候補が出ない＝安全、ではありません）。</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {hinted.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-2">
                <Link className="link font-semibold" to={`/case/${c.id}/check?cat=${it.cat}#item-${it.id}`}>
                  {it.id} {it.question}
                </Link>
                {c.items[it.id].autoHints!.map((h, i) => (
                  <VerdictBadge key={i} v={h.suggest} size="sm" />
                ))}
                <span className="text-xs text-gray-600">候補 {c.items[it.id].autoHints!.length} 件</span>
              </li>
            ))}
          </ul>
        )}
        {matches.length > 0 ? (
          <div className="note-danger space-y-1">
            <div className="font-bold">前にも出てきた値があります</div>
            <ul className="space-y-0.5 text-sm">
              {matches.map((m, i) => (
                <li key={i}>
                  {m.field}「{m.value}」が、案件
                  <Link className="link mx-1 font-semibold" to={`/case/${m.caseId}/sheet`}>
                    {m.caseName}
                  </Link>
                  （{formatDate(m.caseDate)}）の{m.otherField}と一致
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-gray-600">過去の案件（{(allCases?.length ?? 1) - 1}件）との一致はありません。</p>
        )}
      </Section>

      <div className="flex justify-end">
        <Link to={`/case/${c.id}/research`} className="btn-primary">
          ステップ2 AI下調べへ →
        </Link>
      </div>
    </div>
  );
}
