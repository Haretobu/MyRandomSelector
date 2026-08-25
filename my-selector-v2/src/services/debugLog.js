// src/services/debugLog.js
// ★ 再現困難な不具合（例: 保存ボタンが反応しない）の調査用に、
//   技術的な動作記録のみをメモリ上に保持する軽量ロガー。
//
//   絶対に記録しないもの: 作品名・タグ名・メモ・サムネイルURL・作品URLなどの実データ。
//   記録するもの: 操作の種類、作品ID（意味を持たないランダム文字列）、
//                タイムスタンプ、エラーコード/メッセージ、オンライン状態など。
//
//   外部への送信は一切行わない。ボタン操作でJSONファイルとして端末にダウンロードするのみ。

const MAX_ENTRIES = 500;
const buffer = [];

const push = (category, event, meta = {}) => {
    try {
        buffer.push({ t: new Date().toISOString(), category, event, ...meta });
        if (buffer.length > MAX_ENTRIES) buffer.shift();
    } catch (e) {
        // ロガー自体が原因でアプリを壊さないよう、失敗は握りつぶす
    }
};

export const logEvent = (category, event, meta) => push(category, event, meta);

// モーダルタイトルなどの文字列から「」内(作品名等の実データ)を除去した安全な文字列を返す
export const redactTitle = (title) => (title || '').replace(/「.*?」/g, '「***」');

let initialized = false;

export const initDebugLog = () => {
    if (initialized) return;
    initialized = true;

    window.addEventListener('online', () => push('network', 'online'));
    window.addEventListener('offline', () => push('network', 'offline'));

    window.addEventListener('error', (e) => {
        push('error', 'uncaught', {
            message: (e.message || '').slice(0, 200),
            filename: e.filename || null,
            lineno: e.lineno || null,
            colno: e.colno || null,
        });
    });

    window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason;
        push('error', 'unhandledrejection', {
            name: reason?.name || null,
            code: reason?.code || null,
            message: (reason?.message || String(reason || '')).slice(0, 200),
        });
    });

    push('system', 'debugLogInitialized', { online: navigator.onLine });
};

// 貯めたログをJSONファイルとして端末にダウンロードする（外部送信なし）
export const exportLogAsFile = () => {
    push('system', 'exportRequested');

    const payload = {
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        entries: buffer,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    const a = document.createElement('a');
    a.href = url;
    a.download = `app-debug-log-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
