// 入力まわりの E2E: プレイモード ON → 譜面読み込み → Space で再生開始 / 仮想ゲームパッド(ボタン・軸)で判定
import puppeteer from 'puppeteer-core';
import path from 'path';
const BASE = process.env.E2E_BASE || process.argv[2] || 'http://localhost:5199'; // run.mjs が E2E_BASE を渡す
const SONG = path.resolve('song');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = 0;
const check = (label, ok, info = '') => { if (!ok) fail++; console.log(ok ? 'OK  ' : 'NG  ', label, info); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
// 仮想ゲームパッド: window.__pad のボタン/軸をテストから書き換える
await page.evaluateOnNewDocument(() => {
  const pad = { id: 'E2E Virtual Pad', index: 0, connected: true, buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 })), axes: [0, 0], timestamp: 0, mapping: '' };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
});
await page.goto(BASE + '/bms.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('bms_gamepad_enabled', '1');
  // SP5: 鍵1 = ボタン0、鍵2 = 軸0 の + 方向
  localStorage.setItem('bms_gamepad_maps', JSON.stringify({ SP5: { 1: 0, 2: 'a0+' } }));
});
await page.reload({ waitUntil: 'networkidle0' });

// 1) 先にプレイモードを ON にしてから譜面を読み込む
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '入力').click()); await sleep(300);
check('設定に仮想ゲームパッド名が表示', (await page.evaluate(() => document.body.innerText)).includes('E2E Virtual Pad'));
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'プレイ').click()); await sleep(200);
await page.evaluate(() => [...document.querySelectorAll('label')].find(l => l.innerText.trim() === '有効').querySelector('input').click());
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => document.querySelector('input[type=file][webkitdirectory]').removeAttribute('webkitdirectory'));
const input = await page.$('label input[type=file]');
await input.uploadFile(path.join(SONG, 'test.bms'), path.join(SONG, 'key.wav'), path.join(SONG, 'bgm.wav'));
await page.waitForFunction(() => /\/ 16\.00/.test(document.body.innerText), { timeout: 15000 });
await sleep(2200); // Space の誤爆防止(直近2秒のゲームキー入力)に掛からないよう待つ

// 2) Space で再生開始し、仮想パッドで鍵1(ボタン)・鍵2(軸)を叩く
await page.evaluate(async () => {
  const pad = window.__pad;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
  const t0 = performance.now();
  const at = (sec) => new Promise(r => setTimeout(r, Math.max(0, t0 + sec * 1000 - performance.now())));
  const plan = [];
  for (const t of [2.0, 2.5, 3.0, 3.5]) plan.push([t, () => { pad.buttons[0] = { pressed: true, value: 1 }; }], [t + 0.06, () => { pad.buttons[0] = { pressed: false, value: 0 }; }]);
  for (const t of [4.0, 5.0]) plan.push([t, () => { pad.axes[0] += 0.05; }]); // 軸が動いた瞬間 = 押下
  plan.sort((a, b) => a[0] - b[0]);
  for (const [t, fn] of plan) { await at(t); fn(); }
});
await page.waitForFunction(() => /STAGE CLEAR/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
const res = await page.evaluate(() => {
  const t = document.body.innerText;
  const lines = t.split(/\r?\n/).map(x => x.trim());
  const i0 = lines.indexOf('STAGE CLEAR');
  const g = (lbl) => { const i = lines.indexOf(lbl, i0); return i >= 0 ? +lines[i + 1] : null; };
  return { clear: i0 >= 0, pg: g('PGREAT'), gr: g('GREAT'), gd: g('GOOD'), bd: g('BAD'), poor: g('POOR') };
});
check('Space で再生が始まり完走(STAGE CLEAR)', res.clear, JSON.stringify(res));
const hit = (res.pg || 0) + (res.gr || 0) + (res.gd || 0);
check('仮想パッドのボタン4回 + 軸2回 = 6ノーツをヒット', hit === 6, `hit=${hit}`);
check('触らなかった 10 ノーツは POOR', res.poor === 10, `poor=${res.poor}`);
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
