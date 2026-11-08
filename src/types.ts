// 仕様書 6.2 のデータの形。仕様からの違いはコメントで示す。

export type Verdict = 'red' | 'yellow' | 'blue' | 'na' | 'unchecked';
export type CheckedBy = 'ai' | 'self';
export type Overall = 'red' | 'yellow' | 'blue';
export type IdentityKey = 'company' | 'place' | 'period' | 'sns';
export type ItemSource = 'search' | 'self' | 'card';

/** checklist_items.json の1項目 */
export interface ChecklistItem {
  id: string;
  cat: number;
  question: string;
  where: string;
  red: string | null;
  yellow: string | null;
  source: ItemSource;
  selfRequired: boolean;
  naAllowed: boolean;
  naHint?: string;
  identityCheck?: boolean;
  status?: string; // 追加提案の項目だけ
}

export interface ChecklistCategory {
  no: number;
  title: string;
  guide: string;
}

/** AIに渡すときに伏せる言葉。仕様では string[] だが、置き換え先の表示（【自分の名前】など）を持たせるため対にした */
export interface MaskWord {
  word: string;
  label: string;
}

export interface Case {
  id: string; // uuid
  createdAt: string; // ISO
  updatedAt: string;
  investigator?: string; // 調べた人
  card: CaseCard;
  rawMessages: string; // 貼り付けた勧誘のやり取り（全文）
  maskWords: MaskWord[];
  items: Record<string, ItemResult>; // key = '1-1' など
  previousNames: string[]; // 前の会社名（4-2で見つけたもの）
  aiResearchRaw?: string; // ステップ2でAIから返った全文
  researchStatus?: 'pending' | 'done' | 'skipped'; // ステップ2を省略したか（仕様S2-5）
  reviewRaw?: string; // ステップ6でAIから返った全文
  review: ReviewState;
  stoppedEarly: boolean; // 赤で打ち切り
  alreadyPaid?: PaidRecord;
  snapshots: SheetSnapshot[]; // 確定した判定の1枚の版
  attachments: Attachment[]; // 案件カードに添付した画像（証拠として保存）
}

export interface ReviewState {
  status: 'pending' | 'done' | 'skipped';
  skipReason?: string;
  flaggedCategories: number[];
  findings: ReviewFinding[];
  doneAt?: string;
}

export type ReviewFindingType = 'no_url' | 'not_found_as_safe' | 'should_be_red' | 'name_only_match' | 'other';

export interface ReviewFinding {
  id: string; // 項目ID
  type: ReviewFindingType;
  comment: string;
}

export interface CaseCard {
  caseName?: string;
  companyNames: string[]; // 日本語名・英語名・略称
  claimedRegistrationNo?: string;
  companyAddress?: string;
  companyPhone?: string;
  representative?: string;
  introducer?: { name?: string; snsNames: string[]; relation?: string };
  urls: string[];
  payee?: { accountName?: string; bank?: string; cryptoAddresses: string[] };
  amount?: string;
  promisedReturn?: string; // 言われた言葉そのまま
  withdrawal?: string;
  receivedAt?: { date?: string; channel?: string };
  deadline?: string;
  celebrities?: string; // 有名人・有名企業の名前
  notablePhrases: string[]; // 気になった言い回し（最大3）
}

export interface AutoHint {
  suggest: 'red' | 'yellow';
  quote: string;
  note?: string;
}

/** ステップ2でAIから取り込んだ、この項目の下調べの結果（表示用。判定とは別に残す） */
export interface AiItemResult {
  status: 'found' | 'not_found' | 'could_not_check' | 'na' | 'unknown';
  verdict: Verdict; // 取り込みのきまりを適用したあとの判定
  rawVerdict?: string; // AIが書いた判定そのまま
  result: string;
  urls: string[];
  naReason?: string;
  warnings: string[];
  importedAt: string;
}

export interface ItemResult {
  verdict: Verdict;
  provisional: boolean; // AI下調べ由来で未確定
  checkedBy?: CheckedBy;
  memo?: string;
  naReason?: string;
  urls: { url: string; viewedAt: string }[];
  screenshots: string[]; // Blob の id
  quotes: string[]; // やり取りからの引用
  identityMatches?: IdentityKey[]; // 5-1〜5-3
  previousNameChecked?: Record<string, boolean>; // 2-1〜3-4: 前の名前ごと
  reviewed?: boolean; // 見落とし指摘後の見直し済み
  autoHints?: AutoHint[];
  ai?: AiItemResult;
  updatedAt?: string;
}

export interface PaidRecord {
  paidAmount?: string;
  stoppedPaying?: string; // 日付
  withdrawalTest?: { date?: string; result?: string; failed?: boolean };
  savedEvidence?: string;
  consulted: { where: string; date: string }[];
  bankContacted?: string;
  screenshots: string[]; // Blob の id
}

export interface Attachment {
  blobId: string;
  name: string;
}

export interface SheetSnapshot {
  version: number;
  confirmedAt: string;
  counts: VerdictCounts;
  overall: Overall;
  html: string; // その時点の判定の1枚（HTML全体）
}

export interface VerdictCounts {
  red: number;
  yellow: number;
  blue: number;
  na: number;
  unchecked: number;
}

export interface StoredBlob {
  id: string;
  caseId: string;
  itemId: string; // 項目ID、'card'、'paid'
  name: string;
  type: string;
  blob: Blob;
  createdAt: string;
}

export interface AppSettings {
  consentedAt?: string;
  enabledOptionalItems: string[]; // X-1 など
  investigatorDefault?: string;
}

export const DEFAULT_SETTINGS: AppSettings = { enabledOptionalItems: [] };

export const VERDICT_LABEL: Record<Verdict, string> = {
  red: '赤',
  yellow: '黄',
  blue: '青',
  na: '該当なし',
  unchecked: '未調査',
};

export const VERDICT_ICON: Record<Verdict, string> = {
  red: '✕',
  yellow: '△',
  blue: '○',
  na: '－',
  unchecked: '？',
};

export const VERDICT_MEANING: Record<Verdict, string> = {
  red: 'やめる理由になる事実が見つかった',
  yellow: '確かめ終わるまで払わない（調べられなかった項目も黄）',
  blue: '大きな問題は見つからなかった（保証ではない）',
  na: 'この項目は当てはまらない（理由を書く）',
  unchecked: 'まだ判定していない（黄として数える）',
};

export const IDENTITY_LABEL: Record<IdentityKey, string> = {
  company: '会社名',
  place: '地名',
  period: '時期',
  sns: 'SNSアカウント',
};

export function emptyItemResult(): ItemResult {
  return { verdict: 'unchecked', provisional: false, urls: [], screenshots: [], quotes: [] };
}

export function emptyCard(): CaseCard {
  return { companyNames: [], urls: [], notablePhrases: [], introducer: { snsNames: [] }, payee: { cryptoAddresses: [] } };
}

export function newCase(id: string, now: string): Case {
  return {
    id,
    createdAt: now,
    updatedAt: now,
    card: emptyCard(),
    rawMessages: '',
    maskWords: [],
    items: {},
    previousNames: [],
    review: { status: 'pending', flaggedCategories: [], findings: [] },
    stoppedEarly: false,
    snapshots: [],
    attachments: [],
  };
}
