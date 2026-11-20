/**
 * うまい話チェック：利用者の結果を、このスプレッドシートに集める（Google Apps Script）
 *
 * 使い方（1回だけ）
 * 1. このスプレッドシートを開く → 上のメニュー「拡張機能」→「Apps Script」
 * 2. 最初からある文字を全部消して、このファイルの中身を全部貼る → 保存（ディスクのマーク）
 * 3. 上の関数の選択で「setup」を選んで「実行」→ 許可の画面が出たら自分のアカウントで許可
 * 4. 右上「デプロイ」→「新しいデプロイ」→ 種類の歯車で「ウェブアプリ」
 *    ・次のユーザーとして実行：自分
 *    ・アクセスできるユーザー：全員
 *    →「デプロイ」→ 出てきた「ウェブアプリのURL」（https://script.google.com/macros/s/…/exec）をコピー
 * 5. そのURLを Claude に送る（アプリに入れて公開し直します）
 *
 * このURLに届くのは「書き込み」だけです。読むことはできません。シートはあなたしか開けません。
 */

const SHEET_NAME = '結果';
const HEADERS = ['受け取った日時', '調べた日時', '調べた言葉', '総合', '国の登録', '国の警告', 'やっていること', 'これまで', '相手は何をすると言ったか', '話の種類', 'あぶない答え（話の種類）', '登録の一覧で見つかった名前', '警告の一覧で見つかった名前', '言われたことの中の気になる言葉', '端末の番号', '調べた回の番号', 'アプリの版'];
const MAX_CELL = 2000;

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME, 0);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#23211f').setFontColor('#faf7f0').setWrap(true);
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, 2, 140);
  sh.setColumnWidth(3, 220);
  sh.setColumnWidths(4, 5, 90);
  sh.setColumnWidths(9, 9, 200);
  const rng = sh.getRange('D2:H');
  const rules = [
    ['あぶない', '#f6e3dc', '#b2321c'],
    ['気をつける', '#f3e6bd', '#8a6100'],
    ['問題なし', '#dde7f1', '#1f4b78'],
  ].map(([t, bg, fg]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t).setBackground(bg).setFontColor(fg).setBold(true).setRanges([rng]).build());
  sh.setConditionalFormatRules(rules);
  const first = ss.getSheets().find((s) => s.getName() !== SHEET_NAME && s.getLastRow() === 0);
  if (first) ss.deleteSheet(first);
}

function clip(v) {
  const s = v === undefined || v === null ? '' : String(v);
  // 先頭が = + - @ の文字は、式として動かないように ' を付ける
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return safe.length > MAX_CELL ? safe.slice(0, MAX_CELL) + '…' : safe;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d || d.app !== 'umai-hanashi-check' || !d.runId) return ContentService.createTextOutput('ng');
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || (setup(), SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME));
    const row = [new Date(), d.checkedAt, d.query, d.overall, d.register, d.warning, d.doing, d.history, d.activity, d.topics, d.topicReds, d.registered, d.warned, d.hits, d.device, d.runId, d.version].map(clip);
    // 同じ回（runId）は、後から送られた内容で上書きする
    const last = sh.getLastRow();
    let at = -1;
    if (last > 1) {
      const ids = sh.getRange(2, 16, last - 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0 && i >= ids.length - 500; i--) if (ids[i][0] === d.runId) { at = i + 2; break; }
    }
    if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('ng');
  } finally {
    lock.releaseLock();
  }
}
