// 音タブの操作 E2E: エフェクト設定の保存 / カスタム打鍵音の読み込み・表示・リセット / スクラッチ用の分離
import puppeteer from 'puppeteer-core';
import path from 'path';
const BASE = process.env.E2E_BASE || process.argv[2] || 'http://localhost:5199'; // run.mjs が E2E_BASE を渡す
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = 0;
const check = (label, ok, info = '') => { if (!ok) fail++; console.log(ok ? 'OK  ' : 'NG  ', label, info); };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
await page.goto(BASE + '/bms.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate(() => document.querySelector('button[title="設定"]').click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === '音').click()); await sleep(300);
const text = () => page.evaluate(() => document.body.innerText);
const clickLabel = (t) => page.evaluate((t) => [...document.querySelectorAll('label')].find(l => l.innerText.includes(t)).querySelector('input').click(), t);

await clickLabel('エフェクトを有効にする'); await sleep(200);
check('エフェクト有効が保存される', await page.evaluate(() => JSON.parse(localStorage.getItem('bms_audio_fx')).enabled === true));
check('打鍵音: 初期はデフォルト音源', (await text()).includes('デフォルト音源'));
// 共通打鍵音のファイル選択(0.15 秒の key.wav)
const fileInputs = await page.$$('input[type=file][accept="audio/*"]');
await fileInputs[0].uploadFile(path.resolve('song/key.wav')); await sleep(800);
check('打鍵音を読み込むとファイル名が出る', (await text()).includes('key.wav'));
check('打鍵音のリセットボタンが出る', await page.evaluate(() => [...document.querySelectorAll('button.text-red-400')].some(b => b.innerText.trim() === 'リセット')));
check('スクラッチ用の欄は初期は無い', (await page.$$('input[type=file][accept="audio/*"]')).length === 1);
await clickLabel('通常とスクラッチを分ける'); await sleep(200);
check('分けると スクラッチ用の欄が出る', (await page.$$('input[type=file][accept="audio/*"]')).length === 2 && (await text()).includes('スクラッチ用'));
// 打鍵音の欄のリセット(赤いボタン。サウンドエフェクト欄にも「リセット」があるので区別する)の1つ目 = 通常ノーツ側
await page.evaluate(() => [...document.querySelectorAll('button.text-red-400')].find(b => b.innerText.trim() === 'リセット').click()); await sleep(300);
// 押したのは通常ノーツ側のリセット。スクラッチ側は共通打鍵音として適用済みの key.wav を引き継ぐ(従来どおりの挙動)
const rows = await page.evaluate(() => [...document.querySelectorAll('span.truncate.flex-1')].map(s => s.innerText));
check('通常ノーツ側のリセットで、その欄だけデフォルト音源に戻る', rows[0] === 'デフォルト音源' && rows[1] === 'key.wav', JSON.stringify(rows));
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'システム').click()); await sleep(200);
check('別タブでは音タブの内容は隠れる', !(await text()).includes('打鍵音ファイルの変更'));
check('ページエラー・警告ダイアログなし', errors.length === 0, errors.join(' | '));
await page.evaluate(() => localStorage.clear());
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
