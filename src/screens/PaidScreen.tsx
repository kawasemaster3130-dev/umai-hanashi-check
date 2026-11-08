import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCaseCtx, type CaseCtxValue } from '../app/CaseContext';
import { StepBar, PageTitle } from '../components/Layout';
import { ExternalLink, Field, Section, TextArea, TextInput } from '../components/ui';
import { Screenshots } from '../components/Screenshots';
import { contacts } from '../data/config';
import type { PaidRecord } from '../types';
import { getResult } from '../logic/verdict';
import { nowIso, ymd } from '../logic/util';
import { createCase } from '../app/store';

const EMPTY: PaidRecord = { consulted: [], screenshots: [] };

export function ContactsList() {
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {contacts.contacts.map((k) => (
          <li key={k.name} className="rounded-lg border border-gray-300 bg-white px-3 py-2">
            <div className="font-semibold">{k.name}</div>
            <div className="flex flex-wrap items-center gap-2">
              <a className="btn-secondary btn-sm" href={`tel:${k.tel.replace(/[^\d#+*]/g, '')}`}>
                📞 {k.tel}
              </a>
              {k.altTel && (
                <a className="btn-secondary btn-sm" href={`tel:${k.altTel.replace(/[^\d#+*]/g, '')}`}>
                  IP電話から {k.altTel}
                </a>
              )}
              {k.note && <span className="text-sm text-gray-700">{k.note}</span>}
            </div>
          </li>
        ))}
      </ul>
      <div className="text-xs text-gray-600">
        番号は{contacts.asOf}時点。{contacts.note}
      </div>
    </div>
  );
}

export function PaidGuide({ ctx }: { ctx?: CaseCtxValue }) {
  const c = ctx?.c;
  const p: PaidRecord = c?.alreadyPaid ?? EMPTY;
  const setP = (patch: Partial<PaidRecord>) => ctx?.update((d) => void (d.alreadyPaid = { ...(d.alreadyPaid ?? EMPTY), ...patch }));
  const [where, setWhere] = useState('');
  const [date, setDate] = useState(ymd());
  const withdrawalItem = ctx?.ctx.rules.withdrawalItem ?? '7-5';
  const wr = c ? getResult(c.items, withdrawalItem) : undefined;
  const dateInput = (value: string | undefined, onChange: (v: string) => void) => <input type="date" className="input !w-auto" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={!ctx} />;

  return (
    <div className="space-y-4">
      <div className="note-danger font-semibold">二次被害に注意：「取り戻します」「返金を手伝います」と連絡してくる業者には応じません。金融庁の職員が勧誘や被害調査の電話をかけてくることはありません。弁護士は自分で弁護士会・法テラスから探します。</div>
      {!ctx && <div className="note">案件を作っていなくても読めます。日付を記録するには、ホームで「新しく調べる」から案件を作ってください。</div>}

      <Section title="1. 追加では払わない">
        <p className="text-sm">出金の手数料・税金・保証金も払いません。「払えば出金できる」は、払わせるための条件です。</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          追加で払わないと決めた日：{dateInput(p.stoppedPaying, (v) => setP({ stoppedPaying: v }))}
        </div>
        <Field label="払ってしまった金額（分かれば）">
          <input className="input sm:max-w-xs" value={p.paidAmount ?? ''} onChange={(e) => setP({ paidAmount: e.target.value })} disabled={!ctx} />
        </Field>
      </Section>

      <Section title="2. 少額で出金を試す">
        <p className="text-sm">出せない、または新しい条件（手数料・税金・保証金）が出てきたら、7-5を赤にします。</p>
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-2 text-sm">試した日：{dateInput(p.withdrawalTest?.date, (v) => setP({ withdrawalTest: { ...(p.withdrawalTest ?? {}), date: v } }))}</div>
          <TextInput value={p.withdrawalTest?.result} onChange={(v) => setP({ withdrawalTest: { ...(p.withdrawalTest ?? {}), result: v } })} placeholder="結果（例：出金申請から3日たっても振り込まれない。手数料を先に払えと言われた）" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={!!p.withdrawalTest?.failed} disabled={!ctx} onChange={(e) => setP({ withdrawalTest: { ...(p.withdrawalTest ?? {}), failed: e.target.checked } })} />
          出せなかった／新しい条件が出た
        </label>
        {ctx && c && p.withdrawalTest?.failed && wr?.verdict !== 'red' && (
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (!window.confirm(`${withdrawalItem}（出金の条件）を赤にしますか？ 出金の結果を引用として残します。`)) return;
              ctx.update((d) => {
                const cur = getResult(d.items, withdrawalItem);
                const q = `出金を試した結果（${p.withdrawalTest?.date ?? ymd()}）：${p.withdrawalTest?.result ?? '出せなかった'}`;
                d.items[withdrawalItem] = { ...cur, verdict: 'red', provisional: false, checkedBy: 'self', quotes: cur.quotes.includes(q) ? cur.quotes : [...cur.quotes, q], updatedAt: nowIso() };
              });
            }}
          >
            {withdrawalItem} を赤にする
          </button>
        )}
        {wr?.verdict === 'red' && <div className="text-sm text-v-red">{withdrawalItem} は赤になっています。</div>}
      </Section>

      <Section title="3. やり取りを保存する">
        <p className="text-sm">トーク画面・振込の控え・相手の名前/ID/電話・URL・日時。消される前に残します。</p>
        <TextArea value={p.savedEvidence} onChange={(v) => setP({ savedEvidence: v })} rows={3} placeholder="何をどこに保存したか（例：LINEのトークをスクリーンショットで30枚、振込の控え1枚）" />
        {ctx && c && (
          <div>
            <div className="label">このアプリの証拠フォルダに入れる（スクリーンショット）</div>
            <Screenshots caseId={c.id} itemId="paid" ids={p.screenshots} onChange={(ids) => setP({ screenshots: ids })} />
          </div>
        )}
      </Section>

      <Section title="4. 相談先（電話はタップでかけられます）">
        <ContactsList />
        {ctx && (
          <div className="space-y-2">
            <div className="label">相談した窓口と日付を記録</div>
            {p.consulted.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {p.consulted.map((x, i) => (
                  <li key={i}>
                    {x.where}（{x.date}）{' '}
                    <button type="button" className="text-xs underline" onClick={() => setP({ consulted: p.consulted.filter((_, j) => j !== i) })}>
                      外す
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <select className="input sm:!w-auto" value={where} onChange={(e) => setWhere(e.target.value)}>
                <option value="">窓口を選ぶ</option>
                {contacts.contacts.map((k) => (
                  <option key={k.name}>{k.name}</option>
                ))}
                <option>振り込んだ銀行</option>
                <option>弁護士・法テラス</option>
                <option>その他</option>
              </select>
              <input type="date" className="input !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
              <button type="button" className="btn-secondary" disabled={!where} onClick={() => setP({ consulted: [...p.consulted, { where, date }] })}>
                記録
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="5. 振り込んだ銀行にすぐ連絡">
        <p className="text-sm">振込先の口座の凍結や、組戻しを相談します。早いほど可能性があります。</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">連絡した日：{dateInput(p.bankContacted, (v) => setP({ bankContacted: v }))}</div>
      </Section>

      <Section title="6. 弁護士は自分で探す">
        <p className="text-sm">{contacts.lawyer.note}</p>
        <ul className="list-disc pl-5 text-sm">
          {contacts.lawyer.links.map((l) => (
            <li key={l.url}>
              <ExternalLink href={l.url}>{l.name}</ExternalLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="紹介型のEA（自動売買）を、それでも続けると決めた人へ">
        <p className="text-sm font-semibold">まず、やめることを勧めます。続けるなら、次の3つは「勧めているのではなく、被害を小さくするための約束」です。</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>複利で回さない（利益を元本に足さない）。</li>
          <li>利益は毎日出金する。出金できなくなった日が、やめる日。</li>
          <li>まず入金分を取り戻す。取り戻すまで追加で入れない。</li>
        </ol>
      </Section>
    </div>
  );
}

export function PaidScreen() {
  const ctx = useCaseCtx();
  return (
    <div className="space-y-4">
      <StepBar />
      <h2 className="h2">すでに払ってしまったとき</h2>
      <PaidGuide ctx={ctx} />
      <div className="flex justify-start">
        <Link to={`/case/${ctx.c.id}/next`} className="btn-secondary">
          ← ステップ8へ戻る
        </Link>
      </div>
    </div>
  );
}

export function PaidStandalone() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <PageTitle title="すでに払ってしまった人へ" sub="案件を作っていなくても読めます。記録を残すには案件を作ります。" />
      <button
        type="button"
        className="btn-primary"
        onClick={async () => {
          const c = await createCase();
          navigate(`/case/${c.id}/paid`);
        }}
      >
        案件を作って記録する
      </button>
      <PaidGuide />
    </div>
  );
}
