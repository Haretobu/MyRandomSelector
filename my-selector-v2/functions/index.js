const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const Fuse = require('fuse.js');
const axios = require("axios");
const cheerio = require("cheerio");

// 東京リージョンをデフォルトに設定
setGlobalOptions({ region: "asia-northeast1" });

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// ============================================================================
// 1. URLからプレビュー情報（OGP）を取得する機能（過去プロジェクトの優秀なコード）
// ============================================================================
exports.getLinkPreview = onCall({
    cors: true,
    region: "asia-northeast1",
    timeoutSeconds: 15,
    maxInstances: 10
}, async (request) => {
    const targetUrl = request.data.url;

    if (!targetUrl) {
        throw new HttpsError("invalid-argument", "URLが必要です。");
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
            timeout: 8000,
            maxRedirects: 5
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const getMeta = (prop) => {
            return $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content");
        };

        let title = getMeta("og:title") || $("title").text() || "";
        
        if (title.includes("ログイン") || title.includes("Login")) {
            console.warn("Redirected to Login page.");
        }

        const description = getMeta("og:description") || getMeta("description") || "";
        let image = getMeta("og:image") || "";
        let siteName = getMeta("og:site_name");

        if (title) {
            title = title.replace(/\s*\[.+?\]\s*\|\s*DLsite.*/i, '');
            title = title.replace(/\s*\(.+?\)\s*[|｜]\s*FANZA.*/i, '');
            title = title.replace(/\s*-\s*FANZA.*/i, '');
            title = title.trim();
        }

        if (image && !image.startsWith("http")) {
            try {
                const urlObj = new URL(targetUrl);
                image = `${urlObj.protocol}//${urlObj.host}${image}`;
            } catch (e) {}
        }

        if (!siteName) {
            try {
                const urlObj = new URL(targetUrl);
                siteName = urlObj.hostname;
            } catch (e) { siteName = ""; }
        }

        return {
            success: true,
            data: { title: title, description: description.trim(), image: image, url: targetUrl, siteName: siteName }
        };

    } catch (error) {
        console.error("Preview Error:", error);
        return { success: false, error: error.message };
    }
});

// ============================================================================
// 2. 多重購入チェッカー用API（今回作成したコード）
// ============================================================================
const normalizeTitle = (title) => {
    if (!title) return '';
    return title.replace(/【.*?】/g, '').replace(/\[.*?\]/g, '').replace(/（.*?）|\(.*?\)/g, '').trim();
};

exports.checkDuplicates = onRequest({ region: 'asia-northeast1' }, (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

        try {
            const { appId, syncId, titles } = req.body;
            if (!appId || !syncId || !Array.isArray(titles)) {
                return res.status(400).json({ error: '無効なリクエストパラメータです。' });
            }

            const worksRef = db.collection(`artifacts/${appId}/public/data/r18_works_sync/${syncId}/items`);
            const snapshot = await worksRef.get();
            
            const works = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                works.push({ ...data, normalizedName: normalizeTitle(data.name) });
            });

            const fuseOptions = {
                includeScore: true, threshold: 0.4, ignoreLocation: true,
                keys: [{ name: 'normalizedName', weight: 1.0 }]
            };
            const fuse = new Fuse(works, fuseOptions);

            const results = titles.map(title => {
                const normalizedQuery = normalizeTitle(title);
                const searchResult = fuse.search(normalizedQuery);
                
                if (searchResult.length > 0) {
                    const bestMatch = searchResult[0];
                    const score = bestMatch.score;
                    let status = 'none';
                    if (score < 0.05) status = 'exact';
                    else if (score < 0.15) status = 'high_match';
                    else if (score < 0.3) status = 'similar';
                    else if (score <= 0.4) status = 'low_match';

                    if (status !== 'none') {
                        return { title: title, status: status, matchedTitle: bestMatch.item.name, url: bestMatch.item.sourceUrl };
                    }
                }
                return { title: title, status: 'none' };
            });

            res.status(200).json({ results });
        } catch (error) {
            console.error("エラーが発生しました:", error);
            res.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
        }
    });
});