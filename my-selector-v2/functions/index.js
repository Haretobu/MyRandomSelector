const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const Fuse = require('fuse.js');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// ここが新しい（v2）書き方です
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
            
            const works = [];
            snapshot.forEach(doc => works.push(doc.data()));

            const fuseOptions = {
                includeScore: true,
                threshold: 0.3,
                keys: [{ name: 'name', weight: 1.0 }]
            };
            const fuse = new Fuse(works, fuseOptions);

            const results = titles.map(title => {
                const searchResult = fuse.search(title);
                
                if (searchResult.length > 0) {
                    const bestMatch = searchResult[0];
                    if (bestMatch.score < 0.1) {
                        return { title: title, status: 'exact', matchedTitle: bestMatch.item.name, url: bestMatch.item.sourceUrl };
                    } else {
                        return { title: title, status: 'similar', matchedTitle: bestMatch.item.name, url: bestMatch.item.sourceUrl };
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