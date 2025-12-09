import { store as AppState } from './store';
import { writeBatch, collection, doc, Timestamp } from "firebase/firestore";

// ヘルパー関数
const $ = (selector) => document.querySelector(selector);

// 画像データをこのファイルのどこからでもリセットできるように、外に出しました
let batchTempImageData = null;

export const openBatchRegistrationModal = (App, keepData = false) => {
    
    // 1. リストデータの初期化判定
    if (!keepData) {
        AppState.tempWorks = [];
    }
    
    AppState.editingTempIndex = -1;
    AppState.isRegFormDirty = false;
    
    // 画像変数は常にリセット
    batchTempImageData = null;

    const onOpen = () => {
        AppState.checkModalDirtyState = () => {
            return AppState.tempWorks.length > 0 || AppState.isRegFormDirty;
        };

        // Initialize
        App.initializeDateInputs($('#batchRegForm'));

        // 新規で開いた場合はフォームもリセット
        if (!keepData) {
            App.resetBatchRegForm();
        }
        
        // --- Tab Logic ---
        const tabInput = $('#batch-tab-input');
        const tabList = $('#batch-tab-list');
        const tabImport = $('#batch-tab-import');
        
        const colForm = $('#batch-col-form');
        const colList = $('#batch-col-list');
        const colImport = $('#batch-col-import');

        // タブ切り替えロジック
        const switchTab = (mode) => {
            // タブボタンのスタイルリセット
            [tabInput, tabList, tabImport].forEach(el => {
                if(el) {
                    el.classList.remove('bg-gray-700', 'text-white');
                    el.classList.add('text-gray-400', 'hover:bg-gray-800');
                }
            });

            // モバイル向けの表示制御
            if (window.innerWidth < 1024) {
                // すべて隠す
                [colForm, colList, colImport].forEach(el => {
                    if(el) el.classList.add('hidden');
                    if(el) el.classList.remove('flex');
                });

                if (mode === 'input') {
                    tabInput.classList.add('bg-gray-700', 'text-white');
                    colForm.classList.remove('hidden');
                } else if (mode === 'list') {
                    tabList.classList.add('bg-gray-700', 'text-white');
                    colList.classList.remove('hidden');
                    colList.classList.add('flex');
                } else if (mode === 'import') {
                    tabImport.classList.add('bg-gray-700', 'text-white');
                    colImport.classList.remove('hidden');
                    colImport.classList.add('flex');
                }
            } else {
                // PC向けの表示制御 (リストは常に表示、左側を入力かインポートで切り替え)
                colList.classList.remove('hidden'); // リストは常時表示
                colList.classList.add('flex');

                if (mode === 'import') {
                    // インポート画面を表示
                    colImport.classList.remove('hidden'); colImport.classList.add('flex');
                    colForm.classList.add('hidden'); // 入力フォームは隠す
                    tabImport.classList.add('bg-gray-700', 'text-white');
                } else {
                    // 入力フォームを表示 (listモードが指定された場合もPCでは入力フォームを表示しておく)
                    colForm.classList.remove('hidden');
                    colImport.classList.add('hidden'); colImport.classList.remove('flex');
                    
                    // タブのアクティブ状態は「入力」にする（PCではリストタブは概念的に不要だがUI上残す）
                    if (mode === 'list') {
                        tabList.classList.add('bg-gray-700', 'text-white'); // 視覚的にリストタブを押したことにする
                    } else {
                        tabInput.classList.add('bg-gray-700', 'text-white');
                    }
                }
            }
        };

        if(tabInput) tabInput.addEventListener('click', () => switchTab('input'));
        if(tabList) tabList.addEventListener('click', () => switchTab('list'));
        if(tabImport) tabImport.addEventListener('click', () => switchTab('import'));

        App.renderTempWorkList();

        // --- 既存の入力フォームロジック ---
        const form = $('#batchRegForm');
        const nameInput = $('#batchWorkName');
        const urlInput = $('#batchWorkUrl');
        const imageInput = $('#batchWorkImage');
        const suggestContainer = $('#batch-suggest-container');
        
        // サジェスト機能
        const handleInputSuggestion = App.debounce(() => {
            const query = nameInput.value.trim();
            if (!query || query.length < 2) {
                suggestContainer.innerHTML = '';
                return;
            }
            const normalizedQuery = App.normalizeString(query);
            
            const registeredMatches = AppState.works
                .filter(w => App.normalizeString(w.name).includes(normalizedQuery))
                .slice(0, 3);
            const listMatches = AppState.tempWorks
                .map((w, index) => ({ ...w, originalIndex: index }))
                .filter(w => App.normalizeString(w.name).includes(normalizedQuery))
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

        nameInput.addEventListener('blur', () => setTimeout(() => suggestContainer.innerHTML = '', 200));

        const setDirty = () => { AppState.isRegFormDirty = true; };
        urlInput.addEventListener('input', setDirty);
        $('#batchWorkGenre').addEventListener('change', setDirty);
        imageInput.addEventListener('change', setDirty);
        
        App.setupInputClearButton(nameInput, $('#clear-batchWorkName'));
        App.setupInputClearButton(urlInput, $('#clear-batchWorkUrl'));

        const previewBox = $('#batch-url-preview-box');
        urlInput.addEventListener('blur', () => {
            const url = urlInput.value.trim();
            if (url && url.length > 10 && url.startsWith('http')) App.fetchLinkPreview(url, previewBox);
            else { previewBox.innerHTML = ''; previewBox.classList.add('hidden'); }
        });

        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const base64 = await App.processImage(file);
                    batchTempImageData = { base64, file, fileName: file.name };
                    $('#batch-image-filename').textContent = file.name;
                    $('#batch-image-preview').src = base64;
                    $('#batch-image-preview-container').classList.remove('hidden');
                    $('#batch-image-clear-btn').classList.remove('hidden');
                } catch (err) {
                    App.showToast(err.message, "error");
                    imageInput.value = '';
                }
            }
        });
        
        $('#batch-image-clear-btn').addEventListener('click', () => {
            imageInput.value = '';
            batchTempImageData = null;
            $('#batch-image-filename').textContent = "未選択";
            $('#batch-image-preview-container').classList.add('hidden');
            $('#batch-image-clear-btn').classList.add('hidden');
            setDirty();
        });

        $('#batch-external-search-btn').addEventListener('click', () => {
            App.openExternalSearchModal(nameInput.value);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let finalImageData = batchTempImageData;
            const previewImg = $('#batch-image-preview');
            if (!finalImageData && previewImg && previewImg.dataset.restoredBase64) {
                finalImageData = { base64: previewImg.dataset.restoredBase64, fileName: previewImg.dataset.restoredFileName, file: null };
            }

            const name = nameInput.value.trim();
            const dateStr = App.getDateInputValue('batchWorkRegisteredAt');

            if (!name) return App.showToast("作品名は必須です。", "error");
            if (!App.isValidDate(dateStr)) return App.showToast("日付形式が不正です。", "error");

            if (AppState.editingTempIndex === -1) {
                if (AppState.works.some(w => w.name === name)) {
                    if (!confirm(`「${name}」は既に登録済みの作品です。\n重複して登録しますか？`)) return;
                }
            }

            const newItem = {
                name: name, url: urlInput.value.trim(), genre: $('#batchWorkGenre').value,
                registeredAtStr: dateStr, imageData: finalImageData, site: App.getWorkSite(urlInput.value.trim())
            };

            if (AppState.editingTempIndex >= 0) {
                AppState.tempWorks[AppState.editingTempIndex] = newItem;
                App.showToast("リストの内容を更新しました。");
            } else {
                if (AppState.tempWorks.some(w => w.name === newItem.name)) return App.showToast("その作品名は既にリストにあります。", "error");
                AppState.tempWorks.push(newItem);
                App.showToast(`「${name}」をリストに追加しました。`, 'success');
                const badge = $('#batch-tab-badge');
                if(badge) { badge.classList.remove('hidden'); setTimeout(() => badge.classList.add('animate-ping'), 100); setTimeout(() => badge.classList.remove('animate-ping'), 600); }
            }

            App.resetBatchRegForm(); 
            App.renderTempWorkList();
            suggestContainer.innerHTML = '';
        });

        $('#batch-clear-form-btn').addEventListener('click', () => { App.resetBatchRegForm(); App.showToast("フォームをクリアしました"); });

        // ★新機能: リストリセットボタン
        $('#batch-reset-list-btn').addEventListener('click', async () => {
            if (AppState.tempWorks.length === 0) return;
            if (await App.showConfirm("リストの全削除", "リストに追加された全ての作品を削除しますか？\nこの操作は取り消せません。")) {
                AppState.tempWorks = [];
                App.resetBatchRegForm(); // 編集中の内容もあれば破棄
                App.renderTempWorkList();
                App.showToast("リストをリセットしました。");
            }
        });

        $('#batch-finalize-btn').addEventListener('click', () => {
            if (AppState.tempWorks.length === 0) return;
            if (AppState.isRegFormDirty) {
                if (!confirm("フォームに入力中の内容があります（未追加）。\n破棄して確定画面に進みますか？\n（追加する場合は「キャンセル」して「リストに追加」を押してください）")) return;
            }
            App.openBatchConfirmModal();
        });

        // --- テキスト一括取り込みロジック (改良版) ---
        $('#batch-import-run-btn').addEventListener('click', () => {
            const text = $('#batch-import-textarea').value;
            if (!text.trim()) return App.showToast("テキストを入力してください。", "error");

            const lines = text.split(/\r\n|\n|\r/);
            const dateStr = App.getDateInputValue('batchImportRegisteredAt');
            const genre = $('#batchImportGenre').value;
            let addedCount = 0;

            lines.forEach(line => {
                line = line.trim();
                if (!line) return;

                let url = '';
                const urlMatch = line.match(/https?:\/\/[^\s]+/);
                if (urlMatch) {
                    url = urlMatch[0];
                    line = line.replace(url, '').trim(); 
                }

                const normalizedLine = App.normalizeString(line);
                
                // 重複・類似判定
                let warningStatus = null;
                let warningMessage = null;

                // 1. 完全一致チェック (登録済み)
                const isRegistered = AppState.works.some(w => App.normalizeString(w.name) === normalizedLine);
                if (isRegistered) {
                    warningStatus = 'duplicate';
                    warningMessage = '登録済';
                }

                // 2. 類似チェック (登録済み) - 完全一致でない場合のみ
                if (!warningStatus) {
                    const isSimilar = AppState.works.some(w => {
                        const n = App.normalizeString(w.name);
                        return n.includes(normalizedLine) || normalizedLine.includes(n);
                    });
                    if (isSimilar) {
                        warningStatus = 'similar';
                        warningMessage = '類似あり';
                    }
                }

                // 3. リスト内重複チェック
                if (!warningStatus) {
                    const isTempDup = AppState.tempWorks.some(w => App.normalizeString(w.name) === normalizedLine);
                    if (isTempDup) {
                        warningStatus = 'duplicate'; // リスト内重複も赤警告にする
                        warningMessage = 'リスト重複';
                    }
                }

                AppState.tempWorks.push({
                    name: line,
                    url: url,
                    genre: genre,
                    registeredAtStr: dateStr,
                    imageData: null,
                    site: App.getWorkSite(url),
                    warningStatus: warningStatus, // ステータスを保持
                    warningMessage: warningMessage
                });
                addedCount++;
            });

            if (addedCount > 0) {
                App.showToast(`${addedCount}件を解析しました。リストを確認してください。`, "success");
                $('#batch-import-textarea').value = '';
                switchTab('list'); // インポート後はリストタブへ
                App.renderTempWorkList();
            } else {
                App.showToast("有効な行が見つかりませんでした。", "info");
            }
        });
    };

    const content = `
        <div class="flex flex-col h-[80vh] lg:h-[75vh]">
            <div class="flex lg:hidden bg-gray-900 rounded-t-lg mb-2 p-1 gap-1 shrink-0">
                <button id="batch-tab-input" class="flex-1 py-2 text-sm font-bold rounded-md bg-gray-700 text-white transition-colors text-center"><i class="fas fa-pen mr-2"></i>入力</button>
                <button id="batch-tab-import" class="flex-1 py-2 text-sm font-bold rounded-md text-gray-400 hover:bg-gray-800 transition-colors text-center"><i class="fas fa-file-import mr-2"></i>一括貼付</button>
                <button id="batch-tab-list" class="flex-1 py-2 text-sm font-bold rounded-md text-gray-400 hover:bg-gray-800 transition-colors text-center relative">
                    <i class="fas fa-list-ul mr-2"></i>リスト
                    <span id="batch-tab-badge" class="hidden absolute top-1 right-2 w-2 h-2 bg-sky-500 rounded-full"></span>
                </button>
            </div>

            <div class="flex flex-col lg:flex-row gap-4 flex-grow overflow-hidden relative">
                
                <div id="batch-col-form" class="w-full lg:w-7/12 flex flex-col h-full overflow-y-auto pr-1 lg:pr-2 custom-scrollbar transition-all absolute inset-0 lg:relative z-10 bg-gray-800 lg:bg-transparent">
                    <div class="flex justify-between items-center mb-3 hidden lg:flex">
                        <h4 class="text-lg font-bold text-lime-400"><i class="fas fa-pen mr-2"></i>作品情報を入力</h4>
                        <button id="batch-tab-import-pc" class="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" onclick="document.getElementById('batch-tab-import').click()">
                            <i class="fas fa-file-import mr-1"></i>テキストから一括登録
                        </button>
                    </div>

                    <form id="batchRegForm" class="space-y-4 flex-grow pb-2">
                        <div class="relative">
                            <label class="block text-sm font-medium text-gray-400 mb-1">作品名 <span class="text-red-500">*</span></label>
                            <div class="flex items-center gap-2">
                                <div class="relative flex-grow">
                                    <input type="text" id="batchWorkName" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-base focus:ring-2 focus:ring-lime-500 pr-10" placeholder="作品名を入力..." autocomplete="off">
                                    <button type="button" id="clear-batchWorkName" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden"><i class="fas fa-times-circle text-lg"></i></button>
                                </div>
                                <button type="button" id="batch-external-search-btn" class="w-12 h-12 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white flex items-center justify-center shrink-0" title="外部検索"><i class="fas fa-globe-asia text-lg"></i></button>
                            </div>
                            <div id="batch-suggest-container" class="relative z-50"></div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-400 mb-1">作品URL (任意)</label>
                            <div class="relative">
                                <input type="url" id="batchWorkUrl" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-lime-500 pr-10" placeholder="https://..." autocomplete="off">
                                <button type="button" id="clear-batchWorkUrl" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden"><i class="fas fa-times-circle text-lg"></i></button>
                            </div>
                            <div id="batch-url-preview-box" class="hidden mt-2"></div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-400 mb-1">ジャンル <span class="text-red-500">*</span></label>
                                <div class="relative">
                                    <select id="batchWorkGenre" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm appearance-none">
                                        <option value="漫画">漫画</option>
                                        <option value="ゲーム">ゲーム</option>
                                        <option value="動画">動画</option>
                                    </select>
                                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400"><i class="fas fa-chevron-down"></i></div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-400 mb-1">登録日 <span class="text-red-500">*</span></label>
                                ${App.createDateInputHTML('batchWorkRegisteredAt', App.formatDateForInput(new Date()))}
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-400 mb-1">画像 (任意)</label>
                            <div class="flex items-center gap-3 bg-gray-700 p-2 rounded-lg border border-gray-600">
                                <label class="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm shrink-0">
                                    <i class="fas fa-image mr-1"></i> 選択
                                    <input type="file" id="batchWorkImage" accept="image/jpeg,image/png,image/webp" class="hidden">
                                </label>
                                <span id="batch-image-filename" class="text-xs text-gray-400 truncate flex-1">未選択</span>
                                <button type="button" id="batch-image-clear-btn" class="text-gray-400 hover:text-red-400 hidden px-2"><i class="fas fa-trash"></i></button>
                            </div>
                            <div id="batch-image-preview-container" class="mt-2 hidden text-center bg-gray-900 rounded-lg p-2">
                                <img id="batch-image-preview" src="" class="max-h-32 mx-auto rounded border border-gray-700">
                            </div>
                        </div>
                        
                        <div class="pt-4 flex gap-3 mt-auto sticky bottom-0 bg-gray-800 pb-1">
                            <button type="button" id="batch-clear-form-btn" class="px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm shrink-0">クリア</button>
                            <button type="submit" id="batch-add-list-btn" class="flex-grow px-4 py-3 bg-lime-600 hover:bg-lime-700 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center">
                                <i class="fas fa-cart-plus mr-2"></i>リストに追加
                            </button>
                        </div>
                    </form>
                </div>

                <div id="batch-col-import" class="hidden w-full lg:w-7/12 flex-col h-full bg-gray-800 lg:bg-transparent absolute inset-0 lg:relative z-10">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="text-lg font-bold text-sky-400"><i class="fas fa-file-import mr-2"></i>テキスト一括貼り付け</h4>
                        <button class="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 lg:hidden" onclick="document.getElementById('batch-tab-input').click()">
                            戻る
                        </button>
                    </div>
                    <div class="bg-gray-900 p-3 rounded-lg border border-gray-700 text-sm text-gray-400 mb-3">
                        <p>作品名を改行区切りで貼り付けてください。<br>URLが含まれている行は、URLも自動で登録されます。</p>
                    </div>
                    <textarea id="batch-import-textarea" class="flex-grow w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-sky-500 mb-3 text-sm" placeholder="作品A&#13;&#10;作品B https://example.com/b&#13;&#10;作品C"></textarea>
                    
                    <div class="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <label class="block text-xs text-gray-400 mb-1">ジャンル</label>
                            <select id="batchImportGenre" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm">
                                <option value="漫画">漫画</option>
                                <option value="ゲーム">ゲーム</option>
                                <option value="動画">動画</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-400 mb-1">登録日</label>
                            ${App.createDateInputHTML('batchImportRegisteredAt', App.formatDateForInput(new Date()))}
                        </div>
                    </div>
                    
                    <button id="batch-import-run-btn" class="w-full py-3 bg-sky-600 hover:bg-sky-700 rounded-lg font-bold text-white shadow-lg">
                        <i class="fas fa-magic mr-2"></i>解析してリストに追加
                    </button>
                </div>

                <div id="batch-col-list" class="hidden lg:flex w-full lg:w-5/12 bg-gray-900 rounded-xl p-3 flex-col h-full border border-gray-700 absolute lg:relative inset-0 z-20 lg:z-0">
                    <div class="flex justify-between items-center mb-3 pb-2 border-b border-gray-700 shrink-0">
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-sky-400"><i class="fas fa-list-ul mr-2"></i>登録予定</h4>
                            <span id="batch-list-count" class="bg-gray-700 text-xs px-2 py-1 rounded-full">0</span>
                        </div>
                        <button id="batch-reset-list-btn" class="text-gray-400 hover:text-red-500 p-2 rounded hover:bg-gray-800 transition-colors" title="リストを空にする">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    <div id="batch-temp-list" class="flex-grow overflow-y-auto space-y-2 pr-1 mb-3 custom-scrollbar">
                        <div class="text-center py-10 text-gray-500 text-sm">
                            リストは空です。<br>左側で入力するか、一括貼付してください。
                        </div>
                    </div>
                    <button id="batch-finalize-btn" class="w-full py-4 bg-sky-600 hover:bg-sky-700 rounded-lg font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                        確定画面へ進む <i class="fas fa-arrow-right ml-2"></i>
                    </button>
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
        const siteBadge = App.getSiteBadgeHTML(work.url);

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
                            let siteBadge = App.getSiteBadgeHTML(work.url);
                            siteBadge = siteBadge.replace('site-badge', 'inline-block px-2 py-0.5 rounded font-bold text-xs');
                            
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