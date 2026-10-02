// レーンオプションの配置表示: 譜面の読み込み前は(未計算の)配置を出さない → 読み込み後に正しい配置を出す
import puppeteer from 'puppeteer-core';
import path from 'path';
const BASE = process.env.E2E_BASE || process.argv[2] || 'http://localhost:5199'; // run.mjs が E2E_BASE を渡す
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = 0;
const check = (label, ok, info = '') => { if (!ok) fail++; console.log(ok ? 'OK  ' : 'NG  ', label, info); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new', defaultViewport: { width: 1600, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '/bms.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'プレイ').click()); await sleep(300);
// レーンオプションの欄全体(select を含む縦並びの箱)
const optBox = () => page.evaluate(() => [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'MIRROR')).closest('div.flex-col.gap-2').innerText);
// 譜面なしで MIRROR
await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'MIRROR')); s.value = 'MIRROR'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
let t = await optBox();
check('譜面なし: 未計算の配置(1234567)を出さない', !t.includes('1234567'), JSON.stringify(t));
check('譜面なし: 「譜面を読み込むと配置が決まります」と案内', t.includes('譜面を読み込むと配置が決まります'));
// 譜面を読み込む(5鍵)
await page.evaluate(() => document.querySelector('input[type=file][webkitdirectory]').removeAttribute('webkitdirectory'));
await (await page.$('input[type=file][multiple]')).uploadFile(...['test.bms', 'key.wav', 'bgm.wav'].map(f => path.resolve('song', f)));
await page.waitForFunction(() => /\/ 16\.00/.test(document.body.innerText), { timeout: 15000 });
await sleep(300);
t = await optBox();
check('譜面あり: MIRROR の配置 54321 を表示', t.includes('54321'), JSON.stringify(t));
check('譜面あり: 案内は消える', !t.includes('譜面を読み込むと配置が決まります'));
// OFF に戻すと何も出ない
await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'MIRROR')); s.value = 'OFF'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
t = await optBox();
check('OFF: 配置も案内も出さない', !t.includes('配置') && !t.includes('譜面を読み込むと'), JSON.stringify(t));
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
