// BMS プレイヤーのブラウザ E2E テストをまとめて実行する。npm run test:e2e
//   1) テスト譜面・音源を tests/e2e/.fixtures に生成
//   2) 空いているポートで Vite の開発サーバーを起動
//   3) tests/e2e/*.e2e.mjs を順番に実行(ヘッドレス Chrome。各テストは .fixtures をカレントにして動く)
//   4) 開発サーバーを子プロセスごと停止
// Chrome の場所は環境変数 CHROME_PATH で指定できる(未指定なら OS の標準的な場所を探す)。
// 特定のテストだけ: npm run test:e2e -- playback input
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFixtures } from './fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const fixtures = path.join(here, '.fixtures');

function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const candidates = {
        win32: [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        ],
        darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
        linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    }[process.platform] || [];
    return candidates.find(p => fs.existsSync(p));
}

const freePort = () => new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
});

async function waitForServer(url, timeoutMs = 60000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        try { const r = await fetch(url); if (r.ok) return; } catch { /* まだ起動していない */ }
        await new Promise(r => setTimeout(r, 300));
    }
    throw new Error(`開発サーバーが ${timeoutMs / 1000} 秒以内に起動しませんでした: ${url}`);
}

// 開発サーバーを子プロセスごと止める(Windows は npx → node の多段になるため taskkill /T で木ごと)
function stopServer(child) {
    if (!child || child.exitCode !== null) return;
    try {
        if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        else process.kill(-child.pid, 'SIGTERM');
    } catch { /* すでに終了している */ }
}

function runTest(file, env) {
    return new Promise((resolve) => {
        const p = spawn(process.execPath, [file], { cwd: fixtures, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        p.stdout.on('data', d => { out += d; });
        p.stderr.on('data', d => { out += d; });
        p.on('close', (code) => resolve({ code, out }));
    });
}

async function main() {
    const chrome = findChrome();
    if (!chrome) { console.error('Chrome / Edge が見つかりません。環境変数 CHROME_PATH で場所を指定してください。'); process.exit(2); }
    const only = process.argv.slice(2);
    const files = fs.readdirSync(here).filter(f => f.endsWith('.e2e.mjs'))
        .filter(f => !only.length || only.some(o => f.startsWith(o))).sort();
    if (!files.length) { console.error('実行するテストがありません:', only.join(' ')); process.exit(2); }

    fs.rmSync(fixtures, { recursive: true, force: true });
    writeFixtures(fixtures);
    const port = await freePort();
    const base = `http://localhost:${port}`;
    const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
        cwd: root, shell: process.platform === 'win32', detached: process.platform !== 'win32', stdio: 'ignore',
    });
    const cleanup = () => stopServer(server);
    process.on('SIGINT', () => { cleanup(); process.exit(130); });

    let failed = 0;
    try {
        await waitForServer(`${base}/bms.html`);
        console.log(`開発サーバー: ${base}  /  ブラウザ: ${chrome}\n`);
        for (const f of files) {
            const { code, out } = await runTest(path.join(here, f), { ...process.env, CHROME_PATH: chrome, E2E_BASE: base });
            const ok = code === 0;
            if (!ok) failed++;
            console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}`);
            if (!ok) console.log(out.split('\n').filter(l => !l.startsWith('OK ')).map(l => '      ' + l).join('\n'));
        }
    } finally {
        cleanup();
    }
    console.log(`\n${files.length - failed} / ${files.length} passed`);
    process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
