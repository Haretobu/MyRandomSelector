const functions = require("firebase-functions");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors")({ origin: true });

exports.getLinkPreview = functions.https.onCall(async (data, context) => {
  // 第1世代・第2世代の両方のデータ形式に対応
  const requestData = (data && data.data) ? data.data : data;
  const targetUrl = requestData.url;

  if (!targetUrl) {
    throw new functions.https.HttpsError("invalid-argument", "URLが必要です。");
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        // ★修正1: 年齢認証を回避するためのCookieを追加
        "Cookie": "age_check_done=1; adult_checked=1", 
      },
      timeout: 5000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const getMeta = (prop) =>
      $(`meta[property="${prop}"]`).attr("content") ||
      $(`meta[name="${prop}"]`).attr("content");

    let title = getMeta("og:title") || $("title").text() || "";
    const description = getMeta("og:description") || getMeta("description") || "";
    let image = getMeta("og:image") || "";
    let siteName = getMeta("og:site_name");

    // ★修正2: タイトルの不要な部分（サークル名やサイト名）を削除
    if (title) {
        // DLsite用: [サークル名] | DLsite... を削除
        // 例: "作品名 [サークル] | DLsite" -> "作品名"
        title = title.replace(/\s*\[.+?\]\s*\|\s*DLsite.*/i, '');

        // FANZA用: (サークル名)｜FANZA... を削除 (全角・半角パイプ対応)
        // 例: "作品名 (サークル)｜FANZA同人" -> "作品名"
        title = title.replace(/\s*\(.+?\)\s*[|｜]\s*FANZA.*/i, '');
        
        // 余分な空白をトリム
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