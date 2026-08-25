import Fuse from 'fuse.js';
// ▼ 修正: パスを './store' から './store/store.js' に変更
import { store as AppState } from './store/store.js';

let fuseInstance = null;

// Fuse.jsの初期化・インデックス再構築
// 作品リストが更新されたら呼び出す
export const initSearchIndex = (works) => {
    const options = {
        includeScore: true,
        threshold: 0.3, // 0.0(完全一致) 〜 1.0(何でも一致)。0.3くらいが誤検知少なめで良い
        keys: [
            { name: 'name', weight: 0.7 },  // 作品名は最重要
            { name: 'genre', weight: 0.2 },
            { name: 'tagNames', weight: 0.3 } // 検索用にタグ名を結合したプロパティを作ると便利
        ]
    };
    
    // 検索用にデータを整形（タグIDではなくタグ名で検索したい場合）
    const searchableWorks = works.map(w => ({
        ...w,
        tagNames: (w.tagIds || []).map(id => {
            const tag = AppState.tags.get(id);
            return tag ? tag.name : '';
        }).join(' ')
    }));

    fuseInstance = new Fuse(searchableWorks, options);
};

// 検索実行
export const searchWorks = (query) => {
    if (!query) return AppState.works; // クエリなしなら全件
    if (!fuseInstance) initSearchIndex(AppState.works);

    const results = fuseInstance.search(query);
    // Fuseの結果は { item: Work, score: number } の配列なので、itemだけ取り出す
    return results.map(result => result.item);
};

// ▼ 修正: キーボードショートカットの処理は main.js 側（モーダル開閉状態を考慮した実装）に一本化。
// ここに同じ内容の document.addEventListener('keydown', ...) が重複して存在すると、
// main.js側が「モーダルが開いているのでショートカット無効」と判断していても、
// このリスナーはモーダルの状態を見ずに 'l'（抽選）や 'f'（検索）を実行してしまい、
// 抽選結果モーダルで評価・タグを入力中に未保存のまま次の抽選が走る不具合の原因になっていた。