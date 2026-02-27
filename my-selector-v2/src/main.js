// src/main.js - Part 1
import './style.css';
import { auth, db, storage, functions } from './services/firebaseConfig';
import { store as AppState } from './store/store';
import * as Utils from './utils/utils';

// UI生成ロジック & アクション
import * as UI from './components/ui.js';
import * as Actions from './services/actions.js';
import { setupAppEventListeners } from './events.js';
import * as Modals from './modals.js';
import * as Batch from './batch.js';
import * as Stats from './stats.js';
import * as Lottery from './lottery.js';
import { render, html } from 'lit-html';

// DB & Search
import * as DB from './services/db.js';
import * as Search from './search.js';

// Firebase Modules
import { signInWithEmailAndPassword, onIdTokenChanged } from "firebase/auth";
import { 
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
    onSnapshot, query, writeBatch, Timestamp, serverTimestamp, 
    getDocs, addDoc, arrayUnion, arrayRemove, deleteField, 
    orderBy, limit, enableNetwork, disableNetwork
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getApp } from "firebase/app";
import { NetworkService } from './services/network.js';

// Helper Functions
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// AppState overrides
AppState.unsubscribeWorks = () => {};
AppState.unsubscribeTags = () => {};
AppState.checkModalDirtyState = () => false;
AppState.defaultDateFilter = () => ({ mode: 'none', date: '', startDate: '', endDate: '' });

// --- App Object Definition Start ---
const App = {

    // --- Initialization ---
    init: () => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(() => {});
            });
        }
        $('#version-display').textContent = AppState.appVersion;

        AppState.listViewMode = localStorage.getItem('listViewMode') || 'grid';
        if (localStorage.getItem('isLiteMode') === 'true') {
            AppState.isLiteMode = true;
            localStorage.removeItem('isLiteMode');
        }
        AppState.showSiteIcon = localStorage.getItem('showSiteIcon') !== 'false'; 
        AppState.itemsPerPage = parseInt(localStorage.getItem('itemsPerPage') || '20', 10);

        // Cache UI Elements
        AppState.ui = {
            loadingOverlay: $('#loading-overlay'),
            loadingContent: $('#loading-content'),
            loadingText: $('#loading-text'),
            loadingProgressBar: $('#loading-progress-bar'),
            appContainer: $('#app-container'),
            workListEl: $('#workList'),
            workListMessage: $('#workListMessage'),
            workCountEl: $('#workCount'),
            syncIdDisplay: $('#syncIdDisplay'),
            copySyncIdBtn: $('#copySyncIdBtn'),
            newSyncIdInput: $('#newSyncIdInput'),
            loadSyncIdBtn: $('#loadSyncIdBtn'),
            syncIdHistoryEl: $('#syncIdHistory'),
            clearHistoryBtn: $('#clearHistoryBtn'),
            deleteDataBtn: $('#deleteDataBtn'),
            exportBackupBtn: $('#exportBackupBtn'),
            importBackupBtn: $('#importBackupBtn'),
            addWorkForm: $('#addWorkForm'),
            searchInput: $('#searchInput'),
            sortBtn: $('#sortBtn'),
            sortDropdown: $('#sortDropdown'),
            sortStateLabel: $('#sortStateLabel'),
            filterBtn: $('#filterBtn'),
            activeFiltersEl: $('#activeFilters'),
            viewGridBtn: $('#view-grid-btn'),
            viewListBtn: $('#view-list-btn'),
            lotterySummaryEl: $('#lotterySummary'),
            startLotteryBtn: $('#startLotteryBtn'),
            openLotterySettingsBtn: $('#openLotterySettingsBtn'),
            fabBackdrop: $('#fab-backdrop'),
            historyFab: $('#historyFab'),
            externalSearchFab: $('#externalSearchFab'),
            statsFab: $('#statsFab'),
            manageTagsFab: $('#manageTagsFab'),
            drawerLotteryFab: $('#drawerLotteryFab'),
            modalBackdrop: $('#modal-backdrop'),
            modalWrapper: $('#modal-wrapper'),
            modalContainer: $('#modal-container'),
            modalTitle: $('#modal-title'),
            modalContentHost: $('#modal-content-host'),
            modalCloseBtn: $('#modal-close-btn'),
            imageCompareModalBackdrop: $('#image-compare-modal-backdrop'),
            imageCompareModal: $('#image-compare-modal'),
            imageCompareCloseBtn: $('#image-compare-close-btn'),
            compareOriginalImage: $('#compare-original-image'),
            compareNewImage: $('#compare-new-image'),
            imageCompareConfirmBtn: $('#image-compare-confirm-btn'),
            imageCompareCancelBtn: $('#image-compare-cancel-btn'),
            passwordOverlay: $('#password-overlay'),
            passwordForm: $('#password-form'),
            passwordInput: $('#password-input'),
            passwordError: $('#password-error'),
            toastEl: $('#toast'),
            toastMessageEl: $('#toast-message'),
            confirmModal: $('#confirm-modal'),
            confirmTitle: $('#confirm-title'),
            confirmMessage: $('#confirm-message'),
            confirmOkBtn: $('#confirm-ok'),
            confirmCancelBtn: $('#confirm-cancel'),
            paginationControls: $('#pagination-controls'),
            itemsPerPageSelect: $('#itemsPerPageSelect'),
            prevPageBtn: $('#prevPageBtn'),
            pageInfo: $('#pageInfo'),
            nextPageBtn: $('#nextPageBtn'),
            slidingFabContainer: $('#fab-menu-content'), 
            slidingFabToggle: $('#fab-main-toggle'),
            reloadWorksBtn: $('#reloadWorksBtn')
        };

        const sortOptions = App.getSortOptions(); 
        const currentSortOption = sortOptions.find(opt => opt.by === AppState.sortState.by && opt.order === AppState.sortState.order);
        if (currentSortOption && AppState.ui.sortStateLabel) { 
            AppState.ui.sortStateLabel.textContent = `並び替え: ${currentSortOption.label}`;
        }

        // Login Form Listener
        const loginForm = $('#login-form');
        const loginEmail = $('#login-email');
        const loginPassword = $('#login-password');
        const loginError = $('#login-error');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = loginEmail.value;
                const password = loginPassword.value;
                
                signInWithEmailAndPassword(AppState.auth, email, password)
                    .then(() => {
                        loginError.classList.add('hidden');
                        AppState.ui.loadingOverlay.classList.remove('hidden'); 
                    })
                    .catch((error) => {
                        const errorCode = error.code;
                        if (AppState.isDebugMode) console.error("Login failed:", error);
                        if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
                            loginError.textContent = 'メールアドレスまたはパスワードが違います。';
                        } else {
                            loginError.textContent = 'ログインに失敗しました。';
                        }
                        loginError.classList.remove('hidden');
                    });
            });
        }

        App.startApp();
    },
    
    startApp: () => {
        if(AppState.ui.loadingContent) AppState.ui.loadingContent.classList.remove('opacity-0');

        App.initializeFirebase();
        App.initializeDateInputs(document.body);

        NetworkService.init(App);
        document.addEventListener('visibilitychange', App.handleVisibilityChange);

        if (window.innerWidth < 1024) {
            const syncDetails = $('#sync-panel-details');
            const regDetails = $('#registration-panel-details');
            if(syncDetails) syncDetails.removeAttribute('open');
            if(regDetails) regDetails.removeAttribute('open');
        }
        App.setupEventListeners();
        App.checkVersionUpdate();

        setInterval(() => {
            const isModalOpen = !AppState.ui.modalWrapper.classList.contains('hidden');
            
            if (AppState.isLoadComplete && !document.hidden && !isModalOpen) {
                console.log("Auto-syncing...");
                App.loadDataSet(AppState.syncId);
            } else if (isModalOpen) {
                console.log("Auto-sync skipped due to open modal.");
            }
        }, 300000);
    },

    handleVisibilityChange: () => {
        if (document.hidden) {
            AppState.lastHiddenTime = Date.now();
        } else {
            const now = Date.now();
            const hiddenDuration = now - (AppState.lastHiddenTime || now);

            const isModalOpen = !AppState.ui.modalWrapper.classList.contains('hidden');
            
            // 5分以上バックグラウンドにいたら、データ不整合を防ぐため再読み込み
            if (hiddenDuration > 5 * 60 * 1000) {
                
                if (isModalOpen) {
                    console.log("App returned from background, but modal is open. Skipping network reset.");
                    return; 
                }

                console.log("App returned from long background. Reloading data...");
                App.showToast("長時間経過したため、データを最新化します...", "info");
                
                // ★追加: ネットワーク接続のリセットを試みる
                disableNetwork(AppState.db).then(() => {
                    enableNetwork(AppState.db);
                    App.loadDataSet(AppState.syncId);
                }).catch(() => {
                    App.loadDataSet(AppState.syncId);
                });
            } else {
                // 短時間でも念のため画面描画等のズレを直す処理があればここに入れる
            }
        }
    },

    checkVersionUpdate: () => {
        const currentVersion = AppState.appVersion; 
        const lastVersion = localStorage.getItem('last_known_version');

        if (currentVersion && currentVersion !== 'Unknown' && currentVersion !== lastVersion) {
            localStorage.setItem('last_known_version', currentVersion);
            const message = `
                <div class="text-center space-y-4">
                    <div class="text-6xl">🚀</div>
                    <p class="text-lg text-white font-bold">アプリが更新されました！</p>
                    <p class="text-gray-300">バージョン: <span class="text-teal-400 font-mono text-xl font-bold">${currentVersion}</span></p>
                    <div class="bg-gray-700 p-4 rounded-lg text-sm text-left text-gray-300">
                        <p>✅ 動作パフォーマンスの向上 (IndexedDB)</p>
                        <p>✅ 検索精度の向上 (Fuzzy Search)</p>
                    </div>
                </div>
            `;
            setTimeout(() => { App.showConfirm("アップデート完了", message); }, 1500);
        }
    },

    // --- Utility Functions ---
    isMobile: UI.isMobile,
    escapeHTML: Utils.escapeHTML,

    encryptData: (data) => {
        if (!data) return null;
        try { return JSON.stringify(data); } catch (e) { return null; }
    },

    decryptData: (encryptedString) => {
        if (!encryptedString) return null;
        try {
            if (!encryptedString.startsWith('[') && !encryptedString.startsWith('{')) return null;
            return JSON.parse(encryptedString);
        } catch (e) { return null; }
    },

    isValidDate: Utils.isValidDate,
    showToast: UI.showToast,
    showConfirm: UI.showConfirm,
    getSiteBadgeHTML: UI.getSiteBadgeHTML,
    formatDate: Utils.formatDate,

    formatDateForInput: (date) => {
        const d = date instanceof Date ? date : new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    },
    
    debounce: (func, delay) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, delay);
        };
    },

    getTagObjects: (tagIds) => {
        return Array.from(tagIds || []).map(id => AppState.tags.get(id)).filter(Boolean);
    },
    
    // --- UI Helpers ---
    toggleFabMenu: () => {
        const menuContent = document.getElementById('fab-menu-content');
        const backdrop = document.getElementById('fab-backdrop');
        const icon = document.getElementById('fab-icon');
        if (!menuContent) return;
        
        const isClosed = menuContent.classList.contains('hidden');
        if (isClosed) {
            menuContent.classList.remove('hidden');
            backdrop.classList.remove('hidden');
            requestAnimationFrame(() => {
                menuContent.classList.remove('scale-95', 'opacity-0');
                menuContent.classList.add('scale-100', 'opacity-100');
                backdrop.classList.remove('opacity-0');
                backdrop.classList.add('opacity-100');
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times', 'rotate-90');
            });
        } else {
            App.closeFabMenu();
        }
    },
    
    closeFabMenu: () => {
        const menuContent = document.getElementById('fab-menu-content');
        const backdrop = document.getElementById('fab-backdrop');
        const icon = document.getElementById('fab-icon');
        if (!menuContent) return;
        
        menuContent.classList.remove('scale-100', 'opacity-100');
        menuContent.classList.add('scale-95', 'opacity-0');
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('opacity-0');
        icon.classList.remove('fa-times', 'rotate-90');
        icon.classList.add('fa-bars');

        setTimeout(() => {
            menuContent.classList.add('hidden');
            backdrop.classList.add('hidden');
        }, 200);
    },

    toggleBodyScroll: (isLocked) => {
        if (isLocked) {
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh';
        } else {
            document.body.style.overflow = '';
            document.body.style.height = '';
        }
    },

    openModal: (title, contentHtml, onOpen = null, options = {}) => {
        App.closeFabMenu();
        App.toggleBodyScroll(true);
        AppState.checkModalDirtyState = () => false;
        
        const { size = 'max-w-2xl', headerActions = '', autoFocus = true } = options;
        Object.values(AppState.activeCharts).forEach(chart => chart.destroy());
        AppState.activeCharts = {};

        AppState.ui.modalContainer.classList.remove('max-w-2xl', 'max-w-4xl', 'max-w-5xl', 'max-w-7xl');
        AppState.ui.modalContainer.classList.add(size);
        
        $('#modal-header-actions').innerHTML = headerActions;
        AppState.ui.modalTitle.textContent = title;
        AppState.ui.modalContentHost.innerHTML = contentHtml;
        App.initializeDateInputs(AppState.ui.modalContentHost); 
        AppState.ui.modalBackdrop.classList.remove('hidden');
        AppState.ui.modalWrapper.classList.remove('hidden');
        
        if (AppState.ui.slidingFabToggle) AppState.ui.slidingFabToggle.classList.add('hidden');
        
        setTimeout(() => {
            AppState.ui.modalBackdrop.classList.add('opacity-100');
            AppState.ui.modalContainer.classList.remove('scale-95', 'opacity-0');
            if (onOpen) onOpen();
            if (autoFocus) {
                const firstFocusable = AppState.ui.modalContentHost.querySelector('input, select, button');
                if (firstFocusable) setTimeout(() => firstFocusable.focus(), 100);
            }
        }, 10);
    },

    closeModal: async () => {
        if (AppState.checkModalDirtyState()) {
            const confirmed = await App.showConfirm("未保存の変更", "変更が保存されていません。本当に閉じますか？");
            if (!confirmed) return;
        }
        AppState.checkModalDirtyState = () => false;
        if (AppState.modalStateStack.length > 0) {
            const restorePrevious = AppState.modalStateStack.pop();
            restorePrevious();
            return;
        }
        AppState.ui.modalContainer.classList.add('scale-95', 'opacity-0');
        AppState.ui.modalBackdrop.classList.remove('opacity-100');
        if (AppState.ui.slidingFabToggle) AppState.ui.slidingFabToggle.classList.remove('hidden');
        
        setTimeout(() => {
            AppState.ui.modalBackdrop.classList.add('hidden');
            AppState.ui.modalWrapper.classList.add('hidden');
            AppState.ui.modalContentHost.innerHTML = '';
            Object.values(AppState.activeCharts).forEach(chart => chart.destroy());
            AppState.activeCharts = {};
            App.toggleBodyScroll(false);
        }, 300);
    },

    openImageCompareModal: (originalUrl, newUrl) => {
        AppState.ui.compareOriginalImage.src = originalUrl || 'https://placehold.co/300x200/1f2937/4b5563?text=No+Image';
        AppState.ui.compareNewImage.src = newUrl;
        AppState.ui.imageCompareModalBackdrop.classList.add('active');
        AppState.ui.imageCompareModal.classList.add('active');
    },

    closeImageCompareModal: (clearInput = true) => {
        AppState.ui.imageCompareModalBackdrop.classList.remove('active');
        AppState.ui.imageCompareModal.classList.remove('active');
        if (clearInput) {
            AppState.tempNewImageUrl = null;
            const editImageUpload = $('#edit-image-upload');
            if (editImageUpload) editImageUpload.value = '';
        }
    },
    
// src/main.js - Part 2

    // --- Loading Logic ---
    updateLoadingProgress: () => {
        if (AppState.isLoadComplete) return;
        let progress = 10;
        if (AppState.loadingStatus.auth) progress += 20;
        if (AppState.loadingStatus.tags) progress += 35;
        if (AppState.loadingStatus.works) progress += 35;
        AppState.ui.loadingProgressBar.style.width = `${progress}%`;
        AppState.ui.loadingText.textContent = `読み込み中... (${progress}%)`;
    },

    handleLoadingTimeout: (isStall = false) => {
        if (AppState.isLoadComplete) return;
        const errorMessageTitle = isStall ? 'データ取得の停滞' : '読み込みタイムアウト';
        console.error(`Loading failed: ${errorMessageTitle}`);

        clearTimeout(AppState.loadingTimeout);
        clearTimeout(AppState.stallTimeout);
        
        const statusParts = [];
        if (!AppState.loadingStatus.auth) statusParts.push('認証');
        if (!AppState.loadingStatus.tags) statusParts.push('タグ');
        if (!AppState.loadingStatus.works) statusParts.push('作品');

        const errorHtml = `
            <i class="fas fa-exclamation-triangle fa-3x text-red-400"></i>
            <p class="mt-4 text-red-300 font-semibold">${errorMessageTitle}</p>
            <p class="mt-2 text-gray-400 text-sm">${statusParts.length ? `未完了: ${statusParts.join(', ')}` : 'タイムアウト'}</p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg">再読み込み</button>
        `;

        if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
            AppState.ui.loadingContent.innerHTML = errorHtml;
            AppState.ui.loadingContent.classList.remove('opacity-0');
        } else {
            AppState.ui.workListMessage.innerHTML = `<div class="text-center py-10">${errorHtml}</div>`;
            AppState.ui.workListMessage.classList.remove('hidden');
        }
    },
    
    startLoadingTimeout: () => {
        clearTimeout(AppState.loadingTimeout);
        AppState.loadingTimeout = setTimeout(() => App.handleLoadingTimeout(false), 90000);
        setTimeout(() => {
            if (!AppState.isLoadComplete) { 
                 const btn = $('#lite-mode-switch-prod');
                 if (btn) btn.classList.remove('hidden');
            }
        }, 30000);
    },

    handleDataFetchError: (error, type) => {
         if (AppState.isLoadComplete) return;
         if (AppState.isDebugMode) console.error(`Error fetching ${type}:`, error);
         clearTimeout(AppState.loadingTimeout);
         
         const errorHtml = `
            <i class="fas fa-exclamation-triangle fa-3x text-red-400"></i>
            <p class="mt-4 text-red-300 font-semibold">${type}データの取得に失敗</p>
            <p class="mt-2 text-gray-400 text-sm">${error ? App.escapeHTML(error.message) : '不明なエラー'}</p>
            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg">再読み込み</button>
        `;
        
        if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
            AppState.ui.loadingContent.innerHTML = errorHtml;
            AppState.ui.loadingContent.classList.remove('opacity-0');
        } else {
            AppState.ui.workListMessage.innerHTML = `<div class="text-center py-10">${errorHtml}</div>`;
            AppState.ui.workListMessage.classList.remove('hidden');
        }
    },

    checkLoadingComplete: () => {
        if (AppState.isLoadComplete) return;
        
        if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
            App.updateLoadingProgress();
        }
        
        if (AppState.loadingStatus.auth && AppState.loadingStatus.works && AppState.loadingStatus.tags) {
            AppState.isLoadComplete = true;
            clearTimeout(AppState.loadingTimeout);
            clearTimeout(AppState.stallTimeout);
            console.log("All data loaded.");
            
            if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
                AppState.ui.loadingText.textContent = '読み込み完了！';
                AppState.ui.loadingProgressBar.style.width = `100%`;

                setTimeout(() => {
                    AppState.ui.loadingOverlay.classList.add('opacity-0');
                    AppState.ui.appContainer.classList.remove('opacity-0');
                    setTimeout(() => AppState.ui.loadingOverlay.classList.add('hidden'), 500);

                    // ▼▼▼ 修正: 共通関数を呼び出し ▼▼▼
                    App.processPendingFeedback();
                    // ▲▲▲ 修正終了 ▲▲▲

                    if (AppState.isLiteMode) {
                        const banner = $('#lite-mode-banner');
                        if (banner) banner.classList.remove('hidden');
                        App.showToast("Liteモードで起動中", "info", 4000);
                    }
                }, 500);
            }
        }
    },

    processPendingFeedback: () => {
        // 二重表示防止
        if (AppState.hasCheckedPendingFeedback) return;
        AppState.hasCheckedPendingFeedback = true;

        const pendingWorkId = localStorage.getItem('r18_pending_feedback_work_id');
        if (pendingWorkId) {
            const pendingWork = AppState.works.find(w => w.id === pendingWorkId);
            if (pendingWork) {
                // UIの安定を待ってから表示 (少し長めに待機)
                setTimeout(() => {
                    console.log("Restoring pending feedback modal for:", pendingWork.name);
                    App.openFeedbackModal(pendingWork);
                }, 800);
            } else {
                // 作品が見つからない場合はIDを削除
                localStorage.removeItem('r18_pending_feedback_work_id');
            }
        }
    },

    // --- Firebase Setup ---
    initializeFirebase: () => {
        console.log("Using initialized Firebase from config.");
        AppState.auth = auth;
        AppState.db = db;
        AppState.storage = storage;
        
        App.setupAuthObserver();

        try {
            const app = getApp();
            if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
            }
            initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider('6Lem8v8rAAAAAJiur2mblUOHF28x-Vh0zRjg6B6u'),
                isTokenAutoRefreshEnabled: true
            });
            console.log("App Check initialized.");
        } catch (e) {
            console.warn("App Check failed:", e);
        }
    },

    setupAuthObserver: () => {
        onIdTokenChanged(AppState.auth, user => { 
            if (user) {
                AppState.ui.loadingText.textContent = '認証情報を確認中...';
                const loginOverlay = $('#login-overlay');
                if (loginOverlay) loginOverlay.classList.add('hidden');

                if (!AppState.loadingStatus.auth) {
                    AppState.currentUser = user;
                    AppState.loadingStatus.auth = true;

                    App.loadUserSettings();
                    clearTimeout(AppState.stallTimeout);
                    AppState.stallTimeout = setTimeout(() => App.handleLoadingTimeout(true), 15000);
                    App.checkLoadingComplete();
                    App.setupSyncId();
                }
            } else {
                AppState.ui.loadingOverlay.classList.add('hidden'); 
                const loginOverlay = $('#login-overlay');
                if (loginOverlay) loginOverlay.classList.remove('hidden');
            }
        });
    },

    // --- Liteモード移行の確認ダイアログ ---
    promptLiteModeTransition: () => {
        // スヌーズ期間の設定（例：30分 = 30 * 60 * 1000 ミリ秒）
        const SNOOZE_DURATION_MS = 30 * 60 * 1000;
        const snoozeUntil = localStorage.getItem('liteModePromptSnoozeUntil');
        
        // スヌーズ期間中であれば、ダイアログを出さずに処理を終了（元の処理を継続）
        if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
            return; 
        }

        // 既に他のモーダル（評価や編集画面など）が開いている場合は表示しない
        if (!AppState.ui.modalWrapper.classList.contains('hidden')) return;

        // モーダルに表示するHTML
        const contentHtml = `
            <div class="space-y-4 text-gray-200">
                <p>通信速度が低下しているか、読み込みに時間がかかっています。<br>データ通信量を抑え、動作を軽くする「Liteモード」に移行しますか？</p>
                
                <label class="inline-flex items-center cursor-pointer mt-4 bg-gray-700 px-3 py-3 rounded-lg hover:bg-gray-600 transition-colors w-full select-none">
                    <input type="checkbox" id="snooze-lite-prompt" class="form-checkbox h-5 w-5 text-teal-500 rounded border-gray-500 bg-gray-800 focus:ring-teal-500">
                    <span class="ml-3 text-sm text-gray-200 font-medium">今後30分間は再確認しない</span>
                </label>

                <div class="flex justify-end space-x-3 pt-5 border-t border-gray-700 mt-4">
                    <button type="button" id="btn-lite-no" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors font-semibold">そのまま待機</button>
                    <button type="button" id="btn-lite-yes" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors">Liteモードへ移行</button>
                </div>
            </div>
        `;

        App.openModal("Liteモードへの移行確認", contentHtml, () => {
            const snoozeCheckbox = document.getElementById('snooze-lite-prompt');
            
            // 「そのまま待機」を選んだ場合の処理
            document.getElementById('btn-lite-no').addEventListener('click', () => {
                if (snoozeCheckbox.checked) {
                    localStorage.setItem('liteModePromptSnoozeUntil', Date.now() + SNOOZE_DURATION_MS);
                }
                App.closeModal();
            });

            // 「Liteモードへ移行」を選んだ場合の処理
            document.getElementById('btn-lite-yes').addEventListener('click', () => {
                if (snoozeCheckbox.checked) {
                    // 移行後も不要な再確認を防ぐためスヌーズ時間を記録
                    localStorage.setItem('liteModePromptSnoozeUntil', Date.now() + SNOOZE_DURATION_MS);
                }
                localStorage.setItem('isLiteMode', 'true');
                location.reload(); // Liteモードを有効にしてリロード
            });
        }, { size: 'max-w-md' });
    },

    setupSyncId: () => {
        let currentSyncId = localStorage.getItem('r18_sync_id');
        if (!currentSyncId) {
            currentSyncId = App.generateRandomId();
            localStorage.setItem('r18_sync_id', currentSyncId);
        }
        App.loadDataSet(currentSyncId);
        App.updateSyncIdHistory(currentSyncId);
    },
    
    loadUserSettings: () => {
        const savedListFilters = App.decryptData(localStorage.getItem('listFilters_encrypted'));
        if (savedListFilters) {
            savedListFilters.genres = new Set(savedListFilters.genres || []);
            savedListFilters.sites = new Set(savedListFilters.sites || []);
            savedListFilters.andTagIds = new Set(savedListFilters.andTagIds || []);
            savedListFilters.orTagIds = new Set(savedListFilters.orTagIds || []);
            savedListFilters.notTagIds = new Set(savedListFilters.notTagIds || []);
            savedListFilters.dateFilter = savedListFilters.dateFilter || AppState.defaultDateFilter();
            AppState.listFilters = savedListFilters;
        }

        const savedSortState = App.decryptData(localStorage.getItem('sortState_encrypted'));
        if (savedSortState) AppState.sortState = savedSortState;

        const savedLotterySettings = App.decryptData(localStorage.getItem('lotterySettings_encrypted'));
        if (savedLotterySettings) {
            savedLotterySettings.genres = new Set(savedLotterySettings.genres || []);
            savedLotterySettings.sites = new Set(savedLotterySettings.sites || []);
            savedLotterySettings.andTagIds = new Set(savedLotterySettings.andTagIds || []);
            savedLotterySettings.orTagIds = new Set(savedLotterySettings.orTagIds || []);
            savedLotterySettings.notTagIds = new Set(savedLotterySettings.notTagIds || []);
            savedLotterySettings.dateFilter = savedLotterySettings.dateFilter || AppState.defaultDateFilter();
            AppState.lotterySettings = savedLotterySettings;
        }

        const savedHistory = App.decryptData(localStorage.getItem('searchHistory_encrypted'));
        if (Array.isArray(savedHistory)) AppState.searchHistory = savedHistory.slice(0, AppState.maxSearchHistory);

        const savedPresets = App.decryptData(localStorage.getItem('customPresets_encrypted'));
        if (savedPresets && Array.isArray(savedPresets)) {
            AppState.customPresets = savedPresets.map(p => ({
                ...p,
                settings: {
                    ...p.settings,
                    genres: new Set(p.settings.genres || []),
                    sites: new Set(p.settings.sites || []),
                    andTagIds: new Set(p.settings.andTagIds || []),
                    orTagIds: new Set(p.settings.orTagIds || []),
                    notTagIds: new Set(p.settings.notTagIds || [])
                }
            }));
        }
    },

    // --- Data Load Logic (IndexedDB + Firestore) ---

    loadDataSet: async (newSyncId) => {
        // IDが変わっていない、かつ読み込み完了済みなら何もしない
        if (AppState.syncId === newSyncId && AppState.isLoadComplete) {
            console.log("Reloading data for the same Sync ID.");
        } else if (AppState.syncId === newSyncId && !AppState.isLoadComplete) {
            return; 
        }
        
        AppState.syncId = newSyncId;
        AppState.ui.syncIdDisplay.value = AppState.syncId;
        localStorage.setItem('r18_sync_id', AppState.syncId);
        
        if (AppState.unsubscribeWorks) AppState.unsubscribeWorks();
        if (AppState.unsubscribeTags) AppState.unsubscribeTags();

        // UI初期化
        AppState.ui.workListEl.classList.add('hidden');
        AppState.ui.paginationControls.classList.add('hidden');
        AppState.ui.workListMessage.innerHTML = `
            <div class="text-center py-10 text-gray-500">
                <i class="fas fa-spinner fa-spin fa-3x text-teal-400"></i>
                <p class="mt-4 text-base">データを読み込み中...</p>
            </div>`;
        AppState.ui.workListMessage.classList.remove('hidden');

        // ★ ステップ1: IndexedDBから爆速ロード
        try {
            const localData = await DB.loadLocalData();
            
            if (localData.works.length > 0) {
                console.log(`Loaded ${localData.works.length} works from Local DB.`);
                AppState.works = localData.works;
                AppState.tags = localData.tags;

                App.fixWorkDates();
                
                // インデックス作成 & 描画
                Search.initSearchIndex(AppState.works);
                AppState.isLoadComplete = true;
                AppState.loadingStatus.works = true;
                AppState.loadingStatus.tags = true;
                
                App.renderAll();
                
                // ★★★ 修正ポイント: ここでメイン画面を表示（透明化解除）します ★★★
                AppState.ui.loadingOverlay.classList.add('hidden');
                AppState.ui.appContainer.classList.remove('opacity-0'); 

                // ▼▼▼ 追加: 高速ロード時も評価待ちチェックを実行 ▼▼▼
                App.processPendingFeedback();
                // ▲▲▲ 追加終了 ▲▲▲
            }
        } catch (e) {
            console.warn("Local load failed:", e);
        }

        // ★ ステップ2: サーバー同期 (バックグラウンド)
        // 修正後: Liteモード時は重い同期通信をスキップする
        if (AppState.currentUser && !AppState.isDebugMode) {
            if (AppState.isLiteMode) {
                console.log("Lite mode is active. Skipping server sync.");
                // 既にローカルデータのロードで画面は表示されているため、ここで終了します
                return; 
            }
            // もしローカルデータがなくて画面がまだ真っ白なら、トーストではなくローディング表示を維持
            if (AppState.works.length > 0) {
                App.showToast("サーバーと同期中...", "info", 2000);
            }
            
            try {
                const syncedData = await DB.syncWithFirestore();
                
                if (syncedData) {
                    console.log("Sync complete. Updating UI.");
                    AppState.works = syncedData.works;
                    AppState.tags = syncedData.tags;
                    
                    Search.initSearchIndex(AppState.works);
                    AppState.isLoadComplete = true;
                    AppState.loadingStatus.works = true;
                    AppState.loadingStatus.tags = true;
                    
                    App.renderAll();
                    
                    // 同期完了時にも確実に画面を表示
                    AppState.ui.loadingOverlay.classList.add('hidden');
                    AppState.ui.appContainer.classList.remove('opacity-0');

                    // ▼▼▼ 追加: 同期完了時も評価待ちチェックを実行 (ローカルロードが失敗していた場合のため) ▼▼▼
                    App.processPendingFeedback();
                    // ▲▲▲ 追加終了 ▲▲▲
                    
                    App.showToast("データを最新の状態に更新しました");
                }
            } catch (error) {
                console.error("Sync failed:", error);
                if (AppState.works.length === 0) {
                    App.handleDataFetchError(error, '同期');
                } else {
                    App.showToast("同期に失敗しました。", "warning");
                }
            }
        } else if (!AppState.works.length) {
            // 未ログインでローカルデータもない場合（初回など）
            // ここで loadingOverlay を消さないと詰む可能性があるためチェック
            if (AppState.isLoadComplete) {
                    AppState.ui.loadingOverlay.classList.add('hidden');
                    AppState.ui.appContainer.classList.remove('opacity-0');
            }
        }
    },

    fixWorkDates: () => {
        AppState.works.forEach(work => {
            // registeredAt が壊れている(プレーンなオブジェクトになっている)場合を検知して修復
            if (work.registeredAt && typeof work.registeredAt.toDate !== 'function') {
                // Firestore Timestamp形式 (seconds, nanoseconds) の場合
                if (work.registeredAt.seconds) {
                    work.registeredAt = new Timestamp(work.registeredAt.seconds, work.registeredAt.nanoseconds);
                } else if (work.registeredAt instanceof Date) {
                    work.registeredAt = Timestamp.fromDate(work.registeredAt);
                } else if (typeof work.registeredAt === 'string') {
                    work.registeredAt = Timestamp.fromDate(new Date(work.registeredAt));
                }
            }
            
            // lastSelectedAt も同様に修復
            if (work.lastSelectedAt && typeof work.lastSelectedAt.toDate !== 'function') {
                if (work.lastSelectedAt.seconds) {
                    work.lastSelectedAt = new Timestamp(work.lastSelectedAt.seconds, work.lastSelectedAt.nanoseconds);
                } else {
                    work.lastSelectedAt = null;
                }
            }
        });
    },

    updateSyncIdHistory: (newId) => {
        let history = JSON.parse(localStorage.getItem('r18_sync_id_history') || '[]');
        if (newId && !history.includes(newId)) {
            history.unshift(newId);
            history = history.slice(0, 10);
            localStorage.setItem('r18_sync_id_history', JSON.stringify(history));
        }
        App.renderSyncIdHistory();
    },

    renderSyncIdHistory: () => {
        const history = JSON.parse(localStorage.getItem('r18_sync_id_history') || '[]');
        AppState.ui.syncIdHistoryEl.innerHTML = '<option value="">履歴から選択...</option>' + 
            history.map(id => `<option value="${id}">${id}</option>`).join('');
    },
    
    generateRandomId: (length = 16) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    },

    processImage: Utils.processImage,

    fetchLinkPreview: async (url, containerElement) => {
        if (!url || typeof url !== 'string') return;
        const trimmedUrl = url.trim();
        if (!trimmedUrl.startsWith('http') || trimmedUrl.length < 8) {
            containerElement.innerHTML = '';
            containerElement.classList.add('hidden');
            return;
        }
        containerElement.innerHTML = `<div class="text-xs text-gray-400 animate-pulse py-2"><i class="fas fa-spinner fa-spin mr-2"></i>リンク情報を取得中...</div>`;
        containerElement.classList.remove('hidden');

        try {
            const getPreview = httpsCallable(functions, 'getLinkPreview');
            const result = await getPreview({ url: trimmedUrl });
            const data = result.data.data;

            if (!result.data.success || !data) {
                containerElement.innerHTML = '';
                containerElement.classList.add('hidden');
                return;
            }

            const html = `
                <div class="mt-2 bg-gray-800 border-l-4 border-red-600 rounded-r shadow-md overflow-hidden max-w-full">
                    <div class="p-3">
                        <div class="text-xs text-gray-400 mb-1">${App.escapeHTML(data.siteName)}</div>
                        <a href="${App.escapeHTML(data.url)}" target="_blank" rel="noopener" class="block font-bold text-blue-400 hover:underline text-sm mb-2 truncate">${App.escapeHTML(data.title)}</a>
                        <div class="flex gap-3">
                            ${data.image ? `<div class="flex-shrink-0 w-24 h-16 bg-black rounded overflow-hidden"><img src="${App.escapeHTML(data.image)}" class="w-full h-full object-cover"></div>` : ''}
                            <div class="flex-grow min-w-0"><p class="text-xs text-gray-300 line-clamp-3">${App.escapeHTML(data.description)}</p></div>
                        </div>
                    </div>
                </div>`;
            containerElement.innerHTML = html;

            const batchNameInput = $('#batchWorkName');
            if (batchNameInput && !batchNameInput.value && data.title) {
                batchNameInput.value = data.title;
                batchNameInput.dispatchEvent(new Event('input'));
                App.showToast('タイトルを自動入力しました。');
            }
        } catch (error) {
            console.warn("Link Preview skipped:", error.message);
            containerElement.innerHTML = '';
            containerElement.classList.add('hidden');
        }
    },

    uploadImageToStorage: Actions.uploadImageToStorage,
    handleAddWork: Actions.handleAddWork,
    updateWork: Actions.updateWork,
    deleteWork: Actions.deleteWork,
    addTag: Actions.addTag,
    deleteTag: Actions.deleteTag,

    handleDeleteAllData: async () => {
         if (AppState.isDebugMode) return App.showToast('デバッグモード中は全削除できません。');
         AppState.ui.loadingOverlay.classList.remove('hidden');
         AppState.ui.loadingOverlay.classList.remove('opacity-0');
         AppState.ui.loadingText.textContent = "データを削除しています...";
         AppState.ui.loadingProgressBar.style.width = '100%';

         setTimeout(async () => {
             try {
                const batch = writeBatch(AppState.db);
                const worksRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
                const worksSnapshot = await getDocs(worksRef);
                worksSnapshot.forEach(doc => batch.delete(doc.ref));
                
                const tagsRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`);
                const tagsSnapshot = await getDocs(tagsRef);
                tagsSnapshot.forEach(doc => batch.delete(doc.ref));

                await batch.commit();
                
                // Clear Local DB
                await DB.db.works.clear();
                await DB.db.tags.clear();

                AppState.ui.loadingOverlay.classList.add('hidden');
                App.showToast("全てのデータを削除しました。");
                AppState.works = [];
                AppState.tags = new Map();
                App.renderAll();
            } catch(error) { 
                AppState.ui.loadingOverlay.classList.add('hidden');
                console.error("Error deleting all data:", error);
                App.showToast("データ削除中にエラーが発生しました。"); 
            }
         }, 100);
    },

    saveShowSiteIcon: (value) => {
        AppState.showSiteIcon = value;
        localStorage.setItem('showSiteIcon', value);
    },

    renderAll: () => {
        App.renderWorkList();
        App.renderActiveFilters();
        App.renderLotterySummary();
    },

    getWorkSite: (url) => {
        if (!url) return 'other';
        if (url.includes('dlsite.com')) return 'dlsite';
        if (url.includes('dmm.co.jp') || url.includes('dmm.com')) return 'fanza';
        return 'other';
    },

    renderWorkList: () => {
        const { ui, isLoadComplete, isDebugMode, works, listViewMode, currentPage, itemsPerPage } = AppState;
        if (!ui.workListEl) return;
        if (!isLoadComplete && !isDebugMode) return;

        const filteredWorks = App.getFilteredAndSortedWorks();
        const totalItems = filteredWorks.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

        if (currentPage > totalPages) AppState.currentPage = totalPages;
        const startIndex = (AppState.currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const worksToShow = filteredWorks.slice(startIndex, endIndex);

        ui.workCountEl.textContent = `${totalItems} / ${works.length} 作品`;

        ui.viewGridBtn.classList.toggle('view-btn-active', listViewMode === 'grid');
        ui.viewListBtn.classList.toggle('view-btn-active', listViewMode === 'list');
        const isGrid = listViewMode === 'grid';
        ui.workListEl.className = isGrid 
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-100 transition-opacity duration-200' 
            : 'space-y-2 opacity-100 transition-opacity duration-200';

        if (works.length === 0) {
            ui.workListMessage.innerHTML = `<div class="text-center py-10 text-gray-500"><i class="fas fa-ghost fa-3x"></i><p class="mt-4">まだ作品が登録されていません。</p></div>`;
            ui.workListMessage.classList.remove('hidden');
            ui.workListEl.classList.add('hidden');
            return;
        }
        if (filteredWorks.length === 0) {
            ui.workListMessage.innerHTML = `<div class="text-center py-10 text-gray-500"><i class="fas fa-search-minus fa-3x"></i><p class="mt-4">条件に一致する作品がありません。</p></div>`;
            ui.workListMessage.classList.remove('hidden');
            ui.workListEl.classList.add('hidden');
            return;
        }

        ui.workListMessage.classList.add('hidden');
        ui.workListEl.classList.remove('hidden');

        // Lit-html render
        const template = html`${worksToShow.map(work => isGrid ? UI.renderWorkCard(work) : UI.renderWorkListItem(work))}`;
        render(template, ui.workListEl);

        const topPagination = $('#pagination-controls-top');
        const bottomPagination = $('#pagination-controls');
        if (topPagination) topPagination.classList.remove('hidden');
        if (bottomPagination) bottomPagination.classList.remove('hidden');

        const updatePaginationUI = (container) => {
            if (!container) return;
            container.querySelector('.pageInfo').textContent = `ページ ${AppState.currentPage} / ${totalPages}`;
            container.querySelector('.prevPageBtn').disabled = AppState.currentPage === 1;
            container.querySelector('.nextPageBtn').disabled = AppState.currentPage === totalPages;
            container.querySelector('.itemsPerPageSelect').value = itemsPerPage;
        };
        updatePaginationUI(topPagination);
        updatePaginationUI(bottomPagination);
    },
    
    getContrastColor: (hex) => {
        if (!hex) return '#FFFFFF';
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#FFFFFF';
    },

// src/main.js - Part 3

    getFilteredWorks: (filters, sourceWorks = AppState.works) => {
        let tempWorks = [...sourceWorks];
        if (filters.unratedOrUntaggedOnly) {
            tempWorks = tempWorks.filter(w => (w.rating || 0) === 0 || !w.tagIds || w.tagIds.length === 0);
        } else if (filters.mood) { 
            if (filters.mood === 'best') tempWorks = tempWorks.filter(w => (w.rating || 0) >= 4);
            if (filters.mood === 'hidden_gem') tempWorks = tempWorks.filter(w => (w.rating || 0) <= 2);
        } else if (filters.rating && filters.rating.value > 0) {
            if (filters.rating.type === 'exact') tempWorks = tempWorks.filter(w => (w.rating || 0) === filters.rating.value);
            else if (filters.rating.type === 'above') tempWorks = tempWorks.filter(w => (w.rating || 0) >= filters.rating.value);
            else if (filters.rating.type === 'below') tempWorks = tempWorks.filter(w => (w.rating || 0) <= filters.rating.value);
        }
        if (filters.genres && filters.genres.size > 0) tempWorks = tempWorks.filter(w => filters.genres.has(w.genre));
        if (filters.sites && filters.sites.size > 0) {
            tempWorks = tempWorks.filter(w => filters.sites.has(App.getWorkSite(w.sourceUrl)));
        }
        if (filters.dateFilter) {
            const { mode, date, startDate, endDate } = filters.dateFilter;
            if (mode === 'specific' && date && App.isValidDate(date)) {
                const start = new Date(date); start.setHours(0,0,0,0);
                const end = new Date(date); end.setHours(23,59,59,999);
                tempWorks = tempWorks.filter(w => w.registeredAt && w.registeredAt.toDate() >= start && w.registeredAt.toDate() <= end);
            } else if (mode === 'range' && startDate && endDate && App.isValidDate(startDate) && App.isValidDate(endDate)) {
                 const start = new Date(startDate); start.setHours(0,0,0,0);
                 const end = new Date(endDate); end.setHours(23,59,59,999);
                 tempWorks = tempWorks.filter(w => w.registeredAt && w.registeredAt.toDate() >= start && w.registeredAt.toDate() <= end);
            }
        }
        const andTags = filters.andTagIds || new Set();
        if (andTags && andTags.size > 0) tempWorks = tempWorks.filter(w => w.tagIds && [...andTags].every(tid => w.tagIds.includes(tid)));
        if (filters.orTagIds && filters.orTagIds.size > 0) tempWorks = tempWorks.filter(w => w.tagIds && [...filters.orTagIds].some(tid => w.tagIds.includes(tid)));
        if (filters.notTagIds && filters.notTagIds.size > 0) tempWorks = tempWorks.filter(w => !w.tagIds || ![...filters.notTagIds].some(tid => w.tagIds.includes(tid)));
        return tempWorks;
    },
    
    getFilteredAndSortedWorks: () => {
        let tempWorks;
        if (AppState.searchQuery) {
            tempWorks = Search.searchWorks(AppState.searchQuery);
        } else {
            tempWorks = [...AppState.works];
        }
        tempWorks = App.getFilteredWorks(AppState.listFilters, tempWorks);

        return tempWorks.sort((a, b) => {
            const order = AppState.sortState.order === 'asc' ? 1 : -1;
            const by = AppState.sortState.by;

            if (by === 'name' || by === 'genre') {
                return (a[by] || '').localeCompare(b[by] || '', 'ja') * order;
            }
            
            let valA, valB;
            if (by === 'registeredAt' || by === 'lastSelectedAt') {
                const getTime = (val) => {
                    if (!val) return 0;
                    if (typeof val.toMillis === 'function') return val.toMillis();
                    if (val instanceof Date) return val.getTime();
                    return new Date(val).getTime();
                };
                valA = getTime(a[by]);
                valB = getTime(b[by]);
                if (valA === 0 || isNaN(valA)) valA = (order === 1 ? Infinity : -Infinity);
                if (valB === 0 || isNaN(valB)) valB = (order === 1 ? Infinity : -Infinity);
            } else {
                valA = a[by] || 0;
                valB = b[by] || 0;
            }
            return (valA - valB) * order;
        });
    },

    renderActiveFilters: () => {
        const { listFilters, tags } = AppState;
        const filters = [];
        listFilters.genres.forEach(g => filters.push({type: 'genre', value: g, label: `ジャンル: ${g}`}));
        if (listFilters.unratedOrUntaggedOnly) filters.push({type: 'unrated', label: '未評価/未タグ'});
        else if (listFilters.rating.value > 0) filters.push({type: 'rating', label: `評価: ${'★'.repeat(listFilters.rating.value)}${listFilters.rating.type === 'above' ? '以上' : ''}`});

        const addTagFilters = (tagIds, prefix, type) => {
            tagIds.forEach(tId => {
                const tag = tags.get(tId);
                if (tag) filters.push({type: type, value: tId, label: `${prefix}: ${App.escapeHTML(tag.name)}`});
            });
        };
        addTagFilters(listFilters.andTagIds, 'AND', 'andTag');
        addTagFilters(listFilters.orTagIds, 'OR', 'orTag');
        addTagFilters(listFilters.notTagIds, 'NOT', 'notTag');

        const { mode, date, startDate, endDate } = listFilters.dateFilter;
        if (mode === 'specific' && date) filters.push({type: 'date', label: `登録日: ${date}`});
        if (mode === 'range' && startDate && endDate) filters.push({type: 'date', label: `期間: ${startDate} ~ ${endDate}`});

        AppState.ui.activeFiltersEl.innerHTML = (filters.length === 0)
            ? `<span class="text-sm text-gray-400">絞り込み: なし</span>`
            : `<span class="text-sm text-gray-400 mr-2">絞り込み:</span>` + filters.map(f => `
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-600 text-gray-100">
                    ${f.label} <button data-action="remove-filter" data-type="${f.type}" data-value="${f.value || ''}" class="ml-1.5 hover:text-white"><i class="fas fa-times-circle"></i></button>
                </span>`).join('');
    },
    
    renderLotterySummary: () => {
         const { mood, genres, andTagIds, orTagIds, notTagIds, dateFilter, priority, method, unratedOrUntaggedOnly } = AppState.lotterySettings;
         const moodMap = { default: '問わない', favorite: 'お気に入り', best: '最高評価', hidden_gem: '隠れた名作' };
         const priorityMap = { new: '新しい順', old: '古い順', random: 'ランダム' };
         const summaryParts = [];

        if (unratedOrUntaggedOnly) summaryParts.push('未評価/未タグ付のみ');
        else summaryParts.push(`気分: ${moodMap[mood]}`);
         if (genres.size > 0) summaryParts.push(`ジャンル: ${[...genres].join(', ')}`);
         if (andTagIds.size > 0) summaryParts.push(`タグ(AND): ${andTagIds.size}件`);
         if (orTagIds.size > 0) summaryParts.push(`タグ(OR): ${orTagIds.size}件`);
         if (notTagIds.size > 0) summaryParts.push(`タグ(NOT): ${notTagIds.size}件`);
         if (dateFilter.mode === 'specific' && dateFilter.date) summaryParts.push(`登録日: ${dateFilter.date}`);
         if (dateFilter.mode === 'range' && dateFilter.startDate && dateFilter.endDate) summaryParts.push(`期間: ${dateFilter.startDate} ~ ${dateFilter.endDate}`);
         summaryParts.push(`優先度: ${priorityMap[priority]}`);

         AppState.ui.lotterySummaryEl.innerHTML = (mood === 'default' && genres.size === 0 && andTagIds.size === 0 && !unratedOrUntaggedOnly)
             ? `<p class="text-gray-400">設定を開いて条件を選択してください。</p>`
             : summaryParts.map(s => `<span class="inline-block bg-gray-600 px-2 py-1 rounded text-xs mr-1 mb-1">${s}</span>`).join('');
    },

    openSearchWindow: (site, query) => {
        let url;
        const encodedQuery = encodeURIComponent(query);
        switch(site) {
            case 'dlsite': url = query ? `https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category%5B0%5D/male/keyword/${encodedQuery}/` : 'https://www.dlsite.com/maniax/'; break;
            case 'fanza': url = query ? `https://www.dmm.co.jp/dc/doujin/-/list/narrow/=/word=${encodedQuery}/` : 'https://www.dmm.co.jp/dc/doujin/'; break;
            case 'melonbooks': url = query ? `https://www.melonbooks.co.jp/search/search.php?name=${encodedQuery}&search_target=2` : 'https://www.melonbooks.co.jp/'; break;
            case 'booth': url = query ? `https://booth.pm/ja/search/${encodedQuery}` : 'https://booth.pm/'; break;
        }
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },
    
    normalizeString: (str) => {
        if (!str) return '';
        return str.toLowerCase().normalize('NFKC')
            .replace(/[\u3041-\u3096]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60))
            .replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, ' ').replace(/[〇*]/g, '.').trim();
    },

    setupInputClearButton: (inputEl, buttonEl) => {
        if (!inputEl || !buttonEl) return;
        const update = () => buttonEl.classList.toggle('hidden', inputEl.value.length === 0);
        inputEl.addEventListener('input', update);
        buttonEl.addEventListener('click', (e) => {
            e.stopPropagation();
            inputEl.value = '';
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            update();
            inputEl.focus();
        });
        update();
    },

    updateSearchHistory: (query) => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) return;
        AppState.searchHistory = AppState.searchHistory.filter(item => item !== normalizedQuery);
        AppState.searchHistory.unshift(normalizedQuery);
        if (AppState.searchHistory.length > AppState.maxSearchHistory) AppState.searchHistory.pop();
        const encryptedHistory = App.encryptData(AppState.searchHistory);
        if (encryptedHistory) localStorage.setItem('searchHistory_encrypted', encryptedHistory);
    },

    renderSearchHistory: () => {
        const box = $('#search-suggest-box');
        if (!box) return;
        box.innerHTML = (AppState.searchHistory.length === 0)
            ? `<div class="px-4 py-2 text-sm text-gray-400">検索履歴はありません</div>`
            : `<div class="px-4 pt-2 pb-1 flex justify-between items-center"><span class="text-xs font-semibold text-gray-400">検索履歴</span><button data-action="clear-history" class="text-xs hover:text-white">すべて削除</button></div>` + 
              AppState.searchHistory.map(item => `<div class="w-full flex justify-between items-center px-4 py-2 text-sm hover:bg-gray-500 group"><button data-action="select-history" data-query="${App.escapeHTML(item)}" class="flex-grow text-left truncate">${App.escapeHTML(item)}</button><button data-action="delete-history" data-query="${App.escapeHTML(item)}" class="opacity-0 group-hover:opacity-100 hover:text-white"><i class="fas fa-times"></i></button></div>`).join('');
        box.classList.remove('hidden');
        AppState.isSuggestBoxOpen = true;
    },

    renderSuggestions: (query) => {
        const box = $('#search-suggest-box');
        if (!box || !query) { App.closeSuggestBox(); return; }
        const normalizedQuery = App.normalizeString(query);
        if (!normalizedQuery) { App.closeSuggestBox(); return; }

        const suggestions = [];
        const added = new Set();

        AppState.works.forEach(work => {
            const nName = App.normalizeString(work.name);
            if (nName.includes(normalizedQuery) && !added.has(work.name)) {
                suggestions.push({ type: '作品名', value: work.name });
                added.add(work.name);
            }
        });
        AppState.tags.forEach(tag => {
            const nTag = App.normalizeString(tag.name);
            if (nTag.includes(normalizedQuery) && !added.has(tag.name)) {
                suggestions.push({ type: 'タグ', value: tag.name });
                added.add(tag.name);
            }
        });

        if (suggestions.length === 0) box.innerHTML = `<div class="px-4 py-2 text-sm text-gray-400">候補が見つかりません</div>`;
        else box.innerHTML = suggestions.slice(0, 10).map(item => `<button data-query="${App.escapeHTML(item.value)}" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-500 block">${App.escapeHTML(item.value)} <span class="text-xs text-gray-400">(${item.type})</span></button>`).join('');
        box.classList.remove('hidden');
        AppState.isSuggestBoxOpen = true;
    },

    closeSuggestBox: () => {
        const box = $('#search-suggest-box');
        if (box) box.classList.add('hidden');
        AppState.isSuggestBoxOpen = false;
    },

    performSearch: (query) => {
        AppState.searchQuery = query.trim();
        App.updateSearchHistory(AppState.searchQuery);
        AppState.currentPage = 1;
        App.renderWorkList();
        App.closeSuggestBox();
        if (AppState.ui.searchInput.value !== AppState.searchQuery) AppState.ui.searchInput.value = AppState.searchQuery;
    },

    setupEventListeners: () => {
        setupAppEventListeners(App);
        if (AppState.ui && AppState.ui.searchInput) App.setupInputClearButton(AppState.ui.searchInput, $('#clearSearchBtn'));
        
        if (AppState.ui.reloadWorksBtn) {
            AppState.ui.reloadWorksBtn.addEventListener('click', async () => {
                const icon = AppState.ui.reloadWorksBtn.querySelector('i');
                
                // アイコンを回す (CSSクラス追加)
                if(icon) icon.classList.add('fa-spin');
                
                // データを再読み込み (同期)
                await App.loadDataSet(AppState.syncId);
                
                // 読み込み終わったら回転を止める
                if(icon) setTimeout(() => icon.classList.remove('fa-spin'), 1000);
            });
        }

        document.addEventListener('keydown', (e) => {
            const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
            const isModalOpen = !AppState.ui.modalWrapper.classList.contains('hidden');
            if (e.key === 'Escape') {
                if (isModalOpen) App.closeModal();
                else if (AppState.ui.slidingFabContainer && !AppState.ui.slidingFabContainer.classList.contains('hidden')) App.closeFabMenu();
                return;
            }
            if (isInputActive || isModalOpen) return;
            switch(e.key.toLowerCase()) {
                case 'f': e.preventDefault(); AppState.ui.searchInput.focus(); break;
                case 'l': e.preventDefault(); $('#startLotteryBtn')?.click(); break;
                case 'r': e.preventDefault(); App.loadDataSet(AppState.syncId); break;
            }
        
        });

        
    },

    openExternalSearchModal: Modals.openExternalSearchModal,
    openHistoryModal: Modals.openHistoryModal,
    openEditModal: Modals.openEditModal,

    // ★修正: buildエラーを避けるため、modals.jsにないこの関数はここで直接定義する
    openFilterModal: (tempState = null) => {
        const source = tempState || AppState.listFilters;
        const state = {
            ...source,
            genres: new Set(source.genres),
            sites: new Set(source.sites),
            andTagIds: new Set(source.andTagIds),
            orTagIds: new Set(source.orTagIds),
            notTagIds: new Set(source.notTagIds),
            dateFilter: { ...(source.dateFilter || AppState.defaultDateFilter()) },
            rating: { ...(source.rating || { type: 'exact', value: 0 }) }
        };
        
        if (!state.dateFilter.date) state.dateFilter.date = App.formatDateForInput(new Date());
        if (!state.dateFilter.startDate) state.dateFilter.startDate = App.formatDateForInput(new Date());
        if (!state.dateFilter.endDate) state.dateFilter.endDate = App.formatDateForInput(new Date());

        const genreOptions = [{value:'漫画', label:'漫画'}, {value:'ゲーム', label:'ゲーム'}, {value:'動画', label:'動画'}];
        const siteOptions = [{value:'dlsite', label:'DLsite'}, {value:'fanza', label:'FANZA'}, {value:'other', label:'その他'}];

        const content = `
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-semibold mb-2 text-sm text-gray-400">ジャンル</h4>
                    ${App.createCheckboxGroupHTML('filter-genre', genreOptions, state.genres)}
                </div>
                <div>
                    <h4 class="font-semibold mb-2 text-sm text-gray-400">サイト</h4>
                    ${App.createCheckboxGroupHTML('filter-site', siteOptions, state.sites)}
                </div>
            </div>
            <div>
                <div class="flex items-center mb-2">
                     <input type="checkbox" id="filter-unrated" class="h-4 w-4 rounded bg-gray-600 text-sky-500 border-gray-500 focus:ring-sky-600" ${state.unratedOrUntaggedOnly ? 'checked' : ''}>
                     <label for="filter-unrated" class="ml-2 text-sm font-medium">未評価またはタグ未設定の作品のみ</label>
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-2 text-sm text-gray-400">評価 (★)</h4>
                <div class="flex items-center space-x-4 mb-2">
                    <select id="filter-rating-type" class="bg-gray-700 p-2 rounded-lg" ${state.unratedOrUntaggedOnly ? 'disabled' : ''}>
                        <option value="exact" ${state.rating.type === 'exact' ? 'selected' : ''}>と等しい</option>
                        <option value="above" ${state.rating.type === 'above' ? 'selected' : ''}>以上</option>
                        <option value="below" ${state.rating.type === 'below' ? 'selected' : ''}>以下</option>
                    </select>
                    <div id="filter-rating-stars" class="flex items-center space-x-2 text-3xl ${state.unratedOrUntaggedOnly ? 'opacity-50 pointer-events-none' : ''}"></div>
                </div>
            </div>
            <div><h4 class="text-sm text-gray-400 mb-1">登録日で絞り込む</h4>${App.createDateFilterHTML('filter', state.dateFilter, true)}</div>
            <div>
                <h4 class="font-semibold mb-1">タグ絞り込み</h4>
                <div id="filter-tags-display" class="flex flex-wrap gap-2 p-2 bg-gray-900 rounded-lg min-h-[40px] mb-2"></div>
                <button type="button" id="filter-select-tags" class="w-full text-sm p-2 bg-gray-600 hover:bg-gray-700 rounded-lg">タグの条件を選択</button>
            </div>
            <div class="pt-4 flex justify-between gap-3 flex-wrap sm:flex-nowrap">
                <button type="button" id="filter-settings-reset" class="w-full sm:w-auto px-4 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-700 text-gray-100">リセット</button>
                <div class="flex space-x-3 w-full sm:w-auto">
                    <button type="button" id="filter-settings-cancel" class="flex-1 sm:flex-none px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button>
                    <button type="button" id="filter-settings-save" class="flex-1 sm:flex-none px-6 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-700 text-white">適用</button>
                </div>
            </div>
        </div>`;

        App.openModal("作品リストの絞り込み", content, () => {
            let tempAndTags = new Set(state.andTagIds);
            let tempOrTags = new Set(state.orTagIds);
            let tempNotTags = new Set(state.notTagIds);
            let currentRating = state.rating.value;
            const ratingStars = $('#filter-rating-stars');
            const ratingTypeSelect = $('#filter-rating-type');
            const unratedToggle = $('#filter-unrated');

            const getSelectedSet = (name) => {
                const checked = [];
                $$(`input[name="${name}"]:checked`).forEach(cb => checked.push(cb.value));
                return new Set(checked);
            };

            const updatePreview = () => {
                const countEl = $('#date-filter-preview-count-filter'), gridEl = $('#date-filter-preview-grid-filter');
                if (!countEl || !gridEl) return;
                const filters = {
                    unratedOrUntaggedOnly: unratedToggle.checked,
                    rating: { type: ratingTypeSelect.value, value: currentRating },
                    genres: getSelectedSet('filter-genre'),
                    sites: getSelectedSet('filter-site'),
                    andTagIds: tempAndTags, orTagIds: tempOrTags, notTagIds: tempNotTags,
                    dateFilter: {
                        mode: $(`input[name="date-filter-mode-filter"]:checked`).value,
                        date: App.getDateInputValue('date-filter-specific-date-filter'),
                        startDate: App.getDateInputValue('date-filter-start-date-filter'),
                        endDate: App.getDateInputValue('date-filter-end-date-filter')
                    }
                };
                const filtered = App.getFilteredWorks(filters);
                countEl.textContent = `対象: ${filtered.length} 作品`;
                gridEl.innerHTML = filtered.slice(0, 50).map(w => `<div class="text-center"><img src="${w.imageUrl||'https://placehold.co/100x100/1f2937/4b5563?text=?'}" alt="${App.escapeHTML(w.name)}" class="w-full h-16 object-cover rounded-md"><p class="text-xs truncate mt-1">${App.escapeHTML(w.name)}</p></div>`).join('');
            };

            App.setupDateFilterEventListeners('filter', updatePreview);
            $$('input[name="filter-genre"], input[name="filter-site"]').forEach(cb => cb.addEventListener('change', updatePreview));
            unratedToggle.addEventListener('change', () => {
                const isDisabled = unratedToggle.checked;
                ratingStars.classList.toggle('opacity-50', isDisabled);
                ratingStars.classList.toggle('pointer-events-none', isDisabled);
                ratingTypeSelect.disabled = isDisabled;
                updatePreview();
            });
            ratingTypeSelect.addEventListener('change', updatePreview);
            
            const renderStars = r => {
                if (!ratingStars) return;
                ratingStars.innerHTML = '';
                for (let i = 1; i <= 5; i++) {
                    const s = document.createElement('i');
                    s.classList.add('fa-star', 'cursor-pointer');
                    s.dataset.value = i;
                    if (r >= i) s.classList.add('fas', 'text-yellow-400');
                    else if (r === (i - 0.5)) s.classList.add('fas', 'fa-star-half-alt', 'text-yellow-400');
                    else s.classList.add('far', 'text-gray-500');
                    ratingStars.appendChild(s);
                }
            };
            renderStars(currentRating);
            ratingStars.addEventListener('click', e => {
                const s = e.target.closest('.fa-star');
                if(s){
                    const v=parseInt(s.dataset.value,10), h=(e.clientX-s.getBoundingClientRect().left)>(s.getBoundingClientRect().width/2);
                    let n=h?v:v-0.5; if(currentRating===n)n=0; currentRating=n; renderStars(currentRating); updatePreview();
                }
            });

            const renderCombinedTags = () => {
                const container = $('#filter-tags-display');
                if (!container) return;
                let html = '';
                const renderSet = (ids, className, prefix) => { [...ids].map(id => AppState.tags.get(id)).filter(Boolean).forEach(tag => { html += `<span class="px-2 py-1 rounded text-xs font-semibold ${className}">${prefix}: ${App.escapeHTML(tag.name)}</span>`; }); };
                renderSet(tempAndTags, 'tag-item-and text-white', 'AND');
                renderSet(tempOrTags, 'tag-item-or text-white', 'OR');
                renderSet(tempNotTags, 'tag-item-not text-white', 'NOT');
                container.innerHTML = html || `<span class="text-xs text-gray-500">タグ未選択</span>`;
            };
            renderCombinedTags();

            $('#filter-select-tags').addEventListener('click', () => {
                const capturedState = {
                    genres: getSelectedSet('filter-genre'),
                    sites: getSelectedSet('filter-site'),
                    rating: { type: ratingTypeSelect.value, value: currentRating },
                    andTagIds: tempAndTags, orTagIds: tempOrTags, notTagIds: tempNotTags,
                    unratedOrUntaggedOnly: unratedToggle.checked,
                    dateFilter: { mode: $(`input[name="date-filter-mode-filter"]:checked`).value, date: App.getDateInputValue(`date-filter-specific-date-filter`), startDate: App.getDateInputValue(`date-filter-start-date-filter`), endDate: App.getDateInputValue(`date-filter-end-date-filter`) }
                };

                AppState.modalStateStack.push(() => App.openFilterModal(capturedState));

                App.openTagFilterModal({
                    and: tempAndTags, or: tempOrTags, not: tempNotTags,
                    onConfirm: (newTags) => {
                        if(newTags) { 
                            // 戻ってきたときに使うデータを更新
                            capturedState.andTagIds = newTags.and; 
                            capturedState.orTagIds = newTags.or; 
                            capturedState.notTagIds = newTags.not;
                            
                            // スタックの関数を、新しいstateを持つものに置き換え（強引だが確実）
                            AppState.modalStateStack.pop(); 
                            AppState.modalStateStack.push(() => App.openFilterModal(capturedState));
                        }
                    }
                });
            });

            $('#filter-settings-reset').addEventListener('click', () => {
                AppState.listFilters = {
                    genres: new Set(), sites: new Set(),
                    rating: { type: 'exact', value: 0 },
                    andTagIds: new Set(), orTagIds: new Set(), notTagIds: new Set(),
                    dateFilter: AppState.defaultDateFilter(), unratedOrUntaggedOnly: false,
                };
                localStorage.removeItem('listFilters_encrypted');
                App.openFilterModal();
            });

            $('#filter-settings-save').addEventListener('click', () => {
                AppState.listFilters.unratedOrUntaggedOnly = unratedToggle.checked;
                AppState.listFilters.rating.type = ratingTypeSelect.value;
                AppState.listFilters.rating.value = currentRating;
                AppState.listFilters.genres = getSelectedSet('filter-genre');
                AppState.listFilters.sites = getSelectedSet('filter-site');
                AppState.listFilters.andTagIds = tempAndTags;
                AppState.listFilters.orTagIds = tempOrTags;
                AppState.listFilters.notTagIds = tempNotTags;

                const mode = $(`input[name="date-filter-mode-filter"]:checked`).value;
                AppState.listFilters.dateFilter.mode = mode;
                if (mode === 'specific') AppState.listFilters.dateFilter.date = App.getDateInputValue('date-filter-specific-date-filter');
                else if (mode === 'range') { 
                    AppState.listFilters.dateFilter.startDate = App.getDateInputValue('date-filter-start-date-filter');
                    AppState.listFilters.dateFilter.endDate = App.getDateInputValue('date-filter-end-date-filter'); 
                } else { 
                    AppState.listFilters.dateFilter = AppState.defaultDateFilter(); 
                }
                
                const filtersToSave = {
                    ...AppState.listFilters,
                    genres: [...AppState.listFilters.genres],
                    sites: [...AppState.listFilters.sites],
                    andTagIds: [...AppState.listFilters.andTagIds],
                    orTagIds: [...AppState.listFilters.orTagIds],
                    notTagIds: [...AppState.listFilters.notTagIds]
                };
                const encryptedFilters = App.encryptData(filtersToSave);
                if (encryptedFilters) localStorage.setItem('listFilters_encrypted', encryptedFilters);

                AppState.currentPage = 1;
                App.renderAll();
                App.closeModal();
            });
            $('#filter-settings-cancel').addEventListener('click', App.closeModal);
            updatePreview();
        });
    },

    openTagModal: (options) => Modals.openTagModal(options),
    openTagFilterModal: (options) => Modals.openTagFilterModal(options),

    getSortOptions: () => [
        { by: 'registeredAt', order: 'desc', label: '登録日 (新しい順)' }, { by: 'registeredAt', order: 'asc', label: '登録日 (古い順)' },
        { by: 'name', order: 'asc', label: '作品名 (昇順)' }, { by: 'name', order: 'desc', label: '作品名 (降順)' },
        { by: 'lastSelectedAt', order: 'desc', label: '抽選日 (新しい順)' }, { by: 'lastSelectedAt', order: 'asc', label: '抽選日 (古い順)' },
        { by: 'genre', order: 'asc', label: 'ジャンル (昇順)' },
    ],
    
    createCheckboxGroupHTML: (groupName, options, selectedSet) => `
        <div class="flex flex-wrap gap-3">${options.map(opt => `
            <label class="inline-flex items-center cursor-pointer bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors select-none">
                <input type="checkbox" name="${groupName}" value="${opt.value}" class="form-checkbox h-4 w-4 text-sky-500 rounded border-gray-500 bg-gray-800" ${selectedSet.has(opt.value) ? 'checked' : ''}>
                <span class="ml-2 text-sm text-gray-200">${opt.label}</span>
            </label>`).join('')}
        </div>`,
    
    createDateInputHTML: (id, value) => `<input type="text" id="${id}" value="${value}" placeholder="YYYY/MM/DD" data-role="date-input" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-500">`,
    
    createDateFilterHTML: (context, state, isOpen = false) => `
        <div class="space-y-3">
            <div class="flex flex-wrap gap-x-6 gap-y-2">
                <label class="flex items-center"><input type="radio" name="date-filter-mode-${context}" value="none" class="mr-2" ${state.mode === 'none' ? 'checked' : ''}>指定なし</label>
                <label class="flex items-center"><input type="radio" name="date-filter-mode-${context}" value="specific" class="mr-2" ${state.mode === 'specific' ? 'checked' : ''}>特定日</label>
                <label class="flex items-center"><input type="radio" name="date-filter-mode-${context}" value="range" class="mr-2" ${state.mode === 'range' ? 'checked' : ''}>期間</label>
            </div>
            <div id="date-filter-specific-${context}" class="${state.mode === 'specific' ? '' : 'hidden'}">${App.createDateInputHTML(`date-filter-specific-date-${context}`, state.date)}</div>
            <div id="date-filter-range-${context}" class="${state.mode === 'range' ? '' : 'hidden'}">
                <div class="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">${App.createDateInputHTML(`date-filter-start-date-${context}`, state.startDate)}<span>～</span>${App.createDateInputHTML(`date-filter-end-date-${context}`, state.endDate)}</div>
            </div>
            <details class="bg-gray-700 rounded-lg" ${isOpen ? 'open' : ''}><summary class="px-3 py-2 text-xs text-gray-400 cursor-pointer">プレビュー</summary>
                <div class="p-3 border-t border-gray-600">
                    <p id="date-filter-preview-count-${context}" class="text-sm mb-2">0 作品</p>
                    <div id="date-filter-preview-grid-${context}" class="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1"></div>
                </div>
            </details>
        </div>`,

    setupDateFilterEventListeners: (context, updateCallback) => {
         $$(`input[name="date-filter-mode-${context}"]`).forEach(radio => {
            radio.addEventListener('change', () => {
                const mode = radio.value;
                $('#date-filter-specific-' + context).classList.toggle('hidden', mode !== 'specific');
                $('#date-filter-range-' + context).classList.toggle('hidden', mode !== 'range');
                updateCallback();
            });
        });
        [`date-filter-specific-date-${context}`, `date-filter-start-date-${context}`, `date-filter-end-date-${context}`].forEach(id => {
            const el = $(`#${id}`);
            if(el) { el.addEventListener('change', updateCallback); el.addEventListener('input', App.debounce(updateCallback, 300)); }
        });
    },

    initializeDateInputs: (container) => {
        container.querySelectorAll('input[data-role="date-input"]').forEach(textInput => {
            if (textInput.dataset.initialized) return;
            textInput.dataset.initialized = 'true';
            const validate = () => textInput.classList.toggle('border-red-500', !(App.isValidDate(textInput.value) || textInput.value === ''));
            textInput.addEventListener('input', validate);
        });
    },
    
    getDateInputValue: (id) => ($(`#${id}`)?.value || ''),

    // Proxy Methods
    getLotteryPool: () => Lottery.getLotteryPool(App),
    openLotterySettingsModal: (tempState) => Lottery.openLotterySettingsModal(App, tempState),
    openHelpModal: () => Lottery.openHelpModal(App),
    performLottery: () => Lottery.performLottery(App),
    openLotteryResultModal: (work, tempState) => Lottery.openLotteryResultModal(work, App, tempState),
    openFeedbackModal: (work, tempState) => Lottery.openFeedbackModal(work, App, tempState),

    openBatchRegistrationModal: (keepData) => Batch.openBatchRegistrationModal(App, keepData),
    renderTempWorkList: () => Batch.renderTempWorkList(App),
    removeTempWork: (index) => Batch.removeTempWork(index, App),
    loadTempWorkToForm: (index) => Batch.loadTempWorkToForm(index, App),
    resetBatchRegForm: () => Batch.resetBatchRegForm(App),
    openBatchConfirmModal: () => Batch.openBatchConfirmModal(App),
    executeBatchSave: () => Batch.executeBatchSave(App),

    openMemoModal: (workId, memo, rating, tags, cb) => Modals.openMemoModal(workId, memo, rating, tags, cb),

    openStatsDashboardModal: () => Stats.openStatsDashboardModal(App),
    setupChartDefaults: () => Stats.setupChartDefaults(App),
    renderStatsOverview: () => Stats.renderStatsOverview(App),
    renderTrendsChart: (mode) => Stats.renderTrendsChart(mode, App),
    renderTrendsDetail: (key, detailData) => Stats.renderTrendsDetail(key, detailData, App),
    renderBacklogStats: () => Stats.renderBacklogStats(App),

    toggleDebugMode: async () => {
        if (AppState.isDebugMode) {
            if (!await App.showConfirm("デバッグ終了", "リロードしますか？")) return;
            AppState.isDebugMode = false;
            location.reload();
        } else {
            if (!await App.showConfirm("デバッグ開始", "デバッグモードを開始します。データは保存されません。")) return;
            AppState.isDebugMode = true;
            $('#debug-banner').classList.remove('hidden');
            if(AppState.unsubscribeTags) AppState.unsubscribeTags();
            // Inline Mock data for debug
            const works = [];
            const tags = new Map();
            tags.set('d1', {id:'d1', name:'DebugTag', color:'#f00'});
            works.push({id:'w1', name:'Debug Work 1', rating:5, tagIds:['d1'], registeredAt: new Date()});
            
            AppState.works = works;
            AppState.tags = tags;
            
            App.showToast("デバッグモード: データクリア");
            App.renderAll();
        }
    },

    generateBackupJSON: () => {
        const backupData = {
            version: AppState.appVersion,
            exportedAt: new Date().toISOString(),
            syncId: AppState.syncId,
            tags: Array.from(AppState.tags.values()),
            works: AppState.works
        };
        return JSON.stringify(backupData, null, 2); 
    },

    handleExportBackup: () => {
        try {
            const json = App.generateBackupJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `backup_${AppState.syncId}.json`;
            link.click();
            App.showToast("バックアップを作成しました");
        } catch (e) {
            console.error(e);
            App.showToast("バックアップ失敗", "error");
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        let version = 'v5.0.0';
        try {
            const res = await fetch('sw.js?t=' + Date.now());
            if (res.ok) {
                const txt = await res.text();
                const m = txt.match(/const APP_VERSION = '([^']+)';/);
                if (m) version = m[1];
            }
        } catch (e) {}
        AppState.appVersion = version;
        window.App = App; // Global Access
        App.init();
    } catch (error) {
        console.error("Init Failed:", error);
        document.body.innerHTML = `<div style="color:red;padding:20px">Failed to start: ${error.message}</div>`;
    }
});