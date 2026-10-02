// プレイタブの操作 E2E: レーンミュート / プレイサイド / レーンオプション(配置表示) / プレイモードと判定方式
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
// 譜面を読み込む(配置の表示は譜面の読み込み後に計算されるため)。テスト譜面は 5 鍵
await page.evaluate(() => document.querySelector('input[type=file][webkitdirectory]').removeAttribute('webkitdirectory'));
await (await page.$('label input[type=file]')).uploadFile(...['test.bms', 'key.wav', 'bgm.wav'].map(f => path.resolve('song', f)));
await page.waitForFunction(() => /\/ 16\.00/.test(document.body.innerText), { timeout: 15000 });
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'プレイ').click()); await sleep(300);
const text = () => page.evaluate(() => document.body.innerText);
const btn = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === t), t);

// レーンミュート: 「3」を押すと赤くなる
const muteBtn = () => page.evaluate(() => { const box = [...document.querySelectorAll('div')].find(d => d.innerText.startsWith('レーンミュート')); return [...box.querySelectorAll('button')].find(b => b.innerText.trim() === '3')?.className || ''; });
check('レーンミュート: 初期は OFF', !(await muteBtn()).includes('bg-red-600'));
await page.evaluate(() => { const box = [...document.querySelectorAll('div')].find(d => d.innerText.startsWith('レーンミュート')); [...box.querySelectorAll('button')].find(b => b.innerText.trim() === '3').click(); }); await sleep(200);
check('レーンミュート: 押すと赤(ON)', (await muteBtn()).includes('bg-red-600'));
// プレイサイド
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '1P').click()); await sleep(200);
check('プレイサイド: 1P → 2P(SP の譜面)', await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === '2P')));
// レーンオプション: MIRROR → 配置 54321(5鍵)
await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'MIRROR')); s.value = 'MIRROR'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
check('レーンオプション: MIRROR で配置 54321 を表示(5鍵)', (await text()).includes('54321'), (await text()).match(/配置\s*\S+/)?.[0]);
// プレイモード: 有効にすると判定方式が出る / IIDX を選ぶと保存
check('プレイモード OFF: 判定方式は畳まれている', !(await text()).includes('判定方式'));
await page.evaluate(() => [...document.querySelectorAll('label')].find(l => l.innerText.trim() === '有効').querySelector('input').click()); await sleep(300);
check('プレイモード ON: 判定方式・判定オフセットが出る', (await text()).includes('判定方式') && (await text()).includes('判定オフセット'));
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'IIDX').click()); await sleep(300);
check('判定方式 IIDX が保存され、判定幅表示が変わる', await page.evaluate(() => localStorage.getItem('bms_judge_system') === 'IIDX') && (await text()).includes('±16.7'));
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '表示').click()); await sleep(200);
check('別タブではプレイタブの内容は隠れる', !(await text()).includes('レーンオプション'));
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
