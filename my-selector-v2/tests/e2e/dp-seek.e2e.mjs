// DP 譜面でシークしたとき、コントローラ表示のレーン別ノーツ数に 2P 側も数えられるか
import puppeteer from 'puppeteer-core';
import path from 'path';
const BASE = process.env.E2E_BASE || process.argv[2] || 'http://localhost:5199'; // run.mjs が E2E_BASE を渡す
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = 0;
const check = (label, ok, info = '') => { if (!ok) fail++; console.log(ok ? 'OK  ' : 'NG  ', label, info); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new', defaultViewport: { width: 1600, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '/bms.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => document.querySelector('input[type=file][webkitdirectory]').removeAttribute('webkitdirectory'));
await (await page.$('input[type=file][multiple]')).uploadFile(path.resolve('song-dp/dp.bms'), path.resolve('song-dp/key.wav'));
await page.waitForFunction(() => /DP 14K|DP 10K/.test(document.body.innerText), { timeout: 15000 });
// 1P: 2.0s, 3.0s(鍵1) / 2P: 2.0s(鍵1), 3.0s(皿) / 1P 鍵6: 4.0s → 3.5 秒へシークすると 4 ノーツ通過済み
await page.evaluate(() => { const r = document.querySelector('input[type=range][step="0.01"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, '3.5'); r.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(800);
// コントローラ表示のレーン別ノーツ数(CONTROLLER 見出しの箱の中の小さな数字)
const counts = await page.evaluate(() =>
  // ControllerPanel のレーン別ノーツ数(showCount の小さな数字。text-[7px] + font-mono)
  [...document.querySelectorAll('div[class*="text-[7px]"][class*="font-mono"]')].map(d => Number(d.textContent)));
const total = counts.reduce((a, b) => a + b, 0);
check('シーク後のレーン別ノーツ数の合計 = 通過したノーツ数 4(2P 側も含む)', total === 4, JSON.stringify(counts));
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
