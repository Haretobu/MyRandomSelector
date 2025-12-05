// ★重要: v2 (第2世代) 用のインポートに変更
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const axios = require("axios");
const cheerio = require("cheerio");

// 東京リージョンをデフォルトに設定
setGlobalOptions({ region: "asia-northeast1" });

// 関数定義 (第2世代の書き方)
exports.getLinkPreview = onCall({
    cors: true,          // CORSを自動処理 (npm install cors は不要になりますが、そのままでOK)
    region: "asia-northeast1", // 念のためここでも指定
    timeoutSeconds: 15,  // タイムアウト設定
    maxInstances: 10     // インスタンス数を制限してコスト急増を防止
}, async (request) => {
    // ★第2世代では、データは request.data に入っています
    const targetUrl = request.data.url;

    if (!targetUrl) {
        throw new HttpsError("invalid-argument", "URLが必要です。");
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                // FANZA/DMM対策のヘッダーセット
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Cookie": "age_check_done=1; adult_checked=1; i3_opnd=1; m_age_check_done=1",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
                "Referer": "https://www.dmm.co.jp/",
                "Cache-Control": "max-age=0",
                "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1"
            },
            timeout: 8000,
            maxRedirects: 5
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // ヘルパー関数
        const getMeta = (prop) => {
            return $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content");
        };

        // 情報取得
        let title = getMeta("og:title") || $("title").text() || "";
        
        // ログイン画面判定 (ログに残す)
        if (title.includes("ログイン") || title.includes("Login")) {
            console.warn("Redirected to Login page.");
        }

        const description = getMeta("og:description") || getMeta("description") || "";
        let image = getMeta("og:image") || "";
        let siteName = getMeta("og:site_name");

        // タイトル整形
        if (title) {
            title = title.replace(/\s*\[.+?\]\s*\|\s*DLsite.*/i, '');
            title = title.replace(/\s*\(.+?\)\s*[|｜]\s*FANZA.*/i, '');
            title = title.replace(/\s*-\s*FANZA.*/i, '');
            title = title.trim();
        }

        // 画像URL修正
        if (image && !image.startsWith("http")) {
            try {
                const urlObj = new URL(targetUrl);
                image = `${urlObj.protocol}//${urlObj.host}${image}`;
            } catch (e) {}
        }

        // サイト名修正
        if (!siteName) {
            try {
                const urlObj = new URL(targetUrl);
                siteName = urlObj.hostname;
            } catch (e) { siteName = ""; }
        }

        return {
            success: true,
            data: {
                title: title,
                description: description.trim(),
                image: image,
                url: targetUrl,
                siteName: siteName,
            },
        };

    } catch (error) {
        console.error("Preview Error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
});