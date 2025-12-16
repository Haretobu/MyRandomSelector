// src/main.js
import './style.css';
import { auth, db, storage, functions } from './firebaseConfig';
import { store as AppState } from './store';
import * as Utils from './utils';

// UI生成ロジック & アクション
import * as UI from './ui.js';
import * as Actions from './actions.js';
import { setupAppEventListeners } from './events.js';
import * as Modals from './modals.js';
import * as Batch from './batch.js';
import * as Stats from './stats.js';
import * as Lottery from './lottery.js';
import { render, html } from 'lit-html';

// ★追加: DB & Search
import * as DB from './db.js';
import * as Search from './search.js';

// Firebase Modules
import { signInWithEmailAndPassword, onIdTokenChanged } from "firebase/auth";
import { 
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
    onSnapshot, query, writeBatch, Timestamp, serverTimestamp, 
    getDocs, addDoc, arrayUnion, arrayRemove, deleteField, 
    orderBy, limit 
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getApp } from "firebase/app";

// Helper Functions
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// AppState overrides
AppState.unsubscribeWorks = () => {};
AppState.unsubscribeTags = () => {};
AppState.checkModalDirtyState = () => false;
AppState.defaultDateFilter = () => ({ mode: 'none', date: '', startDate: '', endDate: '' });

const App = {

    // --- Initialization ---
    init: () => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => console.log('Service Worker Registered:', registration.scope))
                    .catch(error => console.log('Service Worker Failed:', error));
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
            // Sliding FAB (if needed)
            slidingFabContainer: $('#fab-menu-content'), 
            slidingFabToggle: $('#fab-main-toggle')
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
        // Show loading content
        if(AppState.ui.loadingContent) AppState.ui.loadingContent.classList.remove('opacity-0');

        App.initializeFirebase();
        App.initializeDateInputs(document.body);

        if (window.innerWidth < 1024) {
            const syncDetails = $('#sync-panel-details');
            const regDetails = $('#registration-panel-details');
            if(syncDetails) syncDetails.removeAttribute('open');
            if(regDetails) regDetails.removeAttribute('open');
        }
        App.setupEventListeners();
        App.checkVersionUpdate();
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

    // --- FAB Menu Logic ---
    toggleFabMenu: () => {
        // New logic uses 'fab-menu-content' directly in handleExportBackup or similar
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

    // --- Modal Management ---
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

                    if (AppState.isLiteMode) {
                        const banner = $('#lite-mode-banner');
                        if (banner) banner.classList.remove('hidden');
                        App.showToast("Liteモードで起動中", "info", 4000);
                    }
                }, 500);
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

    // ★★★ NEW Load Data Logic (IndexedDB + Sync) ★★★
    loadDataSet: async (newSyncId) => {
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

        AppState.ui.workListEl.classList.add('hidden');
        AppState.ui.paginationControls.classList.add('hidden');
        AppState.ui.workListMessage.innerHTML = `
            <div class="text-center py-10 text-gray-500">
                <i class="fas fa-spinner fa-spin fa-3x text-teal-400"></i>
                <p class="mt-4 text-base">データを読み込み中...</p>
            </div>`;
        AppState.ui.workListMessage.classList.remove('hidden');

        // 1. IndexedDB Load
        try {
            const localData = await DB.loadLocalData();
            if (localData.works.length > 0) {
                console.log(`Loaded ${localData.works.length} works from Local DB.`);
                AppState.works = localData.works;
                AppState.tags = localData.tags;
                Search.initSearchIndex(AppState.works);
                AppState.isLoadComplete = true;
                AppState.loadingStatus.works = true;
                AppState.loadingStatus.tags = true;
                App.renderAll();
                AppState.ui.loadingOverlay.classList.add('hidden');
            }
        } catch (e) {
            console.warn("Local load failed:", e);
        }

        // 2. Firestore Sync
        if (AppState.currentUser && !AppState.isDebugMode) {
            App.showToast("サーバーと同期中...", "info", 2000);
            try {
                const syncedData = await DB.syncWithFirestore();
                if (syncedData) {
                    console.log("Sync complete.");
                    AppState.works = syncedData.works;
                    AppState.tags = syncedData.tags;
                    Search.initSearchIndex(AppState.works);
                    AppState.isLoadComplete = true;
                    AppState.loadingStatus.works = true;
                    AppState.loadingStatus.tags = true;
                    App.renderAll();
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
        }
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
    
    // ★★★ NEW Search Logic (Fuzzy) ★★★
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
    openFilterModal: (tempState) => Modals.openFilterModal(App, tempState), // Assuming refactor, or inline logic if needed
    openTagModal: (options) => Modals.openTagModal(options),
    openTagFilterModal: (options) => Modals.openTagFilterModal(options),

    getSortOptions: () => [
        { by: 'registeredAt', order: 'desc', label: '登録日 (新しい順)' }, { by: 'registeredAt', order: 'asc', label: '登録日 (古い順)' },
        { by: 'name', order: 'asc', label: '作品名 (昇順)' }, { by: 'name', order: 'desc', label: '作品名 (降順)' },
        { by: 'lastSelectedAt', order: 'desc', label: '抽選日 (新しい順)' }, { by: 'lastSelectedAt', order: 'asc', label: '抽選日 (古い順)' },
        { by: 'genre', order: 'asc', label: 'ジャンル (昇順)' },
    ],
    
    // Checkbox & Date Helpers
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
                <div class="p-3 border-t border-gray-600"><p id="date-filter-preview-count-${context}" class="text-sm mb-2">0 作品</p><div id="date-filter-preview-grid-${context}" class="grid grid-cols-5 gap-2"></div></div>
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
            const debugData = await import('./debugData.js').then(m => m.generateDebugData()).catch(() => ({works:[], tags:new Map()}));
            // Or simple inline mock if debugData.js not exists
            AppState.works = []; AppState.tags = new Map(); // Reset
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