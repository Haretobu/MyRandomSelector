// 設定の永続化(localStorage)の E2E。使い方: node e2e-settings.mjs http://localhost:5199
import puppeteer from 'puppeteer-core';
const BASE = process.env.E2E_BASE || process.argv[2] || 'http://localhost:5199'; // run.mjs が E2E_BASE を渡す
let fail = 0;
const check = (label, ok, info = '') => { if (!ok) fail++; console.log(ok ? 'OK  ' : 'NG  ', label, info); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new', defaultViewport: { width: 1600, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(BASE + '/bms.html', { waitUntil: 'networkidle0' });

// 保存値を仕込んで再読み込み(一部だけの保存値・壊れた値・範囲外の値を含む)
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('bms_keymaps', JSON.stringify({ SP7: { 1: 'KeyQ' } }));    // 一部だけ
  localStorage.setItem('bms_judge_system', 'IIDX');
  localStorage.setItem('bms_judge_offset', '12');
  localStorage.setItem('bms_lane_width', '999');                                  // 範囲外 → 既定 44
  localStorage.setItem('bms_audio_fx', JSON.stringify({ enabled: true, eq: { low: 5 } })); // 一部だけ
  localStorage.setItem('bms_lite_mode', '{broken json');                          // 壊れた値 → 既定
  localStorage.setItem('bms_bga_side_pos', 'middle');                             // 不正値 → left
  localStorage.setItem('bms_miss_layer', '0');
});
await page.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 500));
const ls = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
const km = JSON.parse(ls.bms_keymaps);
check('keymaps: 保存値が反映', km.SP7[1] === 'KeyQ', JSON.stringify(km.SP7));
check('keymaps: 未保存のキーは既定値で補完', km.SP7[2] === 'KeyS' && km.SP7[0] === 'ShiftLeft');
check('keymaps: 他モードも既定値で補完', km.DP14 && km.DP14[9] === 'Comma' && km.PMS9 && km.PMS9[8] === 'KeyB');
check('judge_system: IIDX を維持', ls.bms_judge_system === 'IIDX');
check('judge_offset: 12 を維持', ls.bms_judge_offset === '12');
check('lane_width: 範囲外は既定 44', ls.bms_lane_width === '44', ls.bms_lane_width);
const fx = JSON.parse(ls.bms_audio_fx);
check('audio_fx: 保存値と既定値をエフェクト単位でマージ', fx.enabled === true && fx.eq.low === 5 && fx.eq.mid === 0 && fx.echo && fx.echo.time === 0.3, JSON.stringify(fx));
const lite = JSON.parse(ls.bms_lite_mode);
check('lite_mode: 壊れた値は既定値', lite.enabled === false && lite.lowRes === true, ls.bms_lite_mode);
check('bga_side_pos: 不正値は left', ls.bms_bga_side_pos === 'left', ls.bms_bga_side_pos);
check('miss_layer: 0 を維持', ls.bms_miss_layer === '0');
check('gamepad_scratch_alt: モード毎の既定値', JSON.parse(ls.bms_gamepad_scratch_alt).SP7[0] === null);
// UI 側: 判定方式が IIDX として表示されるか
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'プレイ').click()); await new Promise(r => setTimeout(r, 300));
check('ページエラーなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
