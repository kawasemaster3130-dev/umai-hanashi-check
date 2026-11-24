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
 *
 * プログラムを直したとき（貼り直し）
 * 1. Apps Script の中身を全部消して、このファイルの中身を全部貼る → 保存
 * 2. 右上「デプロイ」→「デプロイを管理」→ 鉛筆のマーク →「バージョン」を「新しいバージョン」→「デプロイ」
 *    （URLは変わりません。「新しいデプロイ」を作るとURLが変わるので使わない）
 * 新しいタブや列は、次に結果が届いたときに自動で作られます（setup をもう一度実行してもかまいません）。
 */

const SHEET_NAME = '結果';
// 列を足すときは、いちばん後ろに足す（「調べた回の番号」が16列目なのを変えない）
const HEADERS = ['受け取った日時', '調べた日時', '調べた言葉', '総合', '国の登録', '国の警告', 'やっていること', 'これまで', '相手は何をすると言ったか', '話の種類', 'あぶない答え（話の種類）', '登録の一覧で見つかった名前', '警告の一覧で見つかった名前', '言われたことの中の気になる言葉', '端末の番号', '調べた回の番号', 'アプリの版', '投資歴', '投資したことがある商品', 'トータル収支', '投資に回せるお金', '今後の目標'];
// 最初の5つの質問：1つの端末に1行（答えを直したら同じ行を上書き）
const INTRO_SHEET = '最初の5問';
const INTRO_HEADERS = ['受け取った日時', '答えた日時', '端末の番号', '投資歴', '投資したことがある商品', 'トータル収支', '投資に回せるお金', '今後の目標（何年後）', '今後の目標（どうなっていたいか）', 'アプリの版'];
const MAX_CELL = 2000;

function headerStyle(sh, headers) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#23211f').setFontColor('#faf7f0').setWrap(true);
  sh.setFrozenRows(1);
}

/** タブがなければ作り、見出しが古ければ書き直す */
function ensureSheet(name, headers, index) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name, index);
  const cur = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  if (cur.length < headers.length || headers.some((h, i) => cur[i] !== h)) headerStyle(sh, headers);
  return sh;
}

function setupIntro() {
  const sh = ensureSheet(INTRO_SHEET, INTRO_HEADERS, 1);
  sh.setColumnWidths(1, 3, 140);
  sh.setColumnWidths(4, 4, 160);
  sh.setColumnWidth(5, 240);
  sh.setColumnWidth(9, 320);
  return sh;
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME, 0);
  headerStyle(sh, HEADERS);
  sh.setColumnWidths(1, 2, 140);
  sh.setColumnWidth(3, 220);
  sh.setColumnWidths(4, 5, 90);
  sh.setColumnWidths(9, 9, 200);
  sh.setColumnWidths(18, 5, 180);
  const rng = sh.getRange('D2:H');
  const rules = [
    ['あぶない', '#f6e3dc', '#b2321c'],
    ['気をつける', '#f3e6bd', '#8a6100'],
    ['問題なし', '#dde7f1', '#1f4b78'],
  ].map(([t, bg, fg]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t).setBackground(bg).setFontColor(fg).setBold(true).setRanges([rng]).build());
  sh.setConditionalFormatRules(rules);
  setupIntro();
  // 最初からある空のタブ（シート1）だけを消す
  const first = ss.getSheets().find((s) => s.getName() !== SHEET_NAME && s.getName() !== INTRO_SHEET && s.getLastRow() === 0);
  if (first) ss.deleteSheet(first);
}

/** 最初の5つの質問：同じ端末の行があれば上書き、なければ足す */
function saveIntro(d) {
  if (!d.device) return 'ng';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(INTRO_SHEET) ? ensureSheet(INTRO_SHEET, INTRO_HEADERS, 1) : setupIntro();
  const row = [new Date(), d.answeredAt, d.device, d.years, d.products, d.pnl, d.surplus, d.goalYears, d.goalText, d.version].map(clip);
  const last = sh.getLastRow();
  let at = -1;
  if (last > 1) {
    const ids = sh.getRange(2, 3, last - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === d.device) { at = i + 2; break; }
  }
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return 'ok';
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
    if (!d || d.app !== 'umai-hanashi-check') return ContentService.createTextOutput('ng');
    if (d.kind === 'intro') return ContentService.createTextOutput(saveIntro(d));
    if (!d.runId) return ContentService.createTextOutput('ng');
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) ? ensureSheet(SHEET_NAME, HEADERS, 0) : (setup(), SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME));
    const row = [new Date(), d.checkedAt, d.query, d.overall, d.register, d.warning, d.doing, d.history, d.activity, d.topics, d.topicReds, d.registered, d.warned, d.hits, d.device, d.runId, d.version, d.introYears, d.introProducts, d.introPnl, d.introSurplus, d.introGoal].map(clip);
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
