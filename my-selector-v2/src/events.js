// src/events.js
import { store as AppState } from './store.js';

// ヘルパー関数（このファイル内用）
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// ★ イベントリスナー設定の本体
// main.js の App オブジェクトを受け取って、その機能を呼び出します
export const setupAppEventListeners = (App) => {
    const { ui } = AppState;

    // --- モーダル・FAB関連 ---
    ui.modalCloseBtn.addEventListener('click', App.closeModal);
    ui.modalBackdrop.addEventListener('click', App.closeModal);
    ui.slidingFabToggle.addEventListener('click', App.toggleFabMenu);
    ui.fabBackdrop.addEventListener('click', App.closeFabMenu);

    // キーボードショートカット (Escキー)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (AppState.ui.imageCompareModal.classList.contains('active')) {
                App.closeImageCompareModal();
            } else if (!AppState.ui.modalWrapper.classList.contains('hidden')) {
                App.closeModal();
            } else if (!AppState.ui.fabBackdrop.classList.contains('hidden')) {
                App.closeFabMenu();
            }
        }
    });

    // --- リスト内のボタン操作 (Delegation) ---
    // 編集、削除、タグ操作、コピーなど
    document.body.addEventListener('click', e => {
        const button = e.target.closest('button[data-action]');
        const nameSpan = e.target.closest('[data-action="copy-name"]');
        const filterButton = e.target.closest('button[data-action="remove-filter"]');

        if (button) {
            const { action, id, name } = button.dataset;
            const actionHandlers = {
                'edit': () => App.openEditModal(id),
                'delete': () => App.deleteWork(id, name),
                'toggle-tags': () => {
                    AppState.expandedTagsWorkIds.has(id) ? AppState.expandedTagsWorkIds.delete(id) : AppState.expandedTagsWorkIds.add(id);
                    App.renderWorkList();
                },
                'external-search-reg': () => { /* 個別実装のため空 */ }
            };
            if (actionHandlers[action]) {
                actionHandlers[action]();
            }
        }
        if (nameSpan) {
            ui.searchInput.value = nameSpan.dataset.name;
            ui.searchInput.focus();
            App.showToast(`「${nameSpan.dataset.name}」を検索欄にコピーしました。`);
        }
        if (filterButton) {
            const { type, value } = filterButton.dataset;
            switch(type) {
                case 'genre': AppState.listFilters.genres.delete(value); break;
                case 'rating': AppState.listFilters.rating = { type: 'exact', value: 0 }; break;
                case 'unrated': AppState.listFilters.unratedOrUntaggedOnly = false; break;
                case 'andTag': AppState.listFilters.andTagIds.delete(value); break;
                case 'orTag': AppState.listFilters.orTagIds.delete(value); break;
                case 'notTag': AppState.listFilters.notTagIds.delete(value); break;
                case 'date': AppState.listFilters.dateFilter = AppState.defaultDateFilter(); break;
            }
            // 修正: 暗号化して保存するように変更
            const filtersToSave = { 
                ...AppState.listFilters, 
                genres: [...AppState.listFilters.genres], 
                sites: [...AppState.listFilters.sites], 
                andTagIds: [...AppState.listFilters.andTagIds], 
                orTagIds: [...AppState.listFilters.orTagIds], 
                notTagIds: [...AppState.listFilters.notTagIds] 
            };
            const encrypted = App.encryptData(filtersToSave);
            if (encrypted) localStorage.setItem('listFilters_encrypted', encrypted);
            
            AppState.currentPage = 1;
            App.renderAll();
        }
    });

    // --- 同期・データ管理関連 ---
    ui.copySyncIdBtn.addEventListener('click', () => navigator.clipboard.writeText(AppState.syncId).then(() => App.showToast("同期IDをコピーしました。")));
    
    ui.loadSyncIdBtn.addEventListener('click', () => {
        const newId = ui.newSyncIdInput.value.trim();
        if (newId && newId !== AppState.syncId) {
            App.loadDataSet(newId);
            App.updateSyncIdHistory(newId);
            ui.newSyncIdInput.value = '';
            App.showToast("データを読み込みました。");
        }
    });
    
    ui.syncIdHistoryEl.addEventListener('change', e => e.target.value && App.loadDataSet(e.target.value));
    
    ui.clearHistoryBtn.addEventListener('click', async () => {
        if (await App.showConfirm('履歴のクリア', '本当に同期IDの履歴をクリアしますか？')) {
            localStorage.removeItem('r18_sync_id_history');
            App.renderSyncIdHistory(); App.showToast("履歴をクリアしました。");
        }
    });
    
    ui.deleteDataBtn.addEventListener('click', async () => {
         if (AppState.isDebugMode) return App.showToast('デバッグモード中は全削除できません。');
         if (await App.showConfirm('全作品データ削除', `現在のID (<strong>${AppState.syncId}</strong>) に紐づく全ての作品データを削除します。<br>この操作は元に戻せません。`)) {
            try {
                // ここはFirestore操作を含むため、本来はActions経由が理想だが、
                // 既存ロジックを維持するためApp経由で実行させる形にするか、
                // main.jsに残ったロジックを呼び出す必要があるが、deleteDataBtnの実装は
                // 以前 main.js 内にベタ書きされていたため、ここに移設するには Firestore import が必要。
                // ★簡略化のため、Appオブジェクトに `deleteAllData` というメソッドがあると仮定して呼び出すか、
                // またはここでFirestoreをimportする必要がある。
                // → 今回は main.js 側のコード量を減らす目的なので、
                // ここでは「クリックされたら App.handleDeleteAllData() を呼ぶ」形にします。
                // ※後ほど main.js 側に handleDeleteAllData を定義してもらいます。
                App.handleDeleteAllData();
            } catch(error) { 
               // Error handling handled in App.handleDeleteAllData
            }
         }
    });

    ui.exportBackupBtn.addEventListener('click', App.handleExportBackup);
    ui.importBackupBtn.addEventListener('click', () => { App.showToast("インポート機能は現在未実装です。", "error"); });
    
    App.setupInputClearButton(ui.searchInput, $('#clear-searchInput'));

    // --- 一括登録ボタン ---
    const openBatchBtn = $('#open-batch-reg-modal-btn');
    if (openBatchBtn) {
        openBatchBtn.addEventListener('click', App.openBatchRegistrationModal);
    }

    // --- デバッグモード切替 ---
    $('#toggleDebugModeBtn').addEventListener('click', App.toggleDebugMode);

    // --- 検索関連 ---
    ui.searchInput.addEventListener('input', App.debounce(() => {
        const query = ui.searchInput.value;
        if (query.length > 0) {
            App.renderSuggestions(query);
        } else {
            // 修正: 空になったら検索を解除して全件表示に戻す
            App.performSearch('');
            App.renderSearchHistory();
        }
    }, 300));

    ui.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); App.performSearch(ui.searchInput.value); }
        if (e.key === 'Escape') App.closeSuggestBox();
    });

    ui.searchInput.addEventListener('focus', () => {
        if (ui.searchInput.value.length === 0) App.renderSearchHistory();
        else App.renderSuggestions(ui.searchInput.value);
    });

    document.addEventListener('click', (e) => {
        const searchContainer = ui.searchInput.closest('div.relative');
        if (AppState.isSuggestBoxOpen && !searchContainer.contains(e.target)) App.closeSuggestBox();
    });

    const suggestBox = $('#search-suggest-box');
    if (suggestBox) {
        suggestBox.addEventListener('click', (e) => {
            const selectButton = e.target.closest('button[data-action="select-history"]');
            const deleteButton = e.target.closest('button[data-action="delete-history"]');
            const clearAllButton = e.target.closest('button[data-action="clear-history"]');
            const suggestionButton = e.target.closest('button.search-suggestion-item');

            let query = null;
            let action = null;

            if (selectButton) { query = selectButton.dataset.query; action = 'search'; }
            else if (suggestionButton) { query = suggestionButton.dataset.query; action = 'search'; }
            else if (deleteButton) { e.stopPropagation(); const q = deleteButton.dataset.query; AppState.searchHistory = AppState.searchHistory.filter(i => i !== q); localStorage.setItem('searchHistory', JSON.stringify(AppState.searchHistory)); App.renderSearchHistory(); return; }
            else if (clearAllButton) { e.stopPropagation(); AppState.searchHistory = []; localStorage.removeItem('searchHistory'); App.renderSearchHistory(); return; }

            if (action === 'search' && query !== null) {
                e.stopPropagation();
                App.performSearch(query);
                if (suggestBox.parentElement !== AppState.ui.searchInput.closest('div.relative')) {
                    AppState.ui.searchInput.focus();
                    App.showToast(`「${query}」を検索しました。`);
                }
                App.closeSuggestBox();
            }
        });
    }

    // --- ソート・表示切替 ---
    ui.sortBtn.addEventListener('click', (e) => { e.stopPropagation(); ui.sortDropdown.classList.toggle('hidden'); });
    document.addEventListener('click', () => ui.sortDropdown.classList.add('hidden'));
    
    const setupSortOptions = () => {
        const options = App.getSortOptions();
        ui.sortDropdown.innerHTML = options.map(opt => `<a href="#" data-by="${opt.by}" data-order="${opt.order}" class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">${opt.label}</a>`).join('');
        ui.sortDropdown.addEventListener('click', (e) => {
             e.preventDefault();
             const target = e.target.closest('a');
             if (target) {
                AppState.sortState.by = target.dataset.by; AppState.sortState.order = target.dataset.order;
                ui.sortStateLabel.textContent = `並び替え: ${target.textContent}`;
                const encryptedSortState = App.encryptData(AppState.sortState);
                if (encryptedSortState) localStorage.setItem('sortState_encrypted', encryptedSortState);
                AppState.currentPage = 1;
                ui.sortDropdown.classList.add('hidden'); App.renderWorkList();
             }
        });
    };
    setupSortOptions();
    
    ui.filterBtn.addEventListener('click', () => App.openFilterModal());
    ui.viewGridBtn.addEventListener('click', () => { AppState.listViewMode = 'grid'; localStorage.setItem('listViewMode', 'grid'); App.renderWorkList(); });
    ui.viewListBtn.addEventListener('click', () => { AppState.listViewMode = 'list'; localStorage.setItem('listViewMode', 'list'); App.renderWorkList(); });
    
    // --- FABメニュー ---
    ui.manageTagsFab.addEventListener('click', () => { App.openTagModal({ mode: 'manage', onConfirm: ()=>{} }); App.closeFabMenu(); });
    ui.statsFab.addEventListener('click', () => { App.openStatsDashboardModal(); App.closeFabMenu(); });
    ui.externalSearchFab.addEventListener('click', () => { App.openExternalSearchModal(ui.searchInput.value); App.closeFabMenu(); });
    ui.historyFab.addEventListener('click', () => { App.openHistoryModal(); App.closeFabMenu(); });
    
    // --- 抽選 ---
    ui.openLotterySettingsBtn.addEventListener('click', () => App.openLotterySettingsModal());
    ui.startLotteryBtn.addEventListener('click', App.performLottery);

    const lotteryPanel = $('#lottery-panel');
    if (lotteryPanel && ui.drawerLotteryFab) {
        ui.drawerLotteryFab.addEventListener('click', () => {
            lotteryPanel.scrollIntoView({ behavior: 'smooth' });
            App.closeFabMenu();
        });
    }
    
    // --- 画像比較モーダル ---
    ui.imageCompareCloseBtn.addEventListener('click', () => App.closeImageCompareModal());
    ui.imageCompareModalBackdrop.addEventListener('click', () => App.closeImageCompareModal());
    ui.imageCompareCancelBtn.addEventListener('click', () => { App.closeImageCompareModal(); App.showToast("画像の変更をキャンセルしました。", "info"); });
    ui.imageCompareConfirmBtn.addEventListener('click', () => {
        App.closeImageCompareModal(false);
        const editCurrentImagePreview = $('#edit-current-image-preview');
        const editNoImagePlaceholder = $('#edit-no-image-placeholder');
        const editImageDeleteBtn = $('#edit-image-delete-btn');
        if (editCurrentImagePreview && AppState.tempNewImageUrl) {
            editCurrentImagePreview.src = AppState.tempNewImageUrl;
            editCurrentImagePreview.classList.remove('hidden');
            editNoImagePlaceholder.classList.add('hidden');
            editImageDeleteBtn.classList.remove('hidden');
            AppState.deleteImageFlag = false;
        }
        App.showToast("新しい画像が適用されます。保存ボタンで確定してください。", "success");
    });

    // --- ページネーション ---
    const setupPaginationListeners = (container) => {
        if (!container) return;
        container.querySelector('.prevPageBtn').addEventListener('click', () => {
            if (AppState.currentPage > 1) {
                AppState.currentPage--;
                App.renderWorkList();
                $('#pagination-controls-top').scrollIntoView({ behavior: 'smooth' });
            }
        });
        container.querySelector('.nextPageBtn').addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(App.getFilteredAndSortedWorks().length / AppState.itemsPerPage));
            if (AppState.currentPage < totalPages) {
                AppState.currentPage++;
                App.renderWorkList();
                $('#pagination-controls-top').scrollIntoView({ behavior: 'smooth' });
            }
        });
        container.querySelector('.itemsPerPageSelect').addEventListener('change', (e) => {
            AppState.itemsPerPage = parseInt(e.target.value, 10);
            AppState.currentPage = 1;
            App.renderWorkList();
            localStorage.setItem('itemsPerPage', AppState.itemsPerPage);
        });
    };

    setupPaginationListeners($('#pagination-controls-top'));
    setupPaginationListeners($('#pagination-controls'));

    // --- Liteモード切替 ---
    const activateLiteMode = () => {
        AppState.isLiteMode = true;
        localStorage.setItem('isLiteMode', 'true');
        App.showToast("Liteモードで再読み込みします...", "info");
        setTimeout(() => { location.reload(); }, 1000);
    };

    const liteModeDebugBtn = $('#lite-mode-switch-debug');
    const liteModeProdBtn = $('#lite-mode-switch-prod');
    if (liteModeDebugBtn) liteModeDebugBtn.addEventListener('click', activateLiteMode);
    if (liteModeProdBtn) liteModeProdBtn.addEventListener('click', activateLiteMode);

    // 追加: FABメニューに画像生成ボタンを動的に追加
    const fabDrawer = $('#sliding-fab-drawer');
    if (fabDrawer && !$('#imgGenFab')) {
        const btn = document.createElement('button');
        btn.id = 'imgGenFab';
        btn.title = '画像生成';
        btn.className = 'w-14 h-14 bg-pink-600 hover:bg-pink-700 rounded-full text-white flex items-center justify-center shadow-lg';
        btn.innerHTML = '<i class="fas fa-camera text-xl"></i>';
        btn.addEventListener('click', () => {
            App.openImageGeneratorModal();
            App.closeFabMenu();
        });
        // 履歴ボタンの前あたりに挿入
        const historyBtn = $('#historyFab');
        if (historyBtn) fabDrawer.insertBefore(btn, historyBtn);
        else fabDrawer.appendChild(btn);
    }
};