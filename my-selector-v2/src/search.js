// src/search.js
import Fuse from 'fuse.js';
import { store as AppState } from './store';

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

document.addEventListener('keydown', (e) => {
    // 入力フォームにフォーカスがある時は無効化
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    switch(e.key.toLowerCase()) {
        case 'f': // Find
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
            break;
            
        case 'l': // Lottery
            e.preventDefault();
            const lotteryBtn = document.getElementById('startLotteryBtn');
            if (lotteryBtn) lotteryBtn.click();
            break;
            
        case 'n': // New (Add Work) - モーダルを開くなど
             // 実装に合わせて
             break;
             
        case 'escape': // Close Modal
             App.closeModal();
             break;
    }
});