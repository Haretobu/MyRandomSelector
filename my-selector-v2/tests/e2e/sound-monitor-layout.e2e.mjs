// SOUND MONITOR の見出し: DROP / M POLY / POLY の桁数が変わっても、タイトルが折り返さず高さも変わらない
import puppeteer from 'puppeteer-core';
const BASE = process.env.E2E_BASE || process.argv[2] || 'http://localhost:5199'; // run.mjs が E2E_BASE を渡す
let fail = 0;
const check = (label, ok, info = '') => { if (!ok) fail++; console.log(ok ? 'OK  ' : 'NG  ', label, info); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new', defaultViewport: { width: 1600, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '/bms.html', { waitUntil: 'networkidle0' });
const rows = [];
for (const [drop, mpoly, poly] of [['0', '0', '0'], ['0', '128', '64'], ['12', '300', '256'], ['1234', '999', '999']]) {
    rows.push(await page.evaluate((drop, mpoly, poly) => {
        const title = [...document.querySelectorAll('span')].find(s => s.textContent === 'SOUND MONITOR');
        const header = title.closest('div.shrink-0');
        // 数字は LogPanel.updatePoly が書き込む span。ここでは直接書き換えて最大桁を再現する
        const num = (label) => [...header.querySelectorAll('span')].find(sp => sp.firstChild && sp.firstChild.nodeType === 3 && sp.firstChild.textContent.trim() === label).querySelector('span');
        num('DROP:').textContent = drop; num('M POLY:').textContent = mpoly; num('POLY:').textContent = poly;
        const lineH = parseFloat(getComputedStyle(title).lineHeight) || 15;
        return { h: Math.round(header.getBoundingClientRect().height), lines: Math.round(title.getBoundingClientRect().height / lineH) };
    }, drop, mpoly, poly));
}
check('タイトル「SOUND MONITOR」は常に1行', rows.every(r => r.lines === 1), JSON.stringify(rows));
check('見出しの高さは桁数によらず一定', new Set(rows.map(r => r.h)).size === 1, JSON.stringify(rows));
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
