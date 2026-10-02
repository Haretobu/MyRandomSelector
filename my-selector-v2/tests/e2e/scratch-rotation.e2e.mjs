// スクラッチの定常回転: 設定 UI / 保存 / 実際にコントローラ表示の皿が止まる・回る
import puppeteer from 'puppeteer-core';
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
// コントローラ表示の皿(rotate を持つ要素)の角度を 600ms 空けて2回読む
const angle = () => page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => /rotate\(/.test(d.style.transform)); return el ? parseFloat(el.style.transform.match(/rotate\(([-\d.e]+)deg\)/)[1]) : null; });
const spinning = async () => { const a = await angle(); await sleep(600); const b = await angle(); return { a, b, moving: a !== null && b !== null && Math.abs(b - a) > 1 }; };
let s = await spinning();
check('既定(ON): 皿が回っている', s.moving, JSON.stringify(s));
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'システム').click()); await sleep(300);
check('システムタブに「スクラッチの定常回転」がある', await page.evaluate(() => document.body.innerText.includes('スクラッチの定常回転')));
await page.evaluate(() => [...document.querySelectorAll('label')].find(l => l.innerText.includes('スクラッチの定常回転')).querySelector('input').click()); await sleep(400);
check('OFF が保存される', await page.evaluate(() => localStorage.getItem('bms_scratch_rotation') === '0'));
s = await spinning();
check('OFF: 皿が止まる', !s.moving, JSON.stringify(s));
await page.reload({ waitUntil: 'networkidle0' }); await sleep(300);
s = await spinning();
check('再読み込み後も OFF のまま(止まっている)', !s.moving, JSON.stringify(s));
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
