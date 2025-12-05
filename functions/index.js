const functions = require("firebase-functions");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors")({ origin: true });

exports.getLinkPreview = functions.https.onCall(async (data, context) => {
  const targetUrl = data.url;

  if (!targetUrl) {
    throw new functions.https.HttpsError("invalid-argument", "URLが必要です。");
  }

  try {
    // 1. URLのHTMLを取得
    const response = await axios.get(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 5000, // 5秒でタイムアウト
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 2. OGPタグなどから情報を抽出
    const getMeta = (prop) =>
      $(`meta[property="${prop}"]`).attr("content") ||
      $(`meta[name="${prop}"]`).attr("content");

    const title = getMeta("og:title") || $("title").text() || "";
    const description = getMeta("og:description") || getMeta("description") || "";
    let image = getMeta("og:image") || "";
    let siteName = getMeta("og:site_name");

    // 画像URLが相対パスの場合は絶対パスに変換
    if (image && !image.startsWith("http")) {
      try {
        const urlObj = new URL(targetUrl);
        image = `${urlObj.protocol}//${urlObj.host}${image}`;
      } catch (e) { /* URL解析失敗時はそのまま */ }
    }

    // サイト名がない場合はドメイン名を使用
    if (!siteName) {
      try {
        const urlObj = new URL(targetUrl);
        siteName = urlObj.hostname;
      } catch (e) { siteName = ""; }
    }

    return {
      success: true,
      data: {
        title: title.trim(),
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