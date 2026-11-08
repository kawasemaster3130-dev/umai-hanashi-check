// 仕様書 4章「判定のきまり」。アプリのロジックの中心。
import type { Case, ChecklistItem, IdentityKey, ItemResult, Overall, Verdict, VerdictCounts } from '../types';
import { emptyItemResult, VERDICT_LABEL } from '../types';
import type { Rules } from '../data/checklist';

export interface VerdictContext {
  items: ChecklistItem[]; // 有効な項目
  previousNames: string[];
  rules: Rules;
}

export function getResult(items: Record<string, ItemResult>, id: string): ItemResult {
  return items[id] ?? emptyItemResult();
}

// ---------- 4.1 / 4.2 ----------

export function countVerdicts(items: ChecklistItem[], results: Record<string, ItemResult>): VerdictCounts {
  const c: VerdictCounts = { red: 0, yellow: 0, blue: 0, na: 0, unchecked: 0 };
  for (const it of items) c[getResult(results, it.id).verdict] += 1;
  return c;
}

/** 赤が1つ以上→赤。赤0で黄（未調査を含む）1つ以上→黄。それ以外→青 */
export function overallVerdict(counts: VerdictCounts): Overall {
  if (counts.red >= 1) return 'red';
  if (counts.yellow + counts.unchecked >= 1) return 'yellow';
  return 'blue';
}

export function canStopEarly(counts: VerdictCounts): boolean {
  return counts.red >= 1;
}

export function evidenceCount(r: ItemResult): number {
  return r.urls.length + r.screenshots.length + r.quotes.length;
}

// ---------- 4.3 入力チェック ----------

export type ProblemCode =
  | 'red_needs_evidence'
  | 'identity_needs_two'
  | 'na_not_allowed'
  | 'na_needs_reason'
  | 'self_required'
  | 'self_needs_evidence'
  | 'prev_name_unchecked'
  | 'provisional'
  | 'unchecked'
  | 'needs_review';

export interface Problem {
  code: ProblemCode;
  itemId: string;
  message: string;
}

export function isInRecheckRange(ctx: VerdictContext, itemId: string): boolean {
  return ctx.rules.previousNameRecheck.rangeItems.includes(itemId);
}

/** 前の名前での再確認（R8）の進み具合 */
export function previousNameProgress(
  results: Record<string, ItemResult>,
  ctx: VerdictContext,
): { total: number; done: number; missing: { itemId: string; name: string }[] } {
  const missing: { itemId: string; name: string }[] = [];
  let total = 0;
  const range = ctx.rules.previousNameRecheck.rangeItems.filter((id) => ctx.items.some((it) => it.id === id));
  for (const name of ctx.previousNames) {
    for (const id of range) {
      total += 1;
      if (!getResult(results, id).previousNameChecked?.[name]) missing.push({ itemId: id, name });
    }
  }
  return { total, done: total - missing.length, missing };
}

/** 判定を「この値にする」ときに、その場で止める条件（赤の証拠、同一人物の手がかり、該当なしの理由、4-4の青） */
export function validateVerdictChange(
  item: ChecklistItem,
  current: ItemResult,
  next: Verdict,
  ctx: VerdictContext,
  patch: Partial<ItemResult> = {},
  allResults: Record<string, ItemResult> = {},
): Problem[] {
  const r: ItemResult = { ...current, ...patch };
  const problems: Problem[] = [];
  if (next === 'red') {
    if (evidenceCount(r) < 1) {
      problems.push({
        code: 'red_needs_evidence',
        itemId: item.id,
        message: `${item.id} を赤にするには、見たURL・スクリーンショット・やり取りからの引用のどれか1つ以上を先に入れてください。`,
      });
    }
    if (item.identityCheck) {
      const n = (r.identityMatches ?? []).length;
      if (n < 2) {
        problems.push({
          code: 'identity_needs_two',
          itemId: item.id,
          message: `${item.id} を赤にするには、同じ人物の手がかり（会社名・地名・時期・SNSアカウント）を2つ以上チェックしてください。1つ以下なら黄（同じ人と確かめられなかった）にします。`,
        });
      }
    }
  }
  if (next === 'na') {
    if (!item.naAllowed) {
      problems.push({ code: 'na_not_allowed', itemId: item.id, message: `${item.id} は「該当なし」にできない項目です。` });
    }
    if (!r.naReason || !r.naReason.trim()) {
      problems.push({ code: 'na_needs_reason', itemId: item.id, message: `${item.id} を「該当なし」にするには理由を書いてください。` });
    }
  }
  if (next === 'blue' && item.id === ctx.rules.previousNameRecheck.dependentItem && ctx.previousNames.length > 0) {
    const p = previousNameProgress(allResults, ctx);
    if (p.missing.length > 0) {
      const first = p.missing[0];
      problems.push({
        code: 'prev_name_unchecked',
        itemId: item.id,
        message: `${item.id} を青にするには、前の名前「${first.name}」で ${ctx.rules.previousNameRecheck.rangeItems[0]}〜${ctx.rules.previousNameRecheck.rangeItems.at(-1)} をもう一度確かめ、「前の名前でも確認」を全部チェックしてください（残り ${p.missing.length} 件）。`,
      });
    }
  }
  return problems;
}

/** いまの判定が 4.3 の条件を満たしているか（確定前の点検。判定を入れたあとに証拠を消した場合などもここで拾う） */
export function validateResult(
  item: ChecklistItem,
  r: ItemResult,
  ctx: VerdictContext,
  allResults: Record<string, ItemResult>,
): Problem[] {
  if (r.verdict === 'unchecked') return [];
  const problems = validateVerdictChange(item, r, r.verdict, ctx, {}, allResults);
  if (item.selfRequired) {
    if (r.checkedBy !== 'self') {
      problems.push({
        code: 'self_required',
        itemId: item.id,
        message: `${item.id} は自分で一覧を開いて確かめ、「確認した人：自分」にしてください（AIの下調べのままでは確定できません）。`,
      });
    }
    if (evidenceCount(r) < 1) {
      problems.push({
        code: 'self_needs_evidence',
        itemId: item.id,
        message: `${item.id} は、見たURLかスクリーンショットを1つ以上残してください。`,
      });
    }
  }
  return problems;
}

/** 判定を適用する（検証は呼び出し側で済ませる） */
export function applyVerdict(r: ItemResult, next: Verdict, patch: Partial<ItemResult>, now: string): ItemResult {
  const out: ItemResult = { ...r, ...patch, verdict: next, provisional: false, updatedAt: now };
  if (next !== 'na') out.naReason = patch.naReason ?? r.naReason;
  return out;
}

export function toggleIdentity(r: ItemResult, key: IdentityKey): IdentityKey[] {
  const cur = r.identityMatches ?? [];
  return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
}

// ---------- 4.4 確定できる条件 ----------

export interface Blocker {
  code: ProblemCode | 'incomplete' | 'stop_without_red' | 'review_pending' | 'skip_needs_reason';
  message: string;
  itemId?: string;
  category?: number;
}

export function confirmBlockers(c: Case, ctx: VerdictContext): Blocker[] {
  const out: Blocker[] = [];
  const counts = countVerdicts(ctx.items, c.items);

  // 1. すべて未調査以外 または 赤で打ち切り
  if (c.stoppedEarly && counts.red < 1) {
    out.push({ code: 'stop_without_red', message: '「赤で打ち切る」は赤が1つ以上あるときだけ使えます。打ち切りを取り消してください。' });
  }
  if (!c.stoppedEarly || counts.red < 1) {
    for (const it of ctx.items) {
      if (getResult(c.items, it.id).verdict === 'unchecked') {
        out.push({ code: 'unchecked', itemId: it.id, message: `${it.id} が未調査です。判定を入れるか、赤があれば「赤で打ち切る」を使ってください。` });
      }
    }
  }

  // 2. 4.3の条件
  for (const it of ctx.items) {
    for (const p of validateResult(it, getResult(c.items, it.id), ctx, c.items)) out.push({ ...p });
  }

  // 3. 仮の判定が残っていない
  for (const it of ctx.items) {
    const r = getResult(c.items, it.id);
    if (r.provisional && r.verdict !== 'unchecked') {
      out.push({ code: 'provisional', itemId: it.id, message: `${it.id} はAIの下調べからの「仮」の判定のままです。自分で確かめて確定してください。` });
    }
  }

  // 4. 見落としチェック
  if (c.review.status === 'pending') {
    out.push({ code: 'review_pending', message: '見落としチェック（ステップ6）を実施するか、理由を書いて省略にしてください。' });
  } else if (c.review.status === 'skipped' && !c.review.skipReason?.trim()) {
    out.push({ code: 'skip_needs_reason', message: '見落としチェックを省略する理由を書いてください。' });
  }

  // 5. 指摘を受けた分類は全項目「見直し済み」
  for (const cat of c.review.flaggedCategories) {
    for (const it of ctx.items.filter((x) => x.cat === cat)) {
      if (!getResult(c.items, it.id).reviewed) {
        out.push({ code: 'needs_review', itemId: it.id, category: cat, message: `分類${cat}に見落としの指摘があったので、${it.id} を見直して「見直し済み」にしてください。` });
      }
    }
  }

  // 同じ項目・同じ理由の重複を落とす
  const seen = new Set<string>();
  return out.filter((b) => {
    const k = `${b.code}:${b.itemId ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------- 4.5 結論の1文 ----------

export function yellowItems(items: ChecklistItem[], results: Record<string, ItemResult>): ChecklistItem[] {
  return items.filter((it) => {
    const v = getResult(results, it.id).verdict;
    return v === 'yellow' || v === 'unchecked';
  });
}

export function conclusionSentence(overall: Overall, yellows: ChecklistItem[], max = 5): string {
  if (overall === 'red') return '赤が1つ以上あるので、払いません。';
  if (overall === 'yellow') {
    const list = yellows.slice(0, max).map((it) => `${it.id} ${it.question}`).join('／');
    const more = yellows.length > max ? `（ほか${yellows.length - max}件）` : '';
    return `確かめ終わるまで払いません。確かめること：${list}${more}`;
  }
  return '大きな問題は見つかりませんでした。これは安全の保証ではありません。払うかどうかは自分で決めます。';
}

export function overallLabel(o: Overall): string {
  return VERDICT_LABEL[o];
}

export const OVERALL_MEANING: Record<Overall, string> = {
  red: 'やめる',
  yellow: '確かめるまで払わない',
  blue: '大きな問題は見つからなかった（保証ではない）',
};
