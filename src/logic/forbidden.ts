// 仕様書 9章：断定する言葉を使わない。画面・書き出し・依頼文の文言をテストで検査する。
// 「詐欺」という単語そのものは、役所のページ名（詐欺的な投資勧誘等にご注意ください）や検索の言葉（原本）に出てくるので禁止しない。
export const FORBIDDEN_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /詐欺(だ|です|である|でした|に違いない|と断定|確定|決定|で間違いない)/, why: '「詐欺だ」と断定する' },
  { re: /詐欺師/, why: '人を「詐欺師」と呼ぶ' },
  { re: /詐欺(業者|会社|集団|グループ|案件|サイト|アプリ|商材)/, why: '相手を「詐欺◯◯」と決めつける' },
  { re: /悪質(な)?(業者|会社|集団)/, why: '「悪質業者」と決めつける' },
  { re: /(インチキ|ペテン|ぼったくり)/, why: '決めつける俗語' },
  { re: /(だまし|騙し)(取|と)(る|られ|った)/, why: '「だまし取る」と断定する' },
];

export function findForbidden(text: string): { match: string; why: string; index: number }[] {
  const out: { match: string; why: string; index: number }[] = [];
  for (const { re, why } of FORBIDDEN_PATTERNS) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      out.push({ match: m[0], why, index: m.index });
      if (m[0].length === 0) g.lastIndex += 1;
    }
  }
  return out;
}
