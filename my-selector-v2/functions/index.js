const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const Fuse = require('fuse.js');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// ★追加：タイトルから邪魔な記号と宣伝文句を除外する関数
const normalizeTitle = (title) => {
    if (!title) return '';
    return title
        .replace(/【.*?】/g, '') // 【】とその中身を削除
        .replace(/\[.*?\]/g, '') // []とその中身を削除
        .replace(/（.*?）|\(.*?\)/g, '') // ()や（）とその中身を削除
        .trim(); // 前後の空白を削除
};

exports.checkDuplicates = onRequest({ region: 'asia-northeast1' }, (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        try {
            const { appId, syncId, titles } = req.body;

            if (!appId || !syncId || !Array.isArray(titles)) {
                return res.status(400).json({ error: '無効なリクエストパラメータです。' });
            }

            const worksRef = db.collection(`artifacts/${appId}/public/data/r18_works_sync/${syncId}/items`);
            const snapshot = await worksRef.get();
            
            // ★変更：登録済み作品の名前も正規化（大掃除）しておく
            const works = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                works.push({
                    ...data,
                    normalizedName: normalizeTitle(data.name)
                });
            });

            // ★変更：Fuse.jsの判定をチューニング
            const fuseOptions = {
                includeScore: true,
                threshold: 0.4, // 以前より広く拾うようにする（後で細かく分類するため）
                ignoreLocation: true, // 文字列の長さが違っても、一致部分があれば評価を高くする
                keys: [{ name: 'normalizedName', weight: 1.0 }] // 正規化した名前で検索
            };
            const fuse = new Fuse(works, fuseOptions);

            const results = titles.map(title => {
                // カート内の作品名も正規化して検索にかける
                const normalizedQuery = normalizeTitle(title);
                const searchResult = fuse.search(normalizedQuery);
                
                if (searchResult.length > 0) {
                    const bestMatch = searchResult[0];
                    const score = bestMatch.score;

                    // ★変更：スコアに応じて段階を細かく設定
                    let status = 'none';
                    if (score < 0.05) {
                        status = 'exact'; // ほぼ完全一致
                    } else if (score < 0.15) {
                        status = 'high_match'; // 激似（シリーズ番号違いなど）
                    } else if (score < 0.3) {
                        status = 'similar'; // 類似（サブタイトルの有無など）
                    } else if (score <= 0.4) {
                        status = 'low_match'; // 部分一致（もしかして？）
                    }

                    if (status !== 'none') {
                        return { 
                            title: title, 
                            status: status, 
                            matchedTitle: bestMatch.item.name, // ここで元の登録名（正規化前）を返す
                            url: bestMatch.item.sourceUrl 
                        };
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