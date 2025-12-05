const functions = require("firebase-functions");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors")({ origin: true });

exports.getLinkPreview = functions.https.onCall(async (data, context) => {
  // ★修正ポイント: 第2世代(Gen2)と第1世代(Gen1)の両方に対応させる
  // Gen2の場合、実データは data.data に入っています。Gen1なら data そのものです。
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
      },
      timeout: 5000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const getMeta = (prop) =>
      $(`meta[property="${prop}"]`).attr("content") ||
      $(`meta[name="${prop}"]`).attr("content");

    const title = getMeta("og:title") || $("title").text() || "";
    const description = getMeta("og:description") || getMeta("description") || "";
    let image = getMeta("og:image") || "";
    let siteName = getMeta("og:site_name");

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