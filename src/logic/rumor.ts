// 口コミ・うわさ：AIにウェブを調べさせて、出どころつきでまとめさせる（設定でAPIキーを入れた人だけ。試験的）
import { extractJson } from './importers';

export interface RumorItem {
  text: string;
  url?: string;
  when?: string;
  level: 'red' | 'yellow' | 'none';
}
export interface RumorReport {
  summary: string;
  career: RumorItem[]; // これまでの経歴
  reviews: RumorItem[]; // 口コミ
  rumors: RumorItem[]; // 悪いうわさ・被害の話
  notes: string[]; // 同じ名前の別の会社かもしれない、など
}

export const RUMOR_MODEL_DEFAULT = 'claude-sonnet-5-5';

export function buildRumorPrompt(names: string[], official: string): string {
  return `あなたは、投資の勧誘を受けた人のために、公開されている情報をウェブ検索で調べる係です。

【調べる名前】${names.map((n) => `「${n}」`).join('')}
【国の記録で分かっていること】${official || '（なし）'}

次の3つを、ウェブ検索で調べてください。
1. これまでの経歴（いつからあるか、何をしてきたか、代表者、前の名前）
2. 口コミ・評判（利用した人の声。良いものも悪いものも）
3. 悪いうわさ・被害の話（返金されない、出金できない、行政の処分、裁判、被害者の会 など）

守ること：
- 出どころのURLを示せることだけを書く。URLがないことは書かない。
- 見つからなければ、その欄は空にする。見つからないことは安全という意味ではない。
- 同じ名前の別の会社・別の人かもしれないときは、level を "yellow" にして、notes にそう書く。会社名・場所・時期のうち2つ以上が合ってはじめて同じ相手とみなす。
- 相手を決めつける言葉は使わない。「◯◯に、◯年◯月、こう書かれていた」のように事実で書く。
- level は、行政の処分・警告・裁判・複数の被害の話は "red"、単発の悪い口コミや確かめきれない話は "yellow"、ふつうの情報は "none"。
- 文は短く、やさしい日本語で。1件は60字以内。

最後に、次の形のJSONだけを \`\`\`json で囲んで出してください。
\`\`\`json
{ "summary": "全体を2文で",
  "career": [ { "text": "…", "url": "https://…", "when": "2008年", "level": "none" } ],
  "reviews": [ { "text": "…", "url": "https://…", "level": "none" } ],
  "rumors": [ { "text": "…", "url": "https://…", "when": "2025年", "level": "red" } ],
  "notes": [ "…" ] }
\`\`\``;
}

function items(v: unknown): RumorItem[] {
  if (!Array.isArray(v)) return [];
  const out: RumorItem[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const text = typeof o.text === 'string' ? o.text.trim() : '';
    const url = typeof o.url === 'string' && /^https?:\/\//i.test(o.url) ? o.url : undefined;
    if (!text || !url) continue; // 出どころのないものは出さない
    const level = o.level === 'red' || o.level === 'yellow' ? o.level : 'none';
    out.push({ text, url, when: typeof o.when === 'string' ? o.when : undefined, level });
  }
  return out;
}

export function parseRumorReport(text: string): { ok: true; report: RumorReport } | { ok: false; error: string } {
  const ex = extractJson(text);
  if (!ex.ok) return { ok: false, error: 'AIの答えを読めませんでした。もう一度ためしてください。' };
  const o = ex.value as Record<string, unknown>;
  return {
    ok: true,
    report: {
      summary: typeof o.summary === 'string' ? o.summary : '',
      career: items(o.career),
      reviews: items(o.reviews),
      rumors: items(o.rumors),
      notes: Array.isArray(o.notes) ? o.notes.filter((n): n is string => typeof n === 'string') : [],
    },
  };
}

/** ブラウザから直接 Claude API を呼ぶ（キーはこの端末の中だけに保存） */
export async function fetchRumorReport(apiKey: string, model: string, names: string[], official: string): Promise<{ ok: true; report: RumorReport } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || RUMOR_MODEL_DEFAULT,
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
        messages: [{ role: 'user', content: buildRumorPrompt(names, official) }],
      }),
    });
  } catch (e) {
    return { ok: false, error: `つながりませんでした（${(e as Error).message}）。` };
  }
  const body = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
  if (!res.ok) return { ok: false, error: `AIがエラーを返しました（${res.status}）：${body?.error?.message ?? ''}` };
  const text = (body?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
  return parseRumorReport(text);
}

export function rumorSearchLinks(names: string[]): { label: string; url: string }[] {
  const n = names.map((x) => `"${x}"`).join(' ');
  const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  return [
    { label: '口コミ・評判をさがす', url: g(`${n} 口コミ OR 評判`) },
    { label: '悪いうわさ・被害の話をさがす', url: g(`${n} 被害 OR 返金 OR 出金できない OR 行政処分`) },
    { label: 'X（旧Twitter）でさがす', url: `https://x.com/search?q=${encodeURIComponent(names.join(' '))}&f=live` },
  ];
}
