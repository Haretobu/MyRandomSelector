// src/modals.js

import { Timestamp, deleteField } from "firebase/firestore";
import { store as AppState } from './store/store.js';
import * as UI from './components/ui.js';
import * as Utils from './utils/utils.js';
import * as Actions from './services/actions.js';
// 循環参照を避けるため、main.js の App を直接 import せず、
// 必要な機能は関数の引数として受け取るか、専用のヘルパーを使います。
// ただし、今回は移行の過渡期として、window.App を利用する形（または関数内で動的import）で対応します。

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// --- ヘルパー: window.App への参照 ---
// ※ main.js が読み込まれた後でないと使えないため、関数の中で呼びます
const getApp = () => window.App;

// ★ 外部サイト検索モーダル
export const openExternalSearchModal = (prefillQuery = '') => {
    const sites = [
        { id: 'dlsite', name: 'DLsite', color: 'bg-blue-700', hover: 'hover:bg-blue-800' },
        { id: 'fanza', name: 'FANZA', color: 'bg-red-600', hover: 'hover:bg-red-700' },
        { id: 'melonbooks', name: 'Melonbooks', color: 'bg-green-600', hover: 'hover:bg-green-700' },
        { id: 'booth', name: 'Booth', color: 'bg-rose-500', hover: 'hover:bg-rose-600' }
    ];
    const safeQuery = Utils.escapeHTML(prefillQuery);
    const content = `
        <div class="space-y-4">
            <div>
                <label for="externalSearchInput" class="block text-sm font-medium text-gray-400 mb-1">検索クエリ</label>
                <div class="relative">
                    <input type="text" id="externalSearchInput" value="${safeQuery}" placeholder="作品名などを入力..." class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10">
                    <button type="button" id="clear-externalSearchInput" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-400 mb-2">検索するサイトを選択</label>
                <div id="external-site-buttons" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    ${sites.map(site => `<button data-site="${site.id}" class="w-full px-4 py-3 ${site.color} ${site.hover} rounded-lg font-bold text-lg transition-colors">${site.name}</button>`).join('')}
                </div>
            </div>
        </div>
    `;

    getApp().openModal("外部サイトで検索", content, () => {
        const siteButtons = $('#external-site-buttons');
        const searchInput = $('#externalSearchInput');
        getApp().setupInputClearButton(searchInput, $('#clear-externalSearchInput'));

        if (searchInput) setTimeout(() => searchInput.focus(), 100);

        if (siteButtons) {
            siteButtons.addEventListener('click', e => {
                const button = e.target.closest('button[data-site]');
                if (button) {
                    getApp().openSearchWindow(button.dataset.site, searchInput ? searchInput.value.trim() : '');
                }
            });
        }
    });
};

// ★ 履歴モーダル
export const openHistoryModal = () => {
    const allHistory = [];
    AppState.works.forEach(work => {
        if (work.selectionHistory && work.selectionHistory.length > 0) {
            work.selectionHistory.forEach(timestamp => {
                allHistory.push({ workId: work.id, workName: work.name, timestamp: timestamp });
            });
        }
    });
    allHistory.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

    let content;
    if (allHistory.length > 0) {
        content = `
            <div class="max-h-[60vh] overflow-y-auto pr-2">
                <ul id="history-list-ul" class="space-y-2"> ${allHistory.map(entry => `
                        <li>
                            <button data-id="${entry.workId}" class="w-full text-left bg-gray-700 p-3 rounded-lg flex justify-between items-center text-sm transition-colors hover:bg-gray-600">
                                <span class="font-semibold">${Utils.escapeHTML(entry.workName)}</span>
                                <span class="text-gray-400">${Utils.formatDate(entry.timestamp)}</span>
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>`;
    } else {
        content = `<div class="text-center py-10 text-gray-500"><i class="fas fa-history fa-3x"></i><p class="mt-4">まだ抽選履歴はありません。</p></div>`;
    }

    getApp().openModal("総合抽選履歴", content, () => {
        const listEl = $('#history-list-ul');
        if (!listEl) return;
        listEl.addEventListener('click', e => {
            const button = e.target.closest('button[data-id]');
            if (button) {
                const workId = button.dataset.id;
                if (workId) {
                    getApp().closeModal();
                    setTimeout(() => getApp().openEditModal(workId), 300);
                }
            }
        });
    }, { size: 'max-w-3xl' });
};

// ★ ヘルプモーダル
export const openHelpModal = () => {
    const content = `
        <div class="space-y-6 text-gray-300">
            <div>
                <h4 class="font-bold text-lg text-sky-400 mb-2">未評価またはタグ未設定の作品のみ</h4>
                <p>このオプションを有効にすると、まだ評価がされていない(★が0個)、またはタグが1つも設定されていない作品のみが抽選対象になります。</p>
            </div>
            <div>
                <h4 class="font-bold text-lg text-sky-400 mb-2">気分</h4>
                <p>特定の評価を持つ作品に絞り込んで抽選します。</p>
            </div>
            <div>
                <h4 class="font-bold text-lg text-sky-400 mb-2">登録日優先度</h4>
                <p>作品の登録日に基づいて、選ばれやすさを調整します。</p>
            </div>
            <div>
                <h4 class="font-bold text-lg text-sky-400 mb-2">抽選方法</h4>
                <p>抽選回数に基づいて、選ばれやすさを調整します。</p>
            </div>
        </div>
    `;
    getApp().openModal("ヘルプ：抽選設定", content);
};

// ★ メモ編集モーダル
export const openMemoModal = (workId, currentMemo, currentRating, currentTagIds, onConfirm) => {
    const content = `
        <div class="flex flex-col h-[60vh]">
            <textarea id="memo-editor-textarea" class="w-full h-full bg-gray-700 p-3 rounded-lg text-sm flex-grow" placeholder="感想やメモ...">${currentMemo}</textarea>
            <div class="pt-4 mt-4 border-t border-gray-700 flex justify-end">
                <button id="memo-modal-save" class="px-6 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold">決定</button>
            </div>
        </div>
    `;
    getApp().openModal("メモを編集", content, () => {
        const textarea = $('#memo-editor-textarea');
        setTimeout(() => textarea.focus(), 100);
        $('#memo-modal-save').addEventListener('click', () => {
            onConfirm(textarea.value);
        });
    });
};

// src/modals.js の続き

// ★ 作品編集モーダル
export const openEditModal = (workId, tempState = null) => {
    const App = getApp();
    const work = AppState.works.find(w => w.id === workId);
    if (!work) return;

    let currentRating = tempState?.rating ?? (work.rating || 0);
    let currentTagIds = tempState?.tagIds ?? new Set(work.tagIds || []);
    let currentMemo = tempState?.memo ?? (work.memo || '');

    const safeWorkName = Utils.escapeHTML(work.name);
    const safeWorkUrl = Utils.escapeHTML(work.sourceUrl || '');
    const storedFileName = work.imageFileName ? Utils.escapeHTML(work.imageFileName) : '';
    const fileNameDisplay = storedFileName || 'ファイルが選択されていません。';

    const pool = App.getLotteryPool();
    const thisWorkInPool = pool.find(w => w.id === workId);
    const totalWeight = pool.reduce((sum, w) => sum + w.weight, 0);
    let probabilityText = thisWorkInPool 
        ? `<span class="font-bold text-sky-400 text-base">${(totalWeight > 0 ? (thisWorkInPool.weight / totalWeight * 100).toFixed(2) : '0.00')}%</span>`
        : `<span class="font-bold text-gray-500">対象外</span>`;

    const registeredAtStr = work.registeredAt ? Utils.formatDate(work.registeredAt, false) : App.formatDateForInput(new Date());

    const content = `
        <form id="editWorkForm">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2 space-y-4">
                    <div>
                        <label for="editWorkName" class="block text-sm font-medium text-gray-400 mb-1">作品名</label>
                        <div class="flex items-center gap-2">
                            <div class="relative flex-grow">
                                <input type="text" id="editWorkName" value="${safeWorkName}" class="w-full bg-gray-700 p-2 rounded-lg pr-10" required> <button type="button" id="clear-editWorkName" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden"> <i class="fas fa-times-circle"></i></button>
                            </div>
                            <button type="button" id="copy-edit-title-btn" class="flex-shrink-0 w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-500" title="コピー"><i class="fas fa-copy"></i></button>
                        </div>
                    </div>
                    <div>
                        <label for="editWorkUrl" class="block text-sm font-medium text-gray-400 mb-1">作品URL</label>
                        <div class="relative group">
                            <div class="flex items-center gap-2">
                                <div class="relative flex-grow">
                                    <input type="url" id="editWorkUrl" value="${safeWorkUrl}" placeholder="https://..." class="w-full bg-gray-700 p-2 rounded-lg pr-10"> <button type="button" id="clear-editWorkUrl" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden"> <i class="fas fa-times-circle"></i></button>
                                </div>
                                <button type="button" id="openWorkUrlBtn" class="flex-shrink-0 w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-500" title="URLを開く" ${!safeWorkUrl ? 'disabled' : ''}><i class="fas fa-external-link-alt"></i></button>
                            </div>
                            <div id="edit-url-preview-box" class="hidden absolute z-50 top-full left-0 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="editWorkGenre" class="block text-sm font-medium text-gray-400 mb-1">ジャンル</label>
                            <select id="editWorkGenre" class="w-full bg-gray-700 p-2 rounded-lg">
                                <option value="漫画" ${work.genre === '漫画' ? 'selected' : ''}>漫画</option>
                                <option value="ゲーム" ${work.genre === 'ゲーム' ? 'selected' : ''}>ゲーム</option>
                                <option value="動画" ${work.genre === '動画' ? 'selected' : ''}>動画</option>
                            </select>
                        </div>
                        <div>
                            <label for="editWorkRegisteredAt" class="block text-sm font-medium text-gray-400 mb-1">登録日</label>
                            ${App.createDateInputHTML('editWorkRegisteredAt', registeredAtStr)}
                        </div>
                    </div>
                    <div><label class="block text-sm font-medium text-gray-400 mb-1">評価 (現在: ${currentRating} / 5)</label><div class="flex items-center space-x-2 text-2xl" id="editWorkRating"></div></div>
                    <div><label class="block text-sm font-medium text-gray-400 mb-1">タグ</label><div id="editWorkTags" class="flex flex-wrap gap-2 p-2 bg-gray-900 rounded-lg min-h-[40px] mb-2"></div><button type="button" id="editWorkAssignTagsBtn" class="w-full text-sm p-2 bg-gray-600 hover:bg-gray-700 rounded-lg">タグを割り当て/編集</button></div>
                    <div class="space-y-2 md:hidden"><label class="block text-sm font-medium text-gray-400">メモ</label><div id="memo-preview-display" class="w-full p-3 bg-gray-900 rounded-lg text-sm text-gray-400 min-h-[44px] italic break-words line-clamp-3">${currentMemo || 'メモなし'}</div><button type="button" id="open-memo-modal-btn" class="w-full text-sm p-2 bg-gray-600 hover:bg-gray-700 rounded-lg">メモを編集</button></div>
                </div>
                <div class="md:col-span-1 space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-400 mb-2">画像</label>
                        <div class="relative w-full h-32 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                            <img id="edit-current-image-preview" src="${work.imageUrl || ''}" class="w-full h-full object-contain rounded-lg ${!work.imageUrl ? 'hidden' : ''}">
                            <div id="edit-no-image-placeholder" class="text-gray-500 ${work.imageUrl ? 'hidden' : ''}"><i class="fas fa-image fa-3x"></i></div>
                            <button type="button" id="edit-image-delete-btn" class="absolute top-2 right-2 btn-icon bg-red-600 hover:bg-red-700 w-9 h-9 ${!work.imageUrl ? 'hidden' : ''}" title="画像を削除"><i class="fas fa-trash"></i></button>
                        </div>
                        <div class="flex items-center">
                            <label for="edit-image-upload" class="flex-shrink-0 cursor-pointer text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">参照...</label>
                            <span id="edit-image-filename" class="ml-3 text-sm text-gray-400 break-words min-w-0 truncate">${fileNameDisplay}</span>
                            <input type="file" id="edit-image-upload" accept="image/jpeg,image/png,image/webp" class="hidden">
                        </div>
                    </div>
                    <div><label class="block text-sm font-medium text-gray-400 mb-1">現在の抽選確率</label><p class="text-sm text-gray-300">${probabilityText}</p></div>
                    <div class="hidden md:block space-y-2"><label for="editWorkMemo" class="block text-sm font-medium text-gray-400">メモ欄</label><textarea id="editWorkMemo" rows="10" class="w-full bg-gray-700 p-2 rounded-lg text-sm" placeholder="感想やメモ...">${currentMemo}</textarea></div>
                </div>
            </div>
            <div class="pt-6 mt-6 border-t border-gray-700 flex justify-end gap-3 flex-wrap sm:flex-nowrap">
                <div class="flex space-x-3 w-full sm:w-auto">
                    <button type="button" id="edit-cancel-btn" class="flex-1 sm:flex-none px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button>
                    <button type="submit" class="flex-1 sm:flex-none px-4 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-700 text-white">保存</button>
                </div>
            </div>
        </form>
    `;

    const headerSearchBtn = `<button type="button" id="edit-external-search-header" class="text-sm py-1 rounded-lg flex items-center transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 text-white px-2 md:px-3"><i class="fas fa-globe-asia md:mr-2"></i><span class="hidden md:inline">外部サイト検索</span></button>`;

    App.openModal(`「${work.name}」を編集`, content, () => {
        const ratingStars = $('#editWorkRating'), tagsContainer = $('#editWorkTags');
        const workNameInput = $('#editWorkName'), workUrlInput = $('#editWorkUrl');
        const editImageUpload = $('#edit-image-upload');
        const editCurrentImagePreview = $('#edit-current-image-preview');
        const editImageDeleteBtn = $('#edit-image-delete-btn');
        const editNoImagePlaceholder = $('#edit-no-image-placeholder');
        const editImageFilename = $('#edit-image-filename');
        const pcMemoTextarea = $('#editWorkMemo'), smMemoButton = $('#open-memo-modal-btn');
        const editUrlPreviewBox = $('#edit-url-preview-box');

        App.setupInputClearButton(workNameInput, $('#clear-editWorkName'));
        App.setupInputClearButton(workUrlInput, $('#clear-editWorkUrl'));

        AppState.tempNewImageUrl = null;
        AppState.tempNewImageFileName = null; 
        AppState.deleteImageFlag = false;

        workUrlInput.addEventListener('blur', () => {
            const url = workUrlInput.value.trim();
            if (url && url.length > 10 && url.startsWith('http')) {
                // クラス操作で表示 (absoluteクラスはHTML側で定義済み)
                editUrlPreviewBox.classList.remove('hidden');
                App.fetchLinkPreview(url, editUrlPreviewBox);
            } else { 
                editUrlPreviewBox.innerHTML = ''; 
                editUrlPreviewBox.classList.add('hidden'); 
            }
        });

        if (pcMemoTextarea) pcMemoTextarea.addEventListener('input', () => { currentMemo = pcMemoTextarea.value; });
        if (smMemoButton) smMemoButton.addEventListener('click', () => { openMemoModal(workId, currentMemo, currentRating, currentTagIds, (newMemo) => { if (newMemo !== null) { currentMemo = newMemo; openEditModal(workId, { rating: currentRating, tagIds: currentTagIds, memo: currentMemo }); } }); });

        editImageDeleteBtn.addEventListener('click', () => {
            if (confirm('本当に画像を削除しますか？')) {
                editCurrentImagePreview.src = ''; editCurrentImagePreview.classList.add('hidden'); editImageDeleteBtn.classList.add('hidden'); editNoImagePlaceholder.classList.remove('hidden');
                AppState.deleteImageFlag = true; AppState.tempNewImageUrl = null; AppState.tempNewImageFileName = null; editImageUpload.value = '';
                if (editImageFilename) editImageFilename.textContent = '削除予定';
                UI.showToast("画像を削除候補にしました。", "info");
            }
        });

        editImageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (storedFileName && file.name === storedFileName) {
                if (!confirm(`「${file.name}」は現在保存されている画像と同じファイル名です。\n本当にこの画像で更新しますか？`)) {
                    editImageUpload.value = ''; return;
                }
            }
            if (editImageFilename) editImageFilename.textContent = file.name;
            try {
                const newUrl = await Utils.processImage(file);
                App.openImageCompareModal(work.imageUrl || '', newUrl);
                AppState.tempNewImageUrl = newUrl; 
                AppState.tempNewImageFileName = file.name;
            } catch (error) {
                UI.showToast(error.message, "error");
                editImageUpload.value = ''; AppState.tempNewImageUrl = null;
                if (editImageFilename) editImageFilename.textContent = storedFileName || 'ファイルが選択されていません。';
            }
        });

        const openUrlBtn = $('#openWorkUrlBtn');
        workUrlInput.addEventListener('input', () => { openUrlBtn.disabled = !workUrlInput.value.trim(); });
        openUrlBtn.addEventListener('click', () => { const url = workUrlInput.value.trim(); if (url) window.open(url, '_blank', 'noopener,noreferrer'); });
        $('#copy-edit-title-btn').addEventListener('click', () => navigator.clipboard.writeText(workNameInput.value).then(() => UI.showToast(`「${workNameInput.value}」をコピーしました。`)));

        const renderStars = r => { if(!ratingStars)return; ratingStars.innerHTML=''; for(let i=1;i<=5;i++){ const s=document.createElement('i'); s.classList.add('fa-star','cursor-pointer'); s.dataset.value=i; if(r>=i)s.classList.add('fas','text-yellow-400'); else if(r===i-0.5)s.classList.add('fas','fa-star-half-alt','text-yellow-400'); else s.classList.add('far','text-gray-500'); ratingStars.appendChild(s); }};
        const renderTags = ids => { if(tagsContainer){ const objs=App.getTagObjects(ids); tagsContainer.innerHTML=objs.length>0?objs.map(t=>`<span class="px-2 py-1 rounded font-semibold text-xs" style="background-color:${t.color}; color:${Utils.getContrastColor(t.color)}">${t.name}</span>`).join(''):`<span class="text-xs text-gray-500">タグなし</span>`; }};
        renderStars(currentRating); renderTags(currentTagIds);

        if (ratingStars) ratingStars.addEventListener('click', e => { const s = e.target.closest('.fa-star'); if(s){ const v=parseInt(s.dataset.value,10); const h=(e.clientX-s.getBoundingClientRect().left)>(s.getBoundingClientRect().width/2); let n=h?v:v-0.5; if(currentRating===n)n=0; currentRating=n; renderStars(currentRating); }});
        $('#editWorkAssignTagsBtn').addEventListener('click', () => openTagModal({ mode: 'assign', workId, currentTagIds, workName: work.name, onConfirm: (n) => { if(n)currentTagIds=n; openEditModal(workId, { rating: currentRating, tagIds: currentTagIds, memo: currentMemo }); } }));
        $('#edit-cancel-btn').addEventListener('click', App.closeModal);
        $('#edit-external-search-header')?.addEventListener('click', () => { AppState.modalStateStack.push(() => openEditModal(workId, { rating: currentRating, tagIds: currentTagIds, memo: currentMemo })); openExternalSearchModal(workNameInput.value); });

        $('#editWorkForm').addEventListener('submit', async e => {
            e.preventDefault();
            if (!workNameInput.value.trim()) return UI.showToast("作品名は必須です。", "error");
            
            const updatedData = {
                name: workNameInput.value.trim(), sourceUrl: workUrlInput.value.trim(), genre: $('#editWorkGenre').value,
                registeredAt: Timestamp.fromDate(new Date(App.getDateInputValue('editWorkRegisteredAt').replace(/\//g, '-'))),
                rating: currentRating, tagIds: Array.from(currentTagIds), memo: currentMemo
            };
            
            if (AppState.tempNewImageUrl) {
                updatedData.imageUrl = AppState.tempNewImageUrl;
                updatedData.imageFileName = AppState.tempNewImageFileName;
            } else if (AppState.deleteImageFlag) {
                updatedData.imageUrl = deleteField();
                updatedData.imageFileName = deleteField();
            }

            AppState.checkModalDirtyState = () => false;
            if (await Actions.updateWork(workId, updatedData)) { UI.showToast("作品情報を更新しました。"); App.closeModal(); }
        });
    }, { size: 'max-w-5xl', headerActions: headerSearchBtn, autoFocus: false });
};

// ★ タグ管理・選択モーダル
export const openTagModal = (options) => {
    const App = getApp();
    const { mode = 'manage', currentTagIds = new Set(), workName = '', onConfirm } = options;
    let tempSelectedTagIds = new Set(currentTagIds);
    const titleMap = { manage: 'タグ管理', assign: `「${workName}」のタグを割り当て`, filter: '抽選条件のタグを選択' };
    const content = `
        <div class="flex flex-col h-[70vh]">
            ${['manage', 'assign'].includes(mode) ? `<div class="flex flex-wrap gap-2 mb-4 p-1 bg-gray-900 rounded-lg"><input type="text" id="newTagName" placeholder="新しいタグ名" class="flex-grow min-w-[150px] bg-gray-700 p-2 rounded-lg"><div class="flex gap-2"><input type="color" id="newTagColor" value="#581c87" class="h-11 w-12 p-1 bg-gray-700 rounded-lg cursor-pointer"><button id="addTagBtn" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"><i class="fas fa-plus"></i> 追加</button></div></div>` : ''}
            <div class="flex items-center gap-2 mb-2">
                <div class="flex-grow relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input type="search" id="tagSearchInput" placeholder="タグを検索..." class="w-full bg-gray-700 p-2 pl-10 rounded-lg">
                </div>
                ${mode === 'manage' ? `<button id="search-selected-tag-btn" class="w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700" title="選択したタグで検索" disabled><i class="fas fa-search"></i></button>` : ''}
                ${mode === 'assign' ? `<select id="tagFilterSelect" class="bg-gray-700 p-2 rounded-lg"><option value="all">すべて</option><option value="assigned">設定済</option><option value="unassigned">未設定</option></select>`: ''}
                <select id="tagSortSelect" class="bg-gray-700 p-2 rounded-lg"><option value="createdAt_desc">追加順 (新しい)</option><option value="createdAt_asc">追加順 (古い)</option><option value="name_asc">名前順 (昇順)</option><option value="useCount_desc">頻度順</option></select>
            </div>
            ${!['manage'].includes(mode) ? `<div class="mb-4"><div class="flex justify-between items-center mb-1"><label class="block text-sm text-gray-400">選択中のタグ</label><button type="button" id="reset-selected-tags-btn" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700">リセット <i class="fas fa-times ml-1"></i></button></div><div id="tag-selector-preview" class="flex flex-wrap gap-2 p-2 bg-gray-900 rounded-lg min-h-[40px]"></div></div>` : ''}
            <div id="tag-list" class="flex-grow overflow-y-auto pr-2 gap-2 grid grid-cols-1 md:grid-cols-2"></div>
            ${!['manage'].includes(mode) ? `<div class="pt-4 mt-4 border-t border-gray-700 flex justify-end space-x-3"><button id="tag-modal-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button><button id="tag-modal-confirm" class="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold">決定</button></div>` : ''}
        </div>`;

    App.openModal(titleMap[mode], content, () => {
        let tagSearchQuery = '', tagFilter = 'all', tagSort = { by: 'createdAt', order: 'desc' };
        const tagListEl = $('#tag-list'), tagPreviewEl = $('#tag-selector-preview');
        let selectedTagForSearch = null;
        const searchSelectedBtn = $('#search-selected-tag-btn');

        const renderTagPreview = () => {
            if(!tagPreviewEl) return;
            const objects = App.getTagObjects(tempSelectedTagIds);
            tagPreviewEl.innerHTML = objects.length > 0 ? objects.map(t => `<span class="px-2 py-1 rounded text-xs" style="background-color:${t.color}; color:${Utils.getContrastColor(t.color)}">${Utils.escapeHTML(t.name)}</span>`).join('') : `<span class="text-xs text-gray-500">タグ未選択</span>`;
        };

        const renderTagList = () => {
            let tagsToRender = [...AppState.tags.values()];
            if(tagSearchQuery) tagsToRender = tagsToRender.filter(t => t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()));
            if(mode === 'assign') {
                if (tagFilter === 'assigned') tagsToRender = tagsToRender.filter(t => tempSelectedTagIds.has(t.id));
                if (tagFilter === 'unassigned') tagsToRender = tagsToRender.filter(t => !tempSelectedTagIds.has(t.id));
            }
            tagsToRender.sort((a, b) => { const o = tagSort.order === 'asc' ? 1 : -1; switch (tagSort.by) { case 'name': return a.name.localeCompare(b.name, 'ja') * o; case 'createdAt': return ((a.createdAt?.toMillis()||0) - (b.createdAt?.toMillis()||0)) * o; case 'useCount': return ((a.useCount||0) - (b.useCount||0)) * o; default: return 0; }});
            tagListEl.innerHTML = tagsToRender.map(t => {
                const isManageMode = mode === 'manage';
                const deleteBtnHtml = (isManageMode || mode === 'assign') ? `<button data-action="delete-tag" data-id="${t.id}" class="ml-auto text-gray-400 hover:text-red-500 px-2 shrink-0" title="タグ削除"><i class="fas fa-trash-alt"></i></button>` : '';
                let selectedClass = '';
                if (isManageMode && selectedTagForSearch === t.name) selectedClass = 'bg-purple-900 ring-2 ring-purple-500';
                else if (!isManageMode && tempSelectedTagIds.has(t.id)) selectedClass = 'bg-purple-900 ring-2 ring-purple-500';
                else selectedClass = 'bg-gray-700';

                return `<div class="tag-item flex items-center p-2 rounded-lg ${isManageMode ? 'hover:bg-gray-600' : 'cursor-pointer hover:bg-gray-600'} ${selectedClass}" data-id="${t.id}" data-name="${Utils.escapeHTML(t.name)}">
                            <div class="w-4 h-4 rounded-full mr-3 shrink-0" style="background-color: ${t.color};"></div>
                            <span class="grow font-semibold truncate">${Utils.escapeHTML(t.name)}</span>
                            ${deleteBtnHtml}
                        </div>`;
            }).join('');
        };

        renderTagList();
        if (tagPreviewEl) renderTagPreview();

        tagListEl.addEventListener('refresh-tags', renderTagList);
        $('#tagSearchInput')?.addEventListener('input', App.debounce(e => { tagSearchQuery = e.target.value; renderTagList(); }, 200));
        $('#tagFilterSelect')?.addEventListener('change', e => { tagFilter = e.target.value; renderTagList(); });
        $('#tagSortSelect')?.addEventListener('change', e => { const [by, order] = e.target.value.split('_'); tagSort = { by, order }; renderTagList(); });

        $('#addTagBtn')?.addEventListener('click', async () => {
            const nameInput = $('#newTagName');
            if (nameInput.value) {
                const newTag = await Actions.addTag(nameInput.value, $('#newTagColor').value);
                if (newTag && mode === 'assign') { tempSelectedTagIds.add(newTag.id); renderTagList(); renderTagPreview(); }
                nameInput.value = '';
            }
        });

        tagListEl.addEventListener('click', e => {
            const tagItem = e.target.closest('.tag-item');
            const deleteBtn = e.target.closest('button[data-action="delete-tag"]');

            if (deleteBtn) { 
                e.stopPropagation(); 
                Actions.deleteTag(deleteBtn.dataset.id); 
                if (mode === 'manage') { selectedTagForSearch = null; if (searchSelectedBtn) searchSelectedBtn.disabled = true; }
                return; 
            }
            
            if (tagItem) {
                e.stopPropagation(); 
                const tagId = tagItem.dataset.id;
                const tagName = tagItem.dataset.name;

                if (mode === 'manage') {
                    if (selectedTagForSearch === tagName) { selectedTagForSearch = null; if (searchSelectedBtn) searchSelectedBtn.disabled = true; } 
                    else { selectedTagForSearch = tagName; if (searchSelectedBtn) searchSelectedBtn.disabled = false; }
                    renderTagList();
                } else {
                    if (tempSelectedTagIds.has(tagId)) tempSelectedTagIds.delete(tagId);
                    else tempSelectedTagIds.add(tagId);
                    renderTagList(); renderTagPreview();
                }
            }
        });

        if (searchSelectedBtn) {
            searchSelectedBtn.addEventListener('click', () => {
                if (selectedTagForSearch) {
                    AppState.ui.searchInput.value = selectedTagForSearch;
                    App.performSearch(selectedTagForSearch);
                    App.closeModal();
                    setTimeout(() => AppState.ui.searchInput.focus(), 300); 
                    UI.showToast(`タグ「${selectedTagForSearch}」で検索しました。`);
                }
            });
        }
        $('#reset-selected-tags-btn')?.addEventListener('click', () => { tempSelectedTagIds.clear(); renderTagPreview(); renderTagList(); });
        // 修正: 親モーダル(編集画面)がある場合に勝手に閉じないよう App.closeModal() を削除
        $('#tag-modal-confirm')?.addEventListener('click', () => { onConfirm(tempSelectedTagIds); });
        $('#tag-modal-cancel')?.addEventListener('click', () => { onConfirm(null); });
    }, { autoFocus: false });
};

// src/modals.js の末尾に追加

// ★ タグフィルタ選択モーダル (AND/OR/NOT)
export const openTagFilterModal = (options) => {
    const App = getApp();
    const { and = new Set(), or = new Set(), not = new Set(), onConfirm } = options;
    let tempAnd = new Set(and), tempOr = new Set(or), tempNot = new Set(not);

    const content = `
        <div class="flex flex-col h-[70vh]">
            <div class="flex items-center gap-2 mb-2">
                <div class="flex-grow relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input type="search" id="tagSearchInput" placeholder="タグを検索..." class="w-full bg-gray-700 p-2 pl-10 rounded-lg">
                </div>
                <select id="tagSortSelect" class="bg-gray-700 p-2 rounded-lg">
                    <option value="createdAt_desc">追加順 (新しい)</option>
                    <option value="createdAt_asc">追加順 (古い)</option>
                    <option value="name_asc">名前順 (昇順)</option>
                    <option value="useCount_desc">頻度順</option>
                </select>
            </div>
            <div class="flex justify-between items-center mb-4">
                <p class="text-xs text-gray-400">タグをクリックして条件を変更 ( 緑: AND → 青: OR → 赤: NOT → 解除 )</p>
                <button type="button" id="reset-tag-filters-btn" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700">リセット</button>
            </div>
            <div id="tag-list" class="flex-grow overflow-y-auto pr-2 space-y-2"></div>
            <div class="pt-4 mt-4 border-t border-gray-700 flex justify-end space-x-3">
                <button id="tag-modal-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button>
                <button id="tag-modal-confirm" class="px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-semibold">決定</button>
            </div>
        </div>`;

    App.openModal("タグの条件を選択", content, () => {
        let tagSearchQuery = '', tagSort = { by: 'createdAt', order: 'desc' };
        const tagListEl = $('#tag-list');

        const renderTagList = () => {
            let tagsToRender = [...AppState.tags.values()];
            if(tagSearchQuery) {
                const normalizedQuery = App.normalizeString(tagSearchQuery);
                tagsToRender = tagsToRender.filter(t => App.normalizeString(t.name).includes(normalizedQuery));
            }

            tagsToRender.sort((a, b) => { const o = tagSort.order === 'asc' ? 1 : -1; switch (tagSort.by) { case 'name': return a.name.localeCompare(b.name, 'ja') * o; case 'createdAt': return ((a.createdAt?.toMillis()||0) - (b.createdAt?.toMillis()||0)) * o; case 'useCount': return ((a.useCount||0) - (b.useCount||0)) * o; default: return 0; }});

            tagListEl.innerHTML = tagsToRender.map(t => {
                let stateClass = 'bg-gray-700';
                if (tempAnd.has(t.id)) stateClass = 'tag-item-and';
                else if (tempOr.has(t.id)) stateClass = 'tag-item-or';
                else if (tempNot.has(t.id)) stateClass = 'tag-item-not';

                return `<div class="tag-item flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-600 ${stateClass}" data-id="${t.id}">
                            <div class="w-4 h-4 rounded-full mr-3 shrink-0" style="background-color: ${t.color};"></div>
                            <span class="grow font-semibold truncate">${Utils.escapeHTML(t.name)}</span>
                        </div>`;
            }).join('');
        };

        renderTagList();
        tagListEl.addEventListener('refresh-tags', renderTagList);

        $('#tagSearchInput')?.addEventListener('input', App.debounce(e => { tagSearchQuery = e.target.value; renderTagList(); }, 200));
        $('#tagSortSelect')?.addEventListener('change', e => { const [by, order] = e.target.value.split('_'); tagSort = { by, order }; renderTagList(); });

        tagListEl.addEventListener('click', e => {
            const tagItem = e.target.closest('.tag-item');
            if (tagItem) {
                const tagId = tagItem.dataset.id;
                if (tempAnd.has(tagId)) { tempAnd.delete(tagId); tempOr.add(tagId); } 
                else if (tempOr.has(tagId)) { tempOr.delete(tagId); tempNot.add(tagId); } 
                else if (tempNot.has(tagId)) { tempNot.delete(tagId); } 
                else { tempAnd.add(tagId); }
                renderTagList();
            }
        });

        $('#reset-tag-filters-btn').addEventListener('click', () => { tempAnd.clear(); tempOr.clear(); tempNot.clear(); renderTagList(); });
        $('#tag-modal-confirm')?.addEventListener('click', () => { onConfirm({and: tempAnd, or: tempOr, not: tempNot}); App.closeModal(); });
        $('#tag-modal-cancel')?.addEventListener('click', () => { onConfirm(null); App.closeModal(); });
    }, { autoFocus: false });
};