// src/utils.js

// HTMLエスケープ（XSS対策）
export const escapeHTML = (str) => {
    if (typeof str !== 'string' || !str) return '';
    return str.replace(/[&<>"']/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
};

// 日付フォーマット (YYYY/MM/DD HH:MM)
export const formatDate = (timestamp, includeTime = true) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    const date = timestamp.toDate();
    const options = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
        hour12: false
    };
    if (!includeTime) {
        delete options.hour;
        delete options.minute;
    }
    return new Intl.DateTimeFormat('ja-JP', options).format(date);
};

// 入力フォーム用日付フォーマット (YYYY/MM/DD)
export const formatDateForInput = (date) => {
    const d = date instanceof Date ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
};

// 日付文字列の妥当性チェック
export const isValidDate = (dateString) => {
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateString)) return false;
    const d = new Date(dateString.replace(/\//g, '-'));
    if (isNaN(d.getTime())) return false;
    return d.toISOString().slice(0, 10).replace(/-/g, '/') === dateString;
};

// 背景色に合わせて文字色（黒か白）を判定
export const getContrastColor = (hex) => {
    if (!hex) return '#FFFFFF';
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#FFFFFF';
};

// 文字列の正規化（検索用：全角→半角、小文字化など）
export const normalizeString = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFKC')
        .replace(/[\u3041-\u3096]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60))
        .replace(/[！＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        .replace(/　/g, ' ')
        .replace(/[〇*]/g, '.')
        .trim();
};

// ランダムID生成
export const generateRandomId = (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

// モバイル判定
export const isMobile = () => {
    return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};