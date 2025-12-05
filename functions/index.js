const functions = require("firebase-functions");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors")({ origin: true });

// ★修正: 日本のサーバー(東京)を指定する
exports.getLinkPreview = functions.region('asia-northeast1').https.onCall(async (data, context) => {
  // 第2世代(Gen2)と第1世代(Gen1)の両方に対応
  const requestData = (data && data.data) ? data.data : data;
  const targetUrl = requestData.url;

  if (!targetUrl) {
    throw new functions.https.HttpsError("invalid-argument", "URLが必要です。");
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        // ★最強の偽装ヘッダーセット
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Cookie": "age_check_done=1; adult_checked=1; i3_opnd=1; m_age_check_done=1", // i3_opndなども追加
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7", // 日本語を優先
        "Referer": "https://www.dmm.co.jp/", // DMM内部からの遷移を装う
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
      timeout: 8000, // タイムアウトを少し延長
      maxRedirects: 5
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // タイトルが「ログイン」になってしまった場合のチェック
    let title = getMeta($,"og:title") || $("title").text() || "";
    if (title.includes("ログイン") || title.includes("Login")) {
        // ログイン画面に飛ばされた場合は、URLからIDだけでも抽出を試みるなどの救済措置が可能ですが、
        // まずはエラーとして返さず、取得できた範囲（画像など）を返すようにします。
        console.warn("Redirected to Login page.");
    }

    const description = getMeta($,"og:description") || getMeta($,"description") || "";
    let image = getMeta($,"og:image") || "";
    let siteName = getMeta($,"og:site_name");

    // タイトルの掃除 (サークル名などを除去)
    if (title) {
        title = title.replace(/\s*\[.+?\]\s*\|\s*DLsite.*/i, '');
        title = title.replace(/\s*\(.+?\)\s*[|｜]\s*FANZA.*/i, '');
        title = title.replace(/\s*-\s*FANZA.*/i, ''); // 追加パターン
        title = title.trim();
    }

    // 画像URLの補正
    if (image && !image.startsWith("http")) {
      try {
        const urlObj = new URL(targetUrl);
        image = `${urlObj.protocol}//${urlObj.host}${image}`;
      } catch (e) {}
    }

    // サイト名の補正
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

// ヘルパー関数
function getMeta($, prop) {
    return $(`meta[property="${prop}"]`).attr("content") || $(`meta[name="${prop}"]`).attr("content");
}