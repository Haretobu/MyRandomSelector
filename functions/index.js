const functions = require("firebase-functions");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors")({ origin: true });

// ヘルパー関数を先に定義 (エラー防止)
const getMeta = ($, prop) => {
    return $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content");
};

// 東京リージョン (asia-northeast1) を指定
exports.getLinkPreview = functions.region('asia-northeast1').https.onCall(async (data, context) => {
    // データ形式の正規化 (Gen1 / Gen2 両対応)
    const requestData = (data && data.data) ? data.data : data;
    const targetUrl = requestData.url;

    if (!targetUrl) {
        throw new functions.https.HttpsError("invalid-argument", "URLが必要です。");
    }

    try {
        const response = await axios.get(targetUrl, {
            headers: {
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
            timeout: 8000, // 8秒タイムアウト
            maxRedirects: 5
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // タイトル取得
        let title = getMeta($, "og:title") || $("title").text() || "";
        
        // ログイン画面判定 (ログに出すだけ)
        if (title.includes("ログイン") || title.includes("Login")) {
            console.warn("Redirected to Login page.");
        }

        const description = getMeta($, "og:description") || getMeta($, "description") || "";
        let image = getMeta($, "og:image") || "";
        let siteName = getMeta($, "og:site_name");

        // タイトルのクリーニング (サークル名・サイト名除去)
        if (title) {
            title = title.replace(/\s*\[.+?\]\s*\|\s*DLsite.*/i, '');
            title = title.replace(/\s*\(.+?\)\s*[|｜]\s*FANZA.*/i, '');
            title = title.replace(/\s*-\s*FANZA.*/i, '');
            title = title.trim();
        }

        // 画像URLの絶対パス化
        if (image && !image.startsWith("http")) {
            try {
                const urlObj = new URL(targetUrl);
                image = `${urlObj.protocol}//${urlObj.host}${image}`;
            } catch (e) {}
        }

        // サイト名の補完
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