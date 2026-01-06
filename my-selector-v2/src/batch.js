// src/batch.js

import { store as AppState } from './store/store.js';
import * as Utils from './utils/utils.js';
import * as UI from './components/ui.js';
import * as Actions from './services/actions.js';
import { Timestamp } from "firebase/firestore";

const $ = (selector) => document.querySelector(selector);

// --- ローカルヘルパー関数 ---

// 画像をBase64に変換
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// 連打防止（debounce）
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

// HTMLエスケープ（念のためローカルにも用意）
const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[match]);
};


export const openBatchRegistrationModal = (App, keepData = false) => {
    
    // 1. リストデータの初期化判定
    if (!keepData) {
        AppState.tempWorks = [];
    }
    
    AppState.editingTempIndex = -1;
    AppState.isRegFormDirty = false;
    
    // 画像変数（このモーダル内でのみ有効）
    let batchTempImageData = null;

    // --- 内部関数定義 ---

    // リストの描画
    const renderBatchList = () => {
        const container = $('#batch-list-container');
        const countSpan = $('#batch-list-count');
        const tabCountSpan = $('#batch-tab-count');
        const saveBtn = $('#batch-save-all-btn');
        
        if (!container) return;

        // カウント更新
        const count = AppState.tempWorks.length;
        if (countSpan) countSpan.textContent = `${count}件`;
        if (tabCountSpan) tabCountSpan.textContent = count;
        if (saveBtn) disabledButton(saveBtn, count === 0);

        if (count === 0) {
            container.innerHTML = `<div class="text-center text-gray-500 py-10">リストは空です</div>`;
            return;
        }

        container.innerHTML = AppState.tempWorks.map((work, index) => `
            <div class="bg-gray-700 p-3 rounded-lg flex gap-3 items-start group relative">
                <div class="w-16 h-16 bg-gray-800 rounded flex-shrink-0 overflow-hidden border border-gray-600">
                    <img src="${(work.imageData && work.imageData.base64) || 'https://placehold.co/100x100/374151/9ca3af?text=No+Img'}" class="w-full h-full object-cover">
                </div>
                <div class="flex-grow min-w-0">
                    <div class="flex justify-between items-start">
                        <h5 class="font-bold text-gray-200 truncate text-sm mb-1">${escapeHTML(work.name)}</h5>
                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-gray-700 rounded pl-2">
                            <button class="text-sky-400 hover:text-sky-300" onclick="document.dispatchEvent(new CustomEvent('batch-edit', {detail: ${index}}))">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="text-red-400 hover:text-red-300" onclick="document.dispatchEvent(new CustomEvent('batch-delete', {detail: ${index}}))">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 space-y-0.5">
                        <p class="truncate"><i class="fas fa-tag mr-1 text-gray-500"></i>${work.genre}</p>
                        ${work.sourceUrl ? `<a href="${work.sourceUrl}" target="_blank" class="text-sky-500 hover:underline truncate block"><i class="fas fa-link mr-1"></i>URLあり</a>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    };

    // リストへの追加
    const addBatchWorkToList = () => {
        const nameInput = $('#batchWorkName');
        const urlInput = $('#batchWorkUrl');
        const genreInput = $('#batchWorkGenre');
        const regDateInput = $('#batchWorkRegisteredAt');
        
        const name = nameInput.value.trim();
        if (!name) {
            UI.showToast("作品名を入力してください", "error");
            return;
        }

        // 重複チェック (リスト内)
        if (AppState.editingTempIndex === -1 && AppState.tempWorks.some(w => w.name === name)) {
            UI.showToast("その作品は既にリストに追加されています", "warning");
            return;
        }

        // データ作成
        const workData = {
            name: name,
            sourceUrl: urlInput.value.trim(),
            genre: genreInput.value,
            registeredAt: regDateInput.value, 
            imageData: batchTempImageData
        };

        if (AppState.editingTempIndex >= 0) {
            // 編集モード
            if (!workData.imageData && AppState.tempWorks[AppState.editingTempIndex].imageData) {
                workData.imageData = AppState.tempWorks[AppState.editingTempIndex].imageData;
            }
            AppState.tempWorks[AppState.editingTempIndex] = workData;
            UI.showToast("リストの内容を更新しました");
            AppState.editingTempIndex = -1;
            
            const addBtn = $('#batch-add-list-btn');
            addBtn.innerHTML = `<i class="fas fa-plus-circle mr-2"></i>リストに追加`;
            addBtn.classList.remove('from-yellow-600', 'to-yellow-500');
            addBtn.classList.add('from-lime-600', 'to-lime-500');
        } else {
            // 新規追加
            AppState.tempWorks.push(workData);
            UI.showToast("リストに追加しました");
        }

        resetBatchRegForm();
        renderBatchList();
    };

    // フォームのリセット
    const resetBatchRegForm = () => {
        $('#batchWorkName').value = '';
        $('#batchWorkUrl').value = '';
        $('#batchWorkGenre').value = '漫画';
        $('#batchWorkRegisteredAt').value = new Date().toISOString().split('T')[0];
        $('#batchWorkImage').value = '';
        
        batchTempImageData = null;
        const previewImg = $('#batch-image-preview');
        const placeholder = $('#batch-image-placeholder');
        const deleteBtn = $('#batch-image-delete');
        
        previewImg.src = '';
        previewImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
        deleteBtn.classList.add('hidden');
        
        $('#batch-suggest-container').innerHTML = '';
        const previewBox = $('#batch-url-preview-box');
        if(previewBox) {
            previewBox.innerHTML = '';
            previewBox.classList.add('hidden');
        }
        AppState.isRegFormDirty = false;
        AppState.editingTempIndex = -1;

        const addBtn = $('#batch-add-list-btn');
        addBtn.innerHTML = `<i class="fas fa-plus-circle mr-2"></i>リストに追加`;
        addBtn.classList.remove('from-yellow-600', 'to-yellow-500');
        addBtn.classList.add('from-lime-600', 'to-lime-500');
        
        setTimeout(() => $('#batchWorkName').focus(), 100);
    };

    // リストから編集のために読み込む
    const loadTempWorkToForm = (index) => {
        if (index < 0 || index >= AppState.tempWorks.length) return;
        
        const work = AppState.tempWorks[index];
        AppState.editingTempIndex = index;
        
        $('#batchWorkName').value = work.name;
        $('#batchWorkUrl').value = work.sourceUrl || '';
        $('#batchWorkGenre').value = work.genre;
        $('#batchWorkRegisteredAt').value = work.registeredAt;
        
        if (work.imageData && work.imageData.base64) {
            batchTempImageData = work.imageData;
            $('#batch-image-preview').src = work.imageData.base64;
            $('#batch-image-preview').classList.remove('hidden');
            $('#batch-image-placeholder').classList.add('hidden');
            $('#batch-image-delete').classList.remove('hidden');
        } else {
            batchTempImageData = null;
            $('#batch-image-preview').src = '';
            $('#batch-image-preview').classList.add('hidden');
            $('#batch-image-placeholder').classList.remove('hidden');
            $('#batch-image-delete').classList.add('hidden');
        }

        const addBtn = $('#batch-add-list-btn');
        addBtn.innerHTML = `<i class="fas fa-sync-alt mr-2"></i>更新する`;
        addBtn.classList.remove('from-lime-600', 'to-lime-500');
        addBtn.classList.add('from-yellow-600', 'to-yellow-500');

        const tabForm = document.getElementById('batch-tab-form');
        if (tabForm && tabForm.offsetParent !== null) tabForm.click();
        
        UI.showToast(`「${work.name}」を編集します`);
    };

    // 一括保存処理
    const saveBatchWorks = async () => {
        if (AppState.tempWorks.length === 0) return;
        
        if (!confirm(`${AppState.tempWorks.length}件の作品を一括登録します。よろしいですか？`)) return;
        
        const loadingToast = UI.showToast("登録処理中...", "info", 0);
        let successCount = 0;
        let errorCount = 0;

        try {
            for (const tempWork of AppState.tempWorks) {
                try {
                    const newWork = {
                        name: tempWork.name,
                        sourceUrl: tempWork.sourceUrl,
                        genre: tempWork.genre,
                        registeredAt: Timestamp.fromDate(new Date(tempWork.registeredAt)),
                        rating: 0,
                        tagIds: [],
                        memo: ''
                    };

                    let imageFile = null;
                    if (tempWork.imageData) {
                        const res = await fetch(tempWork.imageData.base64);
                        const blob = await res.blob();
                        imageFile = new File([blob], tempWork.imageData.fileName, { type: tempWork.imageData.fileType });
                    }

                    await Actions.addWork(newWork, imageFile);
                    successCount++;
                    
                } catch (e) {
                    console.error("登録エラー:", tempWork.name, e);
                    errorCount++;
                }
            }

            loadingToast.hideToast();
            
            if (errorCount === 0) {
                UI.showToast(`${successCount}件の登録が完了しました！`);
                AppState.tempWorks = [];
                App.closeModal();
            } else {
                UI.showToast(`${successCount}件完了、${errorCount}件失敗しました。`, "warning");
                AppState.tempWorks = [];
                App.closeModal();
            }

        } catch (globalError) {
            console.error(globalError);
            loadingToast.hideToast();
            UI.showToast("予期せぬエラーが発生しました", "error");
        }
    };

    const disabledButton = (btn, isDisabled) => {
        btn.disabled = isDisabled;
        if (isDisabled) {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.classList.remove('transform', 'hover:-translate-y-1', 'hover:shadow-xl');
        } else {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.classList.add('transform', 'hover:-translate-y-1', 'hover:shadow-xl');
        }
    };

    // --- モーダルOpen後の処理 ---
    const onOpen = () => {
        const modalBody = $('#modal-content-body');
        if(modalBody) modalBody.classList.remove('p-6');

        const tabForm = $('#batch-tab-form');
        const tabList = $('#batch-tab-list');
        const colForm = $('#batch-col-form');
        const colList = $('#batch-col-list');

        const switchTab = (mode) => {
            if (mode === 'form') {
                tabForm.classList.add('text-lime-400', 'border-b-2', 'border-lime-400');
                tabForm.classList.remove('text-gray-400', 'border-transparent');
                tabList.classList.add('text-gray-400', 'border-transparent');
                tabList.classList.remove('text-lime-400', 'border-b-2', 'border-lime-400');
                
                colForm.classList.remove('hidden');
                colList.classList.add('hidden');
            } else {
                tabList.classList.add('text-lime-400', 'border-b-2', 'border-lime-400');
                tabList.classList.remove('text-gray-400', 'border-transparent');
                tabForm.classList.add('text-gray-400', 'border-transparent');
                tabForm.classList.remove('text-lime-400', 'border-b-2', 'border-lime-400');
                
                colList.classList.remove('hidden');
                colForm.classList.add('hidden');
            }
        };

        if (tabForm) tabForm.addEventListener('click', () => switchTab('form'));
        if (tabList) tabList.addEventListener('click', () => switchTab('list'));

        const nameInput = $('#batchWorkName');
        const urlInput = $('#batchWorkUrl');
        const imageInput = $('#batchWorkImage');
        const suggestContainer = $('#batch-suggest-container');
        
        // ★修正ポイント: ローカルで定義した debounce を使用
        const handleInputSuggestion = debounce(() => {
            const query = nameInput.value.trim();
            if (!query || query.length < 2) {
                suggestContainer.innerHTML = '';
                return;
            }
            const normalize = (s) => (s || '').toLowerCase().replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
            const normalizedQuery = normalize(query);
            
            const registeredMatches = AppState.works
                .filter(w => normalize(w.name).includes(normalizedQuery))
                .slice(0, 3);
            const listMatches = AppState.tempWorks
                .map((w, index) => ({ ...w, originalIndex: index }))
                .filter(w => normalize(w.name).includes(normalizedQuery))
                .slice(0, 3);

            if (registeredMatches.length === 0 && listMatches.length === 0) {
                suggestContainer.innerHTML = '';
                return;
            }

            let html = `<div class="absolute z-50 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden mt-1">`;
            registeredMatches.forEach(w => {
                html += `<div class="p-2 border-b border-gray-700 hover:bg-gray-600 cursor-pointer flex items-center gap-2 bg-gray-900 bg-opacity-50" onclick="alert('「${escapeHTML(w.name)}」は既に登録されています')">
                    <img src="${w.imageUrl || 'https://placehold.co/40x40/1f2937/4b5563?text=?'}" class="w-8 h-8 object-cover rounded flex-shrink-0">
                    <span class="text-sm truncate text-gray-400">${escapeHTML(w.name)} <span class="text-xs text-red-400">(登録済)</span></span>
                </div>`;
            });
            listMatches.forEach(w => {
                html += `<div class="p-2 border-b border-gray-700 hover:bg-gray-600 cursor-pointer flex items-center gap-2" data-action="load-temp" data-index="${w.originalIndex}">
                    <img src="${(w.imageData && w.imageData.base64) || 'https://placehold.co/40x40/1f2937/4b5563?text=?'}" class="w-8 h-8 object-cover rounded flex-shrink-0">
                    <span class="text-sm truncate text-gray-300">${escapeHTML(w.name)} <span class="text-xs text-lime-400">(リスト内)</span></span>
                </div>`;
            });
            html += `</div>`;
            suggestContainer.innerHTML = html;
        }, 300);

        nameInput.addEventListener('input', () => {
            AppState.isRegFormDirty = true;
            handleInputSuggestion();
        });

        suggestContainer.addEventListener('click', (e) => {
            const item = e.target.closest('div[data-action="load-temp"]');
            if (item) {
                loadTempWorkToForm(parseInt(item.dataset.index, 10));
                suggestContainer.innerHTML = '';
            }
        });

        nameInput.addEventListener('blur', () => setTimeout(() => suggestContainer.innerHTML = '', 500));

        const setDirty = () => { AppState.isRegFormDirty = true; };
        $('#batchWorkGenre').addEventListener('change', setDirty);
        imageInput.addEventListener('change', setDirty);
        
        if (App.setupInputClearButton) {
            App.setupInputClearButton(nameInput, $('#clear-batchWorkName'));
            App.setupInputClearButton(urlInput, $('#clear-batchWorkUrl'));
        }

        const previewBox = $('#batch-url-preview-box');
        if(previewBox) previewBox.className = "hidden absolute z-40 w-full mt-1 shadow-xl rounded-lg overflow-hidden";

        const handleUrlBlur = () => {
            const url = urlInput.value.trim();
            if (url && url.length > 10 && url.startsWith('http')) {
                if (App.fetchLinkPreview) App.fetchLinkPreview(url, previewBox);
                if(previewBox) previewBox.classList.remove('hidden');
            } else { 
                if(previewBox) {
                    previewBox.innerHTML = ''; 
                    previewBox.classList.add('hidden'); 
                }
            }
        };

        urlInput.addEventListener('input', setDirty);
        urlInput.addEventListener('blur', handleUrlBlur);

        const previewImg = $('#batch-image-preview');
        const placeholder = $('#batch-image-placeholder');
        const deleteBtn = $('#batch-image-delete');

        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const base64 = await fileToBase64(file);
                batchTempImageData = { base64: base64, fileName: file.name, fileType: file.type };
                
                previewImg.src = base64;
                previewImg.classList.remove('hidden');
                deleteBtn.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } catch (err) {
                console.error(err);
                UI.showToast("画像の読み込みに失敗しました", "error");
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            e.preventDefault();
            imageInput.value = '';
            batchTempImageData = null;
            previewImg.src = '';
            previewImg.classList.add('hidden');
            deleteBtn.classList.add('hidden');
            placeholder.classList.remove('hidden');
        });

        $('#batch-add-list-btn').addEventListener('click', addBatchWorkToList);

        $('#batch-clear-form-btn').addEventListener('click', async () => { 
            if (nameInput.value || urlInput.value || batchTempImageData) {
                if (!await App.showConfirm("フォームのクリア", "入力中の内容を消去してもよろしいですか？")) return;
            }
            resetBatchRegForm(); 
            UI.showToast("フォームをクリアしました"); 
        });

        $('#batch-save-all-btn').addEventListener('click', saveBatchWorks);

        document.addEventListener('batch-edit', (e) => loadTempWorkToForm(e.detail), { once: true }); 

        const listContainer = $('#batch-list-container');
        listContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('button');
            if (!editBtn) return;
            
            const parentDiv = editBtn.closest('.bg-gray-700');
            const index = Array.from(listContainer.children).indexOf(parentDiv);
            
            if (index === -1) return;

            if (editBtn.innerHTML.includes('fa-pen')) {
                loadTempWorkToForm(index);
            } else if (editBtn.innerHTML.includes('fa-trash')) {
                if(confirm('リストから削除しますか？')) {
                    if (AppState.editingTempIndex === index) resetBatchRegForm();
                    AppState.tempWorks.splice(index, 1);
                    renderBatchList();
                    UI.showToast('削除しました');
                }
            }
        });

        renderBatchList();
    };

    const content = `
        <div class="flex flex-col h-[80vh] lg:h-[75vh]">
            <div class="flex border-b border-gray-700 mb-2 lg:hidden">
                <button id="batch-tab-form" class="flex-1 py-2 text-center text-sm font-bold text-lime-400 border-b-2 border-lime-400">入力フォーム</button>
                <button id="batch-tab-list" class="flex-1 py-2 text-center text-sm font-bold text-gray-400 border-b-2 border-transparent">登録リスト <span id="batch-tab-count" class="ml-1 text-xs bg-gray-700 px-1.5 rounded-full">${AppState.tempWorks?.length || 0}</span></button>
            </div>

            <div class="flex flex-col lg:flex-row gap-4 flex-grow overflow-hidden relative">
                <div id="batch-col-form" class="w-full lg:w-7/12 flex flex-col h-full overflow-y-auto pr-1 lg:pr-2 custom-scrollbar transition-all absolute inset-0 lg:relative z-10 bg-gray-800 lg:bg-transparent">
                    <div class="bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-700 flex-grow flex flex-col">
                        <h4 class="text-lg font-bold text-gray-200 mb-4 border-b border-gray-700 pb-2"><i class="fas fa-pen mr-2 text-lime-400"></i>作品情報を入力</h4>
                        
                        <form id="batchRegForm" class="space-y-4 flex-grow pb-2">
                            <div>
                                <label class="block text-sm font-medium text-gray-400 mb-1">作品名 <span class="text-red-500">*</span></label>
                                <div class="relative">
                                    <input type="text" id="batchWorkName" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-lime-500 pr-10" placeholder="作品名を入力..." autocomplete="off">
                                    <button type="button" id="clear-batchWorkName" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden"><i class="fas fa-times-circle text-lg"></i></button>
                                </div>
                                <div id="batch-suggest-container" class="relative"></div>
                            </div>

                            <div class="relative z-30">
                                <label class="block text-sm font-medium text-gray-400 mb-1">作品URL (任意)</label>
                                <div class="relative">
                                    <input type="url" id="batchWorkUrl" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-lime-500 pr-10" placeholder="https://..." autocomplete="off">
                                    <button type="button" id="clear-batchWorkUrl" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden"><i class="fas fa-times-circle text-lg"></i></button>
                                </div>
                                <div id="batch-url-preview-box" class="hidden absolute left-0 right-0 mt-2 z-50 shadow-2xl rounded-lg bg-gray-900 border border-gray-700"></div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-400 mb-1">ジャンル</label>
                                    <select id="batchWorkGenre" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-lime-500">
                                        <option value="漫画">漫画</option>
                                        <option value="CG集">CG集</option>
                                        <option value="ゲーム">ゲーム</option>
                                        <option value="動画">動画</option>
                                        <option value="音声">音声</option>
                                        <option value="小説">小説</option>
                                        <option value="その他">その他</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-400 mb-1">登録日</label>
                                    ${UI.createDateInputHTML ? UI.createDateInputHTML('batchWorkRegisteredAt', new Date().toISOString().split('T')[0]) : `<input type="date" id="batchWorkRegisteredAt" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-lime-500">`}
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-400 mb-1">パッケージ画像</label>
                                <div class="flex items-center gap-4">
                                    <div class="relative w-24 h-24 bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-600 overflow-hidden group">
                                        <img id="batch-image-preview" class="w-full h-full object-cover hidden">
                                        <div id="batch-image-placeholder" class="text-gray-500 text-center text-xs p-1">
                                            <i class="fas fa-image fa-2x mb-1"></i><br>なし
                                        </div>
                                        <button type="button" id="batch-image-delete" class="hidden absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-500"><i class="fas fa-times"></i></button>
                                    </div>
                                    <div class="flex-grow">
                                        <label for="batchWorkImage" class="cursor-pointer inline-block w-full text-center bg-gray-700 hover:bg-gray-600 border-2 border-dashed border-gray-500 hover:border-lime-500 text-gray-300 rounded-lg p-3 transition-colors">
                                            <i class="fas fa-upload mr-2"></i>画像を選択 / D&D
                                            <input type="file" id="batchWorkImage" class="hidden" accept="image/jpeg,image/png,image/webp">
                                        </label>
                                        <p class="text-[10px] text-gray-500 mt-1 ml-1">※ Ctrl+V でクリップボードから貼り付け可能</p>
                                    </div>
                                </div>
                            </div>
                        </form>
                        
                        <div class="pt-2 mt-auto grid grid-cols-2 gap-3">
                            <button type="button" id="batch-clear-form-btn" class="py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 font-bold transition-colors">
                                <i class="fas fa-eraser mr-2"></i>クリア
                            </button>
                            <button type="button" id="batch-add-list-btn" class="py-3 rounded-lg bg-gradient-to-r from-lime-600 to-lime-500 hover:from-lime-500 hover:to-lime-400 text-white font-bold shadow-lg transform hover:-translate-y-0.5 transition-all">
                                <i class="fas fa-plus-circle mr-2"></i>リストに追加
                            </button>
                        </div>
                    </div>
                </div>

                <div id="batch-col-list" class="hidden lg:flex w-full lg:w-5/12 flex-col h-full absolute inset-0 lg:relative z-10 bg-gray-800 lg:bg-transparent">
                    <div class="bg-gray-900 lg:bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-700 flex flex-col h-full">
                        <div class="flex justify-between items-end mb-3 pb-2 border-b border-gray-700">
                            <h4 class="text-lg font-bold text-gray-200"><i class="fas fa-list-ol mr-2 text-sky-400"></i>登録リスト</h4>
                            <span id="batch-list-count" class="text-sm font-mono text-sky-400 font-bold">${AppState.tempWorks?.length || 0}件</span>
                        </div>
                        
                        <div id="batch-list-container" class="flex-grow overflow-y-auto pr-1 custom-scrollbar space-y-2 min-h-0">
                        </div>

                        <div class="pt-4 mt-2">
                            <button type="button" id="batch-save-all-btn" class="w-full py-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-lg font-bold shadow-xl transform hover:-translate-y-1 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                <i class="fas fa-save mr-2"></i>これらを一括登録する
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;

    App.openModal("作品の一括登録", content, onOpen, { size: 'max-w-7xl' });
};