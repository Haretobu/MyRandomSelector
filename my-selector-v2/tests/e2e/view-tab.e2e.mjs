// 表示タブの操作 E2E: ミスレイヤー / BGA 表示位置 / レーンカバー / レーン幅 / オートHI-SPEED
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
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(400);
const text = () => page.evaluate(() => document.body.innerText);
const ls = (k) => page.evaluate((k) => localStorage.getItem(k), k);
const clickLabel = (t) => page.evaluate((t) => [...document.querySelectorAll('label')].find(l => l.innerText.includes(t)).querySelector('input').click(), t);
const clickBtn = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t).click(), t);
const setRange = (label, v) => page.evaluate((label, v) => {
  const box = [...document.querySelectorAll('div')].filter(d => d.innerText.startsWith(label)).pop();
  const r = box.parentElement.querySelector('input[type=range]') || box.querySelector('input[type=range]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, String(v));
  r.dispatchEvent(new Event('input', { bubbles: true }));
}, label, v);

check('表示タブが初期表示', (await text()).includes('表示・BGA設定') && (await text()).includes('譜面の表示エリア'));
await clickLabel('ミスレイヤー (POOR BGA) を表示'); await sleep(200);
check('ミスレイヤー OFF が保存される', (await ls('bms_miss_layer')) === '0');
await clickLabel('レーン背面に BGA を表示'); await sleep(200);
check('背面 BGA ON が保存される', (await ls('bms_bga_behind')) === '1');
await clickLabel('サイド BGA パネル'); await sleep(200);
await clickBtn('右サイド'); await sleep(200);
check('サイド BGA ON・右サイドが保存される', (await ls('bms_bga_side')) === '1' && (await ls('bms_bga_side_pos')) === 'right');
check('レーンカバー OFF: スライダーなし', !(await text()).includes('SUDDEN+\n'));
await clickBtn('SUD+&HID+'); await sleep(200);
check('SUD+&HID+: SUDDEN+ と HIDDEN+ のスライダーが出る', /SUDDEN\+/.test(await text()) && /HIDDEN\+/.test(await text()) && !/\bLIFT\b\s*\d/.test(await text()));
await clickBtn('LIFT'); await sleep(200);
check('LIFT: LIFT のスライダーに切り替わる', (await page.evaluate(() => [...document.querySelectorAll('span')].some(s => s.innerText.trim() === 'LIFT'))));
await setRange('レーン幅 (PC)', 60); await sleep(200);
check('レーン幅 60px が保存・表示される', (await ls('bms_lane_width')) === '60' && (await text()).includes('60px'));
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
