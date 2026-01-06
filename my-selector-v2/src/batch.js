import { store as AppState } from './store/store.js';
import { writeBatch, collection, doc, Timestamp } from "firebase/firestore";

// ヘルパー関数
const $ = (selector) => document.querySelector(selector);

// ★追加: バッチ画面専用の「並べて表示する用」のバッジ生成関数
const getInlineBadge = (url) => {
    if (!url) return '';
    const lower = url.toLowerCase();
    if (lower.includes('dlsite.com')) {
        return `<span class="inline-block px-2 py-0.5 rounded font-bold text-[10px] text-white bg-sky-600">DL</span>`;
    }
    if (lower.includes('dmm.co.jp') || lower.includes('dmm.com')) {
        return `<span class="inline-block px-2 py-0.5 rounded font-bold text-[10px] text-white bg-red-600">FZ</span>`;
    }
    return '';
};

// 画像データをこのファイルのどこからでもリセットできるように、外に出しました
let batchTempImageData = null;

export const openBatchRegistrationModal = (App, keepData = false) => {
    
    // 1. リストデータの初期化判定
    if (!keepData) {
        AppState.tempWorks = [];
    }
    
    AppState.editingTempIndex = -1;
    AppState.isRegFormDirty = false;
    
    // 画像変数の初期化
    batchTempImageData = null;

    const onOpen = () => {
        const modalBody = $('#modal-content-body'); // モーダルの中身
        if(modalBody) modalBody.classList.remove('p-6'); // パディング調整

        // タブ切り替えロジック
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

        tabForm.addEventListener('click', () => switchTab('form'));
        tabList.addEventListener('click', () => switchTab('list'));

        // --- フォーム要素の取得 ---
        const form = $('#batchRegForm');
        const nameInput = $('#batchWorkName');
        const urlInput = $('#batchWorkUrl');
        const imageInput = $('#batchWorkImage');
        const suggestContainer = $('#batch-suggest-container');
        
        // --- 検索サジェスト機能 ---
        const handleInputSuggestion = App.debounce(() => {
            const query = nameInput.value.trim();
            if (!query || query.length < 2) {
                suggestContainer.innerHTML = '';
                return;
            }
            // 文字列正規化(全角・半角統一など)の簡易実装
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
                html += `<div class="p-2 border-b border-gray-700 hover:bg-gray-600 cursor-pointer flex items-center gap-2" data-action="alert-registered" data-name="${App.escapeHTML(w.name)}">
                    <img src="${w.imageUrl || 'https://placehold.co/40x40/1f2937/4b5563?text=?'}" class="w-8 h-8 object-cover rounded flex-shrink-0">
                    <span class="text-sm truncate text-gray-300">${App.escapeHTML(w.name)}</span>
                </div>`;
            });
            listMatches.forEach(w => {
                html += `<div class="p-2 border-b border-gray-700 hover:bg-gray-600 cursor-pointer flex items-center gap-2" data-action="load-temp" data-index="${w.originalIndex}">
                    <img src="${(w.imageData && w.imageData.base64) || 'https://placehold.co/40x40/1f2937/4b5563?text=?'}" class="w-8 h-8 object-cover rounded flex-shrink-0">
                    <span class="text-sm truncate text-gray-300">${App.escapeHTML(w.name)}</span>
                </div>`;
            });
            html += `</div>`;
            suggestContainer.innerHTML = html;
        }, 300);

        nameInput.addEventListener('input', () => {
            AppState.isRegFormDirty = true;
            handleInputSuggestion();
        });

        // サジェストのクリックイベント
        suggestContainer.addEventListener('click', (e) => {
            const item = e.target.closest('div[data-action]');
            if (!item) return;
            const action = item.dataset.action;
            if (action === 'alert-registered') App.showToast(`「${item.dataset.name}」は既に登録されています。`, 'error');
            else if (action === 'load-temp') {
                App.loadTempWorkToForm(parseInt(item.dataset.index, 10));
                suggestContainer.innerHTML = '';
            }
        });

        // blur遅延 (クリック判定用)
        nameInput.addEventListener('blur', () => setTimeout(() => suggestContainer.innerHTML = '', 500));

        // フォーム変更検知
        const setDirty = () => { AppState.isRegFormDirty = true; };
        $('#batchWorkGenre').addEventListener('change', setDirty);
        imageInput.addEventListener('change', setDirty);
        
        // クリアボタンの設定
        App.setupInputClearButton(nameInput, $('#clear-batchWorkName'));
        App.setupInputClearButton(urlInput, $('#clear-batchWorkUrl'));

        // --- URLプレビュー機能 ---
        const previewBox = $('#batch-url-preview-box');
        // 強制的にスタイル適用
        if(previewBox) previewBox.className = "hidden absolute z-40 w-full mt-1 shadow-xl rounded-lg overflow-hidden";

        const handleUrlBlur = () => {
            const url = urlInput.value.trim();
            if (url && url.length > 10 && url.startsWith('http')) {
                App.fetchLinkPreview(url, previewBox);
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

        // --- 画像アップロード処理 ---
        const previewImg = $('#batch-image-preview');
        const placeholder = $('#batch-image-placeholder');
        const deleteBtn = $('#batch-image-delete');

        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const base64 = await App.fileToBase64(file);
                // 一時保存
                batchTempImageData = { base64: base64, fileName: file.name, fileType: file.type };
                
                previewImg.src = base64;
                previewImg.classList.remove('hidden');
                deleteBtn.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } catch (err) {
                console.error(err);
                App.showToast("画像の読み込みに失敗しました", "error");
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // inputのクリック暴発防止
            e.preventDefault();
            imageInput.value = '';
            batchTempImageData = null;
            previewImg.src = '';
            previewImg.classList.add('hidden');
            deleteBtn.classList.add('hidden');
            placeholder.classList.remove('hidden');
        });

        // --- フォームボタン操作 ---
        $('#batch-add-list-btn').addEventListener('click', () => { App.addBatchWorkToList(); });

        $('#batch-clear-form-btn').addEventListener('click', async () => { 
            if (nameInput.value || urlInput.value || batchTempImageData) {
                if (!await App.showConfirm("フォームのクリア", "入力中の内容を消去してもよろしいですか？")) return;
            }
            App.resetBatchRegForm(); 
            App.showToast("フォームをクリアしました"); 
        });

        // リスト描画
        App.renderBatchList();

        // 一括保存ボタン
        $('#batch-save-all-btn').addEventListener('click', () => { App.saveBatchWorks(); });
    };

    const content = `
        <div class="flex flex-col h-[80vh] lg:h-[75vh]">
            <div class="flex border-b border-gray-700 mb-2 lg:hidden">
                <button id="batch-tab-form" class="flex-1 py-2 text-center text-sm font-bold text-lime-400 border-b-2 border-lime-400">入力フォーム</button>
                <button id="batch-tab-list" class="flex-1 py-2 text-center text-sm font-bold text-gray-400 border-b-2 border-transparent">登録リスト <span id="batch-tab-count" class="ml-1 text-xs bg-gray-700 px-1.5 rounded-full">0</span></button>
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
                                <div id="batch-url-preview-box" class="hidden absolute left-0 right-0 mt-2 z-50 shadow-2xl rounded-lg"></div>
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
                                    ${App.createDateInputHTML('batchWorkRegisteredAt', new Date().toISOString().split('T')[0])}
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
                            <span id="batch-list-count" class="text-sm font-mono text-sky-400 font-bold">0件</span>
                        </div>
                        
                        <div id="batch-list-container" class="flex-grow overflow-y-auto pr-1 custom-scrollbar space-y-2 min-h-0">
                            <div class="text-center text-gray-500 py-10">リストは空です</div>
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

export const renderTempWorkList = (App) => {
    const listEl = $('#batch-temp-list');
    const countEl = $('#batch-list-count');
    const finalizeBtn = $('#batch-finalize-btn');
    const addBtn = $('#batch-add-list-btn');

    if (!listEl) return;

    countEl.textContent = `${AppState.tempWorks.length}`;
    finalizeBtn.disabled = AppState.tempWorks.length === 0;

    if (addBtn) {
        if (AppState.editingTempIndex >= 0) {
            addBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>内容を更新';
            addBtn.classList.remove('bg-lime-600', 'hover:bg-lime-700');
            addBtn.classList.add('bg-amber-600', 'hover:bg-amber-700');
        } else {
            addBtn.innerHTML = '<i class="fas fa-cart-plus mr-2"></i>リストに追加';
            addBtn.classList.remove('bg-amber-600', 'hover:bg-amber-700');
            addBtn.classList.add('bg-lime-600', 'hover:bg-lime-700');
        }
    }

    if (AppState.tempWorks.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-gray-500 text-sm">リストは空です。<br>左側で入力して追加してください。</div>`;
        return;
    }

    listEl.innerHTML = AppState.tempWorks.map((work, index) => {
        const isEditing = index === AppState.editingTempIndex;
        let activeClass = isEditing ? 'border-amber-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700';
        let warningBadge = '';

        // 重複・類似がある場合の表示切り替え
        if (work.warningStatus === 'duplicate') {
            activeClass = 'border-red-500 bg-red-900/20 hover:bg-red-900/30';
            warningBadge = `<span class="inline-block bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold">${work.warningMessage || '重複'}</span>`;
        } else if (work.warningStatus === 'similar') {
            activeClass = 'border-yellow-500 bg-yellow-900/20 hover:bg-yellow-900/30';
            warningBadge = `<span class="inline-block bg-yellow-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold">${work.warningMessage || '類似'}</span>`;
        }

        const imgUrl = work.imageData ? work.imageData.base64 : 'https://placehold.co/100x100/374151/9ca3af?text=No+Img';
        // ★修正: ここで App.getSiteBadgeHTML を使うのをやめ、インライン用の getInlineBadge を使う
        const siteBadge = getInlineBadge(work.url);

        return `
        <div class="flex items-center gap-3 p-2 rounded-lg border ${activeClass} transition-colors group relative">
            <img src="${imgUrl}" loading="lazy" class="w-12 h-12 rounded object-cover flex-shrink-0 bg-gray-900">
            <div class="flex-grow min-w-0 cursor-pointer" onclick="App.loadTempWorkToForm(${index})">
                <div class="flex items-center gap-2 flex-wrap">
                    <p class="font-bold text-sm truncate max-w-full ${isEditing ? 'text-amber-400' : 'text-gray-200'}">${App.escapeHTML(work.name)}</p>
                    ${siteBadge}
                    ${warningBadge}
                </div>
                <p class="text-xs text-gray-400 truncate">${work.genre} / ${work.registeredAtStr}</p>
            </div>
            <button onclick="App.removeTempWork(${index})" class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-800 transition-colors" title="削除">
                <i class="fas fa-trash-alt"></i>
            </button>
            ${isEditing ? '<span class="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>' : ''}
        </div>
        `;
    }).join('');
};

export const removeTempWork = (index, App) => {
    AppState.tempWorks.splice(index, 1);
    if (AppState.editingTempIndex === index) {
        App.resetBatchRegForm();
    } else if (AppState.editingTempIndex > index) {
        AppState.editingTempIndex--;
    }
    App.renderTempWorkList();
};

export const loadTempWorkToForm = async (index, App) => {
    if (AppState.isRegFormDirty && AppState.editingTempIndex !== index) {
        if (!await App.showConfirm("未保存の変更", "フォームに入力中の内容があります。\n破棄してこの作品を読み込みますか？")) return;
    }

    const work = AppState.tempWorks[index];
    AppState.editingTempIndex = index;
    AppState.isRegFormDirty = false;

    batchTempImageData = null;

    $('#batchWorkName').value = work.name;
    $('#batchWorkUrl').value = work.url;
    $('#batchWorkGenre').value = work.genre;
    $('#batchWorkRegisteredAt').value = work.registeredAtStr;
    
    const previewContainer = $('#batch-image-preview-container');
    const previewImg = $('#batch-image-preview');
    
    if (work.imageData) {
        $('#batch-image-filename').textContent = work.imageData.fileName;
        previewImg.src = work.imageData.base64;
        previewContainer.classList.remove('hidden');
        $('#batch-image-clear-btn').classList.remove('hidden');
        
        previewImg.dataset.restoredBase64 = work.imageData.base64;
        previewImg.dataset.restoredFileName = work.imageData.fileName;
    } else {
        $('#batch-image-filename').textContent = "未選択";
        previewContainer.classList.add('hidden');
        $('#batch-image-clear-btn').classList.add('hidden');
        delete previewImg.dataset.restoredBase64;
        delete previewImg.dataset.restoredFileName;
    }
    
    $('#batch-url-preview-box').innerHTML = '';
    $('#batch-url-preview-box').classList.add('hidden');
    
    App.renderTempWorkList();
    App.showToast(`「${work.name}」を編集します。`);
};

export const resetBatchRegForm = (App) => {
    AppState.editingTempIndex = -1;
    AppState.isRegFormDirty = false;
    
    batchTempImageData = null;

    $('#batchWorkName').value = '';
    $('#batchWorkUrl').value = '';
    $('#batchWorkImage').value = '';
    $('#batch-image-filename').textContent = "未選択";
    
    const previewContainer = $('#batch-image-preview-container');
    const previewImg = $('#batch-image-preview');
    
    if (previewContainer) previewContainer.classList.add('hidden');
    if ($('#batch-image-clear-btn')) $('#batch-image-clear-btn').classList.add('hidden');
    
    if (previewImg) {
        previewImg.src = '';
        delete previewImg.dataset.restoredBase64;
        delete previewImg.dataset.restoredFileName;
    }

    $('#batch-url-preview-box').innerHTML = '';
    $('#batch-url-preview-box').classList.add('hidden');

    App.renderTempWorkList();
};

export const openBatchConfirmModal = (App) => {
    const count = AppState.tempWorks.length;
    
    const content = `
        <div class="flex flex-col h-[70vh]">
            <div class="text-center mb-4">
                <h4 class="text-xl font-bold text-white mb-1">登録内容の確認</h4>
                <p class="text-gray-400">以下の ${count} 件の作品を登録します。<br>よろしければ「確定して保存」を押してください。</p>
            </div>
            
            <div class="bg-gray-900 rounded-lg p-1 overflow-hidden flex-grow border border-gray-700 overflow-y-auto custom-scrollbar">
                <table class="w-full text-left text-sm">
                    <thead class="bg-gray-800 text-gray-400 sticky top-0 z-10">
                        <tr>
                            <th class="p-3 font-medium">No.</th>
                            <th class="p-3 font-medium">画像</th>
                            <th class="p-3 font-medium">作品名 / サイト</th>
                            <th class="p-3 font-medium">属性</th>
                            <th class="p-3 font-medium">登録日</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        ${AppState.tempWorks.map((work, i) => {
                            // ★修正: ここも App.getSiteBadgeHTML をやめ、getInlineBadge を使う
                            // replace 処理も不要になります
                            const siteBadge = getInlineBadge(work.url);
                            
                            const imgUrl = work.imageData ? work.imageData.base64 : '';
                            const imgHtml = imgUrl ? `<img src="${imgUrl}" class="w-10 h-10 object-cover rounded bg-gray-800">` : '<span class="text-gray-600">-</span>';
                            
                            return `
                            <tr class="hover:bg-gray-800/50">
                                <td class="p-3 text-gray-500 text-xs">${i+1}</td>
                                <td class="p-3">${imgHtml}</td>
                                <td class="p-3">
                                    <div class="font-bold text-white truncate max-w-[200px]" title="${App.escapeHTML(work.name)}">${App.escapeHTML(work.name)}</div>
                                    <div class="mt-1">${siteBadge}</div>
                                </td>
                                <td class="p-3 text-gray-300 text-xs">${work.genre}</td>
                                <td class="p-3 text-gray-300 text-xs">${work.registeredAtStr}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="pt-4 mt-4 border-t border-gray-700 flex justify-end gap-3">
                <button id="batch-confirm-back" class="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold">
                    <i class="fas fa-arrow-left mr-2"></i>戻って編集
                </button>
                <button id="batch-confirm-save" class="px-8 py-3 bg-lime-600 hover:bg-lime-700 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95">
                    <i class="fas fa-check-circle mr-2"></i>確定して保存
                </button>
            </div>
        </div>
    `;
    
    App.openModal("一括登録の確認", content, () => {
        $('#batch-confirm-back').addEventListener('click', () => {
            App.openBatchRegistrationModal(true);
        });

        $('#batch-confirm-save').addEventListener('click', App.executeBatchSave);
    }, { size: 'max-w-4xl' });
};

export const executeBatchSave = async (App) => {
    const total = AppState.tempWorks.length;
    if (total > 500) {
        App.showToast(`一度に登録できるのは500件までです。(現在: ${total}件)`, "error");
        return;
    }

    const btn = $('#batch-confirm-save');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>保存中...`;

    try {
        const batch = writeBatch(AppState.db);
        const worksCollectionRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);

        const promises = AppState.tempWorks.map(async (work) => {
            const newDocRef = doc(worksCollectionRef);
            let imageUrl = null;
            let imageFileName = null;

            if (work.imageData) {
                try {
                    imageUrl = await App.uploadImageToStorage(work.imageData.base64, newDocRef.id);
                    imageFileName = work.imageData.fileName;
                } catch (e) {
                    console.error(`Image upload failed for ${work.name}:`, e);
                }
            }

            const newWorkData = {
                name: work.name,
                genre: work.genre,
                sourceUrl: work.url,
                registeredAt: Timestamp.fromDate(new Date(work.registeredAtStr.replace(/\//g, '-'))),
                imageUrl: imageUrl,
                imageFileName: imageFileName,
                selectionCount: 0,
                rating: 0,
                tagIds: [],
                lastSelectedAt: null,
                selectionHistory: []
            };

            batch.set(newDocRef, newWorkData);
            return true;
        });

        await Promise.all(promises);
        await batch.commit();

        App.showToast(`${total}件の作品を一括登録しました！`, "success");
        
        AppState.tempWorks = [];
        AppState.editingTempIndex = -1;
        AppState.isRegFormDirty = false;
        
        App.closeModal();
        
    } catch (error) {
        console.error("Batch save error:", error);
        App.showToast("保存中にエラーが発生しました。", "error");
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle mr-2"></i>確定して保存`;
    }
};