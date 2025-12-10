// src/ui.js
import { store as AppState } from './store.js';
import * as Utils from './utils.js';

// ヘルパー: $と$$はここでも使うので定義（またはutilsからインポートでも可）
const $ = (selector) => document.querySelector(selector);

// ★ 評価スターのHTML生成
export const renderRatingStars = (rating) => {
    const stars = [];
    const numRating = rating || 0;
    for (let i = 1; i <= 5; i++) {
        if (numRating >= i) {
            stars.push('<i class="fas fa-star text-yellow-400"></i>');
        } else if (numRating === (i - 0.5)) {
            stars.push('<i class="fas fa-star-half-alt text-yellow-400"></i>');
        } else {
            stars.push('<i class="far fa-star text-gray-500"></i>');
        }
    }
    return stars.join('');
};

// ★ サイトバッジの生成
export const getSiteBadgeHTML = (url) => {
    if (!AppState.showSiteIcon || !url) return '';
    if (url.includes('dlsite.com')) {
        return `<span class="site-badge bg-sky-600 text-white">DL</span>`;
    }
    if (url.includes('dmm.co.jp') || url.includes('dmm.com')) {
        return `<span class="site-badge bg-red-600 text-white">FZ</span>`;
    }
    return '';
};

export const renderTagsHTML = (tagIds, maxToShow = Infinity, workId = null, viewMode = 'grid') => {
    
    // ※注意: 元コードの App.getTagObjects を使う必要がありますが、
    // ここでは循環参照を避けるため、簡易的にStoreから直接引くロジックにします
    const getTagObjects = (ids) => Array.from(ids || []).map(id => AppState.tags.get(id)).filter(Boolean);
    const tags = getTagObjects(tagIds); // ← ここで正しく取得しているので、上の行は不要でした

    if (tags.length === 0) return '';

    const isExpanded = workId && AppState.expandedTagsWorkIds.has(workId);
    const displayLimit = isExpanded ? Infinity : maxToShow;
    const displayedTags = tags.slice(0, displayLimit);
    const hasMoreTags = tags.length > maxToShow && !isExpanded;

    const gapClass = viewMode === 'list' ? 'gap-1' : 'gap-2';
    const tagPaddingClass = viewMode === 'list' ? 'px-1 py-0' : 'px-1.5 py-0.5';

    let html = displayedTags.map(tag => {
        const safeName = Utils.escapeHTML(tag.name);
        return `<span class="${tagPaddingClass} rounded font-semibold text-xs" style="background-color:${tag.color}; color:${Utils.getContrastColor(tag.color)}">${safeName}</span>`;
    }).join('');

    if (hasMoreTags && workId) {
        html += ` <button data-action="toggle-tags" data-id="${workId}" class="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs">+${tags.length - maxToShow}</button>`;
    } else if (isExpanded && tags.length > maxToShow && workId) {
        html += ` <button data-action="toggle-tags" data-id="${workId}" class="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs">一部に戻す</button>`;
    } else if (hasMoreTags && !workId) {
        html += ` <span class="px-1.5 py-0.5 rounded bg-gray-600 font-semibold text-xs">+${tags.length - maxToShow}</span>`;
    }

    return `<div class="flex flex-wrap ${gapClass} text-xs">${html}</div>`;
};

// ★ カード表示（グリッド）のHTML生成
// ★ カード表示（グリッド）のHTML生成
export const renderWorkCard = (work) => {
    const safeWorkName = Utils.escapeHTML(work.name);
    const siteBadge = getSiteBadgeHTML(work.sourceUrl);
    const isMobile = Utils.isMobile();
    const isLinked = work.isLocallyLinked === true;
    
    const rocketClass = isLinked 
        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30" 
        : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50";
    const rocketVisibility = isMobile ? "hidden" : "";
    const rocketLink = isLinked ? `href="nightowl://play?id=${work.id}"` : "";
    const rocketTitle = isLinked ? "PCで起動" : "PC連携未設定";

    return `
    <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col transition-transform hover:scale-[1.02]">
        <div class="relative">
            <img src="${work.imageUrl || 'https://placehold.co/600x400/1f2937/4b5563?text=No+Image'}" alt="${safeWorkName}" loading="lazy" decoding="async" class="w-full h-40 object-cover">
            ${siteBadge}
            <div class="absolute top-2 right-2 flex space-x-2">
                <a ${rocketLink} title="${rocketTitle}" class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${rocketClass} ${rocketVisibility}">
                    <i class="fas fa-rocket text-xs"></i>
                </a>
                <button data-action="edit" data-id="${work.id}" title="編集" class="w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><i class="fas fa-pencil-alt text-sm"></i></button>
                <button data-action="delete" data-id="${work.id}" data-name="${safeWorkName}" title="削除" class="w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><i class="fas fa-trash-alt text-sm"></i></button>
            </div>
            <span class="absolute bottom-2 left-2 px-2 py-0.5 bg-black bg-opacity-60 text-xs rounded">${work.genre}</span>
        </div>
        <div class="p-4 flex flex-col flex-grow">
            <p class="text-sm text-gray-400">${work.registeredAt ? Utils.formatDate(work.registeredAt, false) : 'N/A'}</p>
            <h3 class="text-lg font-bold mt-1 mb-2 flex-grow cursor-pointer" data-action="copy-name" data-name="${safeWorkName}">${safeWorkName}</h3>
            <div class="flex items-center space-x-1 mb-3">${renderRatingStars(work.rating)}</div>
            ${renderTagsHTML(work.tagIds, 5, work.id, 'grid')} 
        </div>
    </div>`;
};

// ★ リスト表示のHTML生成
export const renderWorkListItem = (work) => {
    const safeWorkName = Utils.escapeHTML(work.name);
    const siteBadge = getSiteBadgeHTML(work.sourceUrl);
    const isMobile = Utils.isMobile();
    const isLinked = work.isLocallyLinked === true;
    
    const rocketColor = isLinked ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-gray-600 hover:bg-gray-500 opacity-50";
    const rocketVisibility = isMobile ? "hidden" : "";
    const rocketLink = isLinked ? `href="nightowl://play?id=${work.id}"` : "";
    const rocketTitle = isLinked ? "PCで起動" : "PC連携未設定";

    return `
    <div class="work-list-item">
        <div class="relative flex-shrink-0">
            <img src="${work.imageUrl || 'https://placehold.co/150x100/1f2937/4b5563?text=No+Img'}" alt="${safeWorkName}" loading="lazy" decoding="async" class="w-20 h-16 object-cover rounded-md">
            ${siteBadge}
        </div>
        <div class="flex-grow min-w-0 overflow-hidden">
            <p class="font-bold cursor-pointer line-clamp-2" data-action="copy-name" data-name="${safeWorkName}">${safeWorkName}</p>
            <div class="flex items-center flex-wrap gap-x-4 text-sm text-gray-400 truncate">
                <span>${work.genre}</span><span>${work.registeredAt ? Utils.formatDate(work.registeredAt, false) : 'N/A'}</span>
                <span class="flex items-center space-x-1">${renderRatingStars(work.rating)}</span>
            </div>
            ${renderTagsHTML(work.tagIds, 4, null, 'list')} 
        </div>
        <div class="flex-shrink-0 flex space-x-2">
            <a ${rocketLink} title="${rocketTitle}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-all ${rocketColor} ${rocketVisibility}">
                <i class="fas fa-rocket"></i>
            </a>
            <button data-action="edit" data-id="${work.id}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-500"><i class="fas fa-edit"></i></button>
            <button data-action="delete" data-id="${work.id}" data-name="${safeWorkName}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"><i class="fas fa-trash"></i></button>
        </div>
    </div>`;
};

// src/ui.js の末尾に追加

// ★ トースト通知の表示
export const showToast = (message, type = 'info', duration = 3000) => {
    // AppState.ui が初期化される前に呼ばれるのを防ぐガード
    if (!AppState.ui || !AppState.ui.toastEl) return;

    let finalDuration = duration;
    AppState.ui.toastEl.classList.remove('bg-red-600', 'bg-gray-700');

    if (type === 'error') {
        finalDuration = 5000; // エラー時は5秒
        AppState.ui.toastEl.classList.add('bg-red-600');
    } else {
        AppState.ui.toastEl.classList.add('bg-gray-700');
    }
    AppState.ui.toastMessageEl.textContent = message;
    
    // アニメーション用クラスの付け替え
    AppState.ui.toastEl.classList.remove('translate-y-20', 'opacity-0');
    AppState.ui.toastEl.classList.add('translate-y-0', 'opacity-100');
    
    setTimeout(() => {
        if (AppState.ui.toastEl) {
            AppState.ui.toastEl.classList.remove('translate-y-0', 'opacity-100');
            AppState.ui.toastEl.classList.add('translate-y-20', 'opacity-0');
        }
    }, finalDuration);
};

// ★ 確認モーダルの表示 (Promiseを返すので await showConfirm(...) で使えます)
export const showConfirm = (title, message) => {
    return new Promise((resolve) => {
        if (!AppState.ui || !AppState.ui.confirmModal) {
            resolve(false);
            return;
        }

        AppState.ui.confirmTitle.textContent = title;
        AppState.ui.confirmMessage.innerHTML = message;
        AppState.ui.confirmModal.classList.remove('hidden');

        const cleanup = () => {
            AppState.ui.confirmModal.classList.add('hidden');
            AppState.ui.confirmOkBtn.removeEventListener('click', okHandler);
            AppState.ui.confirmCancelBtn.removeEventListener('click', cancelHandler);
        };

        const okHandler = () => {
            cleanup();
            resolve(true);
        };
        const cancelHandler = () => {
            cleanup();
            resolve(false);
        };
        
        AppState.ui.confirmOkBtn.addEventListener('click', okHandler);
        AppState.ui.confirmCancelBtn.addEventListener('click', cancelHandler);
    });
};

// ★ モバイル判定 (Utilsにあるものを使っても良いですが、UI制御で頻出なのでここでもexport)
export const isMobile = () => {
    return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};