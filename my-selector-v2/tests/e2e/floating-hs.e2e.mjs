// 緑数字を維持(フローティング HI-SPEED): 曲を切り替えても緑数字が同じになるよう HI-SPEED が変わる
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

// ControlBar の HI-SPEED 入力欄 / 曲の選択
const hs = () => page.evaluate(() => Number(document.querySelector('input[type=number][step="0.1"]').value));
// 左の情報パネルに表示される緑数字(GRN)
const grn = () => page.evaluate(() => Number([...document.querySelectorAll('span')].find(s => s.className.includes('text-[#00ff00]')).textContent));
const setNumber = (sel, v) => page.evaluate((sel, v) => {
    const el = document.querySelector(sel);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
}, sel, v);
const selectSong = async (name) => {
    await page.evaluate((name) => {
        const s = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.text === name));
        s.value = [...s.options].find(o => o.text === name).value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
    }, name);
    await page.waitForFunction(() => !document.querySelector('[role=status]'), { timeout: 15000 });
    await sleep(400);
};

// 1) 緑数字 500 で維持を ON
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('label')].find(l => l.innerText.trim() === 'ON' && l.closest('div').innerText.includes('緑数字を維持')).querySelector('input').click());
await sleep(300);
await setNumber('input[type=number][min="60"]', 500); await sleep(200);
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);

// 2) BPM 120 の曲(test.bms)と BPM 150 の曲(fast.bms)を読み込む
await page.evaluate(() => document.querySelector('input[type=file][webkitdirectory]').removeAttribute('webkitdirectory'));
await (await page.$('input[type=file][multiple]')).uploadFile(...['test.bms', 'fast.bms', 'key.wav', 'bgm.wav'].map(f => path.resolve('song', f)));
await page.waitForFunction(() => /\/ 16\.00/.test(document.body.innerText), { timeout: 15000 });
await sleep(400);
check('BPM 120 の曲: 緑数字 500 → HI-SPEED 4', (await hs()) === 4, `hs=${await hs()}`);
check('BPM 120 の曲: 画面の緑数字 500', (await grn()) === 500, `grn=${await grn()}`);
await selectSong('fast.bms');
check('BPM 150 の曲: 緑数字 500 のまま → HI-SPEED 3.2', (await hs()) === 3.2, `hs=${await hs()}`);
check('BPM 150 の曲: 画面の緑数字も 500 のまま', (await grn()) === 500, `grn=${await grn()}`);

// 3) ON のまま HI-SPEED を手で 5 に → 維持値 = 240000 / (150 × 5) = 320
await setNumber('input[type=number][step="0.1"]', 5); await sleep(300);
check('手動変更後も維持は ON のまま、維持値 320 が保存される',
    await page.evaluate(() => localStorage.getItem('bms_floating_hs') === '1' && localStorage.getItem('bms_target_green') === '320'));
await selectSong('test.bms');
check('BPM 120 の曲に戻す: 緑数字 320 → HI-SPEED 6.25', (await hs()) === 6.25, `hs=${await hs()}`);

// 4) 再読み込みしても設定が残る
await page.reload({ waitUntil: 'networkidle0' }); await sleep(300);
check('再読み込み後も HI-SPEED・維持 ON・維持値が残る', (await hs()) === 6.25
    && await page.evaluate(() => localStorage.getItem('bms_floating_hs') === '1' && localStorage.getItem('bms_target_green') === '320'), `hs=${await hs()}`);
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
