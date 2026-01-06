import { store as AppState } from './store/store.js';

export const AdManager = {
    // 広告設定（デフォルト）
    settings: {
        enabled: true,
        type: 'random', // random, unrated
        interval: 10000 // ローテーション間隔(ms) ※今回は静的表示からスタート
    },

    init: (App) => {
        // 設定のロード（localStorage）
        const saved = localStorage.getItem('ad_settings');
        if (saved) AdManager.settings = JSON.parse(saved);
        
        // 広告エリアの準備（index.htmlに追加された要素をターゲットにする）
        AdManager.render(App);
    },

    getTargetWork: () => {
        const works = AppState.works;
        if (!works || works.length === 0) return null;

        // 設定に応じて作品を選出（現在はランダムのみ）
        let pool = works;
        if (AdManager.settings.type === 'unrated') {
            pool = works.filter(w => !w.rating);
            if (pool.length === 0) pool = works;
        }
        
        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
    },

    render: (App) => {
        const container = document.getElementById('ad-banner-container');
        if (!container || !AdManager.settings.enabled) {
            if (container) container.classList.add('hidden');
            return;
        }

        const work = AdManager.getTargetWork();
        if (!work) return;

        container.classList.remove('hidden');
        
        // DLsiteのブログパーツ風デザイン
        // クリックで詳細モーダルを開く
        const imageUrl = work.imageUrl || 'https://placehold.co/200x200/374151/9ca3af?text=No+Image';
        
        // ★修正: ここで直接HTML文字列を作成するように変更
        let siteBadge = '';
        if (work.sourceUrl) {
            if (work.sourceUrl.includes('dlsite')) siteBadge = '<span class="px-1 text-[10px] bg-sky-600 text-white rounded mr-1">DL</span>';
            else if (work.sourceUrl.includes('dmm')) siteBadge = '<span class="px-1 text-[10px] bg-red-600 text-white rounded mr-1">FZ</span>';
        }

        const ratingStar = '★'.repeat(work.rating || 0);

        container.innerHTML = `
            <div class="cursor-pointer bg-gray-800 border border-gray-600 rounded flex overflow-hidden shadow-md hover:bg-gray-700 transition-colors h-24 relative group">
                <div class="absolute top-0 right-0 bg-gray-600 text-[10px] text-white px-1 z-10 opacity-70">PR</div>
                <div class="w-24 h-24 flex-shrink-0 bg-gray-900">
                    <img src="${imageUrl}" class="w-full h-full object-cover">
                </div>
                <div class="p-2 flex flex-col justify-between flex-grow min-w-0">
                    <div>
                        <div class="text-xs text-sky-400 font-bold truncate mb-1 flex items-center gap-1">
                            ${siteBadge} <span>${App.escapeHTML(work.genre)}</span>
                        </div>
                        <div class="text-sm font-bold text-gray-200 line-clamp-2 leading-tight group-hover:text-sky-300 transition-colors">
                            ${App.escapeHTML(work.name)}
                        </div>
                    </div>
                    <div class="flex justify-between items-end">
                        <div class="text-yellow-500 text-xs">${ratingStar}</div>
                        <div class="text-[10px] text-gray-400">登録作品からのおすすめ</div>
                    </div>
                </div>
            </div>
        `;

        container.onclick = () => {
            App.openEditModal(work.id);
        };
    },

    toggleVisibility: (App) => {
        AdManager.settings.enabled = !AdManager.settings.enabled;
        localStorage.setItem('ad_settings', JSON.stringify(AdManager.settings));
        AdManager.render(App);
        App.showToast(AdManager.settings.enabled ? "広告を表示しました" : "広告を非表示にしました");
    }
};