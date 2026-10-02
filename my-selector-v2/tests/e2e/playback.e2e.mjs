// BMS プレイヤーの E2E スモークテスト(ヘッドレス Chrome)。使い方: node e2e.mjs http://localhost:5199
import puppeteer from 'puppeteer-core';
import path from 'path';
const BASE = process.env.E2E_BASE || process.argv[2] || 'http://localhost:5199'; // run.mjs が E2E_BASE を渡す
const SONG = path.resolve('song');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = 0;
const check = (label, ok, info = '') => { if (!ok) fail++; console.log(ok ? 'OK  ' : 'NG  ', label, info); };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1600,900'], defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push('http ' + r.status() + ' ' + r.url()); });
await page.goto(BASE + '/bms.html', { waitUntil: 'networkidle0' });

const timeText = () => page.evaluate(() => [...document.querySelectorAll('div')].map(d => d.innerText).find(t => /^\d+\.\d\d \/ \d+\.\d\d$/.test(t || '')) || '');
const songTime = async () => parseFloat((await timeText()).split(' / ')[0]);
const clickPlay = () => page.evaluate(() => document.querySelector('button.p-2.bg-blue-600').click());
const bodyText = () => page.evaluate(() => document.body.innerText);

// --- 読み込み ---
// ヘッドレスではフォルダ選択(webkitdirectory)へのファイル投入ができないため、テスト時だけ属性を外す
await page.evaluate(() => document.querySelector('input[type=file][webkitdirectory]').removeAttribute('webkitdirectory'));
const input = await page.$('label input[type=file]');
// 読み込み中の表示を記録(一瞬で終わるので DOM の変化を監視して拾う)
await page.evaluate(() => {
  window.__loadingSeen = { parse: false, audioBar: false };
  new MutationObserver(() => {
    const el = document.querySelector('[role=status]');
    if (!el) return;
    const t = el.innerText;
    if (t.includes('BMSファイルを解析中')) window.__loadingSeen.parse = true;
    if (t.includes('音声ファイルを読み込み中') && /\d+%/.test(t)) window.__loadingSeen.audioBar = true;
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
});
await input.uploadFile(path.join(SONG, 'test.bms'), path.join(SONG, 'key.wav'), path.join(SONG, 'bgm.wav'));
await page.waitForFunction(() => /\/ 16\.00/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
check('読み込み: 曲長 16.00 秒(BGM 終端まで)', (await timeText()).endsWith('/ 16.00'), await timeText());
await sleep(300);
const seen = await page.evaluate(() => window.__loadingSeen);
check('読み込み中の表示: 解析中のメッセージが出た', seen.parse, JSON.stringify(seen));
check('読み込み中の表示: 音声読み込み中に進捗バー(%)が出た', seen.audioBar);
check('読み込み後は表示が消える', !(await page.$('[role=status]')));

// --- オート再生 ---
await clickPlay(); await sleep(3000);
let t = await songTime();
check('再生: 約3秒進む', t > 2.5 && t < 3.6, `t=${t}`);
let txt = await bodyText();
check('BACKING TRACK に bgm.wav', txt.includes('bgm.wav'));
check('SOUND MONITOR に key.wav', txt.includes('key.wav'));
check('DROP = 0', /DROP:\s*0/.test(txt));
await clickPlay(); const tp = await songTime(); await sleep(800);
check('一時停止: 時間が止まる', Math.abs((await songTime()) - tp) < 0.05, `t=${tp}`);
await clickPlay(); await sleep(1000);
check('再開: 時間が進む', (await songTime()) > tp + 0.7);
check('再開: BGM を途中から再生(BACKING TRACK に再登場)', (await bodyText()).includes('bgm.wav'));
// シーク(range input に値を入れて input イベント)
await page.evaluate(() => { const r = document.querySelector('input[type=range][step="0.01"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '12'); r.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(700);
t = await songTime();
check('シーク: 12秒付近へ', t > 12 && t < 13, `t=${t}`);
check('シーク後: BGM を途中から再生(既定設定)', (await bodyText()).includes('bgm.wav'));
check('シーク後: DROP = 0', /DROP:\s*0/.test(await bodyText()));
await sleep(4500);
check('終了: 曲長で止まって 0 に戻る', (await timeText()).startsWith('0.00'), await timeText());

// --- プレイモード ---
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'プレイ').click()); await sleep(300);
await page.evaluate(() => { const lbl = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === '有効'); lbl.querySelector('input').click(); });
await sleep(300);
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
// 入力シナリオ(曲の時刻 → キー操作)。SP5: 皿=ShiftLeft(A)/ControlLeft(B), 1..5 = Z S X D C
const plan = [
  [2.0, 'tap', 'KeyZ'], [2.5, 'tap', 'KeyZ'], [3.0, 'tap', 'KeyZ'], [3.5, 'tap', 'KeyZ'],
  [4.0, 'tap', 'KeyS'], [5.0, 'tap', 'KeyS'], [5.0, 'tap', 'ShiftLeft'],
  [6.0, 'tap', 'KeyX'], [6.0, 'down', 'KeyD'], [7.0, 'tap', 'KeyX'], [7.05, 'up', 'KeyD'],   // LN 6→7 を終点まで保持
  [8.0, 'down', 'ShiftLeft'], [8.5, 'down', 'ControlLeft'], [8.6, 'up', 'ControlLeft'], [9.2, 'up', 'ShiftLeft'], // 皿LN 8→9.5 を 300ms 早離し
  [9.0, 'tap', 'KeyD'],
  [10.0, 'tap', 'KeyC'], [10.333, 'tap', 'KeyC'], /* 10.667 は見逃し */ [11.333, 'tap', 'KeyC'],
  [11.4, 'tap', 'KeyC'],   // 直前に処理済みノーツ → 空POOR
  [12.5, 'tap', 'KeyZ'],   // 近くにノーツなし → 無反応
];
await page.evaluate(async (plan) => {
  const fire = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  document.querySelector('button.p-2.bg-blue-600').click();
  const t0 = performance.now();
  const events = [];
  for (const [at, kind, code] of plan) {
    if (kind === 'tap') { events.push([at, 'keydown', code], [at + 0.05, 'keyup', code]); }
    else events.push([at, kind === 'down' ? 'keydown' : 'keyup', code]);
  }
  events.sort((a, b) => a[0] - b[0]);
  for (const [at, type, code] of events) {
    const wait = t0 + at * 1000 - performance.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    fire(type, code);
  }
}, plan);
await page.waitForFunction(() => /STAGE CLEAR/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
txt = await bodyText();
check('リザルト表示(STAGE CLEAR)', txt.includes('STAGE CLEAR'));
const res = await page.evaluate(() => {
  const modal = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.startsWith('STAGE CLEAR'))?.closest('div.rounded-xl');
  const t = (modal || document.body).innerText;
  const lines = t.split(/\r?\n/).map(x => x.trim());
  const g = (lbl) => { const i = lines.indexOf(lbl); return i >= 0 ? +lines[i + 1] : null; };
  return { pg: g('PGREAT'), gr: g('GREAT'), gd: g('GOOD'), bd: g('BAD'), poor: g('POOR'), epoor: g('空POOR'), text: t.slice(0, 400) };
});
const judged = res.pg + res.gr + res.gd + res.bd + res.poor;
check('判定数 = 総ノーツ 16', judged === 16, JSON.stringify(res));
check('見逃し POOR = 1', res.poor === 1);
check('皿LN 早離し BAD = 1', res.bd === 1);
check('空POOR = 1', res.epoor === 1);
check('EX が 100% 以下', !/1\d\d\.\d\d%/.test(res.text));

check('ページエラーなし', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
