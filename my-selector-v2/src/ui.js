// src/ui.js
import { store as AppState } from './store.js';
import * as Utils from './utils.js';
import { html, nothing } from 'lit-html';

// ★高速化: プレースホルダー画像をBase64(SVG)で埋め込み、外部通信(placehold.co)を削減
const NO_IMG_DATA = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400' fill='%231f2937'%3E%3Crect width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-weight='bold' font-size='48' fill='%234b5563' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";

// ★ 評価スターの生成 (lit-html版)
export const renderRatingStars = (rating) => {
    const numRating = rating || 0;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        if (numRating >= i) {
            stars.push(html`<i class="fas fa-star text-yellow-400"></i>`);
        } else if (numRating === (i - 0.5)) {
            stars.push(html`<i class="fas fa-star-half-alt text-yellow-400"></i>`);
        } else {
            stars.push(html`<i class="far fa-star text-gray-500"></i>`);
        }
    }
    return stars;
};

// ★ サイトバッジの生成 (lit-html版)
export const getSiteBadgeHTML = (url) => {
    if (!url) return nothing;

    const lowerUrl = url.toLowerCase();
    const baseClass = "absolute top-1.5 left-1.5 h-4 flex items-center justify-center px-1 text-[10px] font-extrabold rounded shadow-md pointer-events-none z-50 text-white";
    
    if (lowerUrl.includes('dlsite.com')) {
        return html`<span class="${baseClass} bg-sky-600">DL</span>`;
    }
    if (lowerUrl.includes('dmm.co.jp') || lowerUrl.includes('dmm.com')) {
        return html`<span class="${baseClass} bg-red-600">FZ</span>`;
    }
    return nothing;
};

// ★ タグの生成 (lit-html版)
export const renderTagsHTML = (tagIds, maxToShow = Infinity, workId = null, viewMode = 'grid') => {
    // 循環参照回避のためStoreから直接取得
    const tags = Array.from(tagIds || []).map(id => AppState.tags.get(id)).filter(Boolean);

    if (tags.length === 0) return nothing;

    const isExpanded = workId && AppState.expandedTagsWorkIds.has(workId);
    const displayLimit = isExpanded ? Infinity : maxToShow;
    const displayedTags = tags.slice(0, displayLimit);
    const hasMoreTags = tags.length > maxToShow && !isExpanded;

    const gapClass = viewMode === 'list' ? 'gap-1' : 'gap-2';
    const tagPaddingClass = viewMode === 'list' ? 'px-1 py-0' : 'px-1.5 py-0.5';

    return html`
    <div class="flex flex-wrap ${gapClass} text-xs">
        ${displayedTags.map(tag => {
            const style = `background-color:${tag.color}; color:${Utils.getContrastColor(tag.color)}`;
            return html`<span class="${tagPaddingClass} rounded font-semibold text-xs" style="${style}">${tag.name}</span>`;
        })}
        
        ${hasMoreTags && workId ? html`
            <button data-action="toggle-tags" data-id="${workId}" class="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs">
                +${tags.length - maxToShow}
            </button>
        ` : nothing}

        ${isExpanded && tags.length > maxToShow && workId ? html`
            <button data-action="toggle-tags" data-id="${workId}" class="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs">
                一部に戻す
            </button>
        ` : nothing}

        ${hasMoreTags && !workId ? html`
            <span class="px-1.5 py-0.5 rounded bg-gray-600 font-semibold text-xs">+${tags.length - maxToShow}</span>
        ` : nothing}
    </div>`;
};

// ★ カード表示 (グリッド) (lit-html版)
export const renderWorkCard = (work) => {
    const isMobile = Utils.isMobile();
    const isLinked = work.isLocallyLinked === true;
    
    const rocketClass = isLinked 
        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30" 
        : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50";
    const rocketVisibility = isMobile ? "hidden" : "";
    
    return html`
    <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col transition-transform hover:scale-[1.02]">
        <div class="relative bg-gray-700">
            <img src="${work.imageUrl || NO_IMG_DATA}" 
                 alt="${work.name}" 
                 loading="lazy" 
                 decoding="async" 
                 class="w-full h-40 object-cover">
            
            ${getSiteBadgeHTML(work.sourceUrl)}
            
            <div class="absolute top-2 right-2 flex space-x-2">
                <a href="${isLinked ? `nightowl://play?id=${work.id}` : 'javascript:void(0)'}" 
                   title="${isLinked ? "PCで起動" : "PC連携未設定"}" 
                   class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${rocketClass} ${rocketVisibility}"
                   @click=${(e) => !isLinked && e.preventDefault()}>
                    <i class="fas fa-rocket text-xs"></i>
                </a>
                <button data-action="edit" data-id="${work.id}" title="編集" class="w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <i class="fas fa-pencil-alt text-sm"></i>
                </button>
                <button data-action="delete" data-id="${work.id}" data-name="${work.name}" title="削除" class="w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <i class="fas fa-trash-alt text-sm"></i>
                </button>
            </div>
            <span class="absolute bottom-2 left-2 px-2 py-0.5 bg-black bg-opacity-60 text-xs rounded">${work.genre}</span>
        </div>
        <div class="p-4 flex flex-col flex-grow">
            <p class="text-sm text-gray-400">${work.registeredAt ? Utils.formatDate(work.registeredAt, false) : 'N/A'}</p>
            <h3 class="text-lg font-bold mt-1 mb-2 flex-grow cursor-pointer" data-action="copy-name" data-name="${work.name}">
                ${work.name}
            </h3>
            <div class="flex items-center space-x-1 mb-3">
                ${renderRatingStars(work.rating)}
            </div>
            ${renderTagsHTML(work.tagIds, 5, work.id, 'grid')} 
        </div>
    </div>`;
};

// ★ リスト表示 (lit-html版)
export const renderWorkListItem = (work) => {
    const isMobile = Utils.isMobile();
    const isLinked = work.isLocallyLinked === true;
    
    const rocketColor = isLinked ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-gray-600 hover:bg-gray-500 opacity-50";
    const rocketVisibility = isMobile ? "hidden" : "";

    return html`
    <div class="work-list-item">
        <div class="relative flex-shrink-0 bg-gray-700">
            <img src="${work.imageUrl || NO_IMG_DATA}" 
                 alt="${work.name}" 
                 loading="lazy" 
                 decoding="async" 
                 class="w-20 h-16 object-cover rounded-md">
            ${getSiteBadgeHTML(work.sourceUrl)}
        </div>
        <div class="flex-grow min-w-0 overflow-hidden">
            <p class="font-bold cursor-pointer line-clamp-2" data-action="copy-name" data-name="${work.name}">${work.name}</p>
            <div class="flex items-center flex-wrap gap-x-4 text-sm text-gray-400 truncate">
                <span>${work.genre}</span><span>${work.registeredAt ? Utils.formatDate(work.registeredAt, false) : 'N/A'}</span>
                <span class="flex items-center space-x-1">${renderRatingStars(work.rating)}</span>
            </div>
            ${renderTagsHTML(work.tagIds, 4, null, 'list')} 
        </div>
        <div class="flex-shrink-0 flex space-x-2">
            <a href="${isLinked ? `nightowl://play?id=${work.id}` : 'javascript:void(0)'}" 
               title="${isLinked ? "PCで起動" : "PC連携未設定"}" 
               class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-all ${rocketColor} ${rocketVisibility}"
               @click=${(e) => !isLinked && e.preventDefault()}>
                <i class="fas fa-rocket"></i>
            </a>
            <button data-action="edit" data-id="${work.id}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-500">
                <i class="fas fa-edit"></i>
            </button>
            <button data-action="delete" data-id="${work.id}" data-name="${work.name}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    </div>`;
};

// --- 以下は変更なしですが、ファイル全体を整合させるために記載します ---

export const showToast = (message, type = 'info', duration = 3000) => {
    if (!AppState.ui || !AppState.ui.toastEl) return;
    let finalDuration = duration;
    AppState.ui.toastEl.classList.remove('bg-red-600', 'bg-gray-700');
    if (type === 'error') {
        finalDuration = 5000;
        AppState.ui.toastEl.classList.add('bg-red-600');
    } else {
        AppState.ui.toastEl.classList.add('bg-gray-700');
    }
    AppState.ui.toastMessageEl.textContent = message;
    AppState.ui.toastEl.classList.remove('translate-y-20', 'opacity-0');
    AppState.ui.toastEl.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        if (AppState.ui.toastEl) {
            AppState.ui.toastEl.classList.remove('translate-y-0', 'opacity-100');
            AppState.ui.toastEl.classList.add('translate-y-20', 'opacity-0');
        }
    }, finalDuration);
};

export const showConfirm = (title, message) => {
    return new Promise((resolve) => {
        if (!AppState.ui || !AppState.ui.confirmModal) { resolve(false); return; }
        AppState.ui.confirmTitle.textContent = title;
        AppState.ui.confirmMessage.innerHTML = message;
        AppState.ui.confirmModal.classList.remove('hidden');
        
        // ★修正: リスナーが重複しないように設計
        const cleanup = () => {
            AppState.ui.confirmModal.classList.add('hidden');
            AppState.ui.confirmOkBtn.removeEventListener('click', okHandler);
            AppState.ui.confirmCancelBtn.removeEventListener('click', cancelHandler);
        };
        const okHandler = () => { cleanup(); resolve(true); };
        const cancelHandler = () => { cleanup(); resolve(false); };
        
        AppState.ui.confirmOkBtn.addEventListener('click', okHandler);
        AppState.ui.confirmCancelBtn.addEventListener('click', cancelHandler);
    });
};

// ★ヘルパー: モバイル判定（Utilsのラッパーとして残すか、直接呼ぶ）
export const isMobile = () => {
    return Utils.isMobile();
};