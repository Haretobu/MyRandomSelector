import './style.css';
import { auth, db, storage, functions } from './firebaseConfig';
import { store as AppState } from './store';
import * as Utils from './utils';

// ★追加: UI生成ロジックを読み込む
import * as UI from './ui.js';
import * as Actions from './actions.js';
import { setupAppEventListeners } from './events.js';
import * as Modals from './modals.js';
import * as Batch from './batch.js';
import * as Stats from './stats.js';
import * as Lottery from './lottery.js';
import { render, html } from 'lit-html';

// ★変更点: Chart.jsとCryptoJSのimportは削除しました
// (index.htmlのCDNから読み込まれる window.Chart や window.CryptoJS をそのまま使います)

// Firebaseの機能を個別に読み込み
import { signInWithEmailAndPassword, onIdTokenChanged } from "firebase/auth";
import { 
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, 
    onSnapshot, query, writeBatch, Timestamp, serverTimestamp, 
    getDocs, addDoc, arrayUnion, arrayRemove, deleteField, 
    orderBy, limit 
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
// 他のimportの下あたりに追加してください
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getApp } from "firebase/app";

// ヘルパー関数（グローバルに残す）
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// AppState内の関数プロパティを再設定
AppState.unsubscribeWorks = () => {};
AppState.unsubscribeTags = () => {};
AppState.checkModalDirtyState = () => false;
AppState.defaultDateFilter = () => ({ mode: 'none', date: '', startDate: '', endDate: '' });

// Utilsの関数をAppオブジェクトで使えるようにマージするための準備
// (下のAppオブジェクト定義はこのまま続きます)
        const App = {

            // --- Initialization ---
            init: () => {
                if ('serviceWorker' in navigator) {
                    window.addEventListener('load', () => {
                        navigator.serviceWorker.register('sw.js')
                            .then(registration => {
                                console.log('Service Worker 登録成功:', registration.scope);
                            })
                            .catch(error => {
                                console.log('Service Worker 登録失敗:', error);
                            });
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

                // UI要素の参照をキャッシュ
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
                    slidingFabContainer: $('#sliding-fab-container'),
                    slidingFabToggle: $('#sliding-fab-toggle'),
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
                };

                const sortOptions = App.getSortOptions(); // 修正3で作成した共通関数
                const currentSortOption = sortOptions.find(opt => opt.by === AppState.sortState.by && opt.order === AppState.sortState.order);
                // AppState.ui.sortStateLabel が読み込まれた「後」なので安全に実行できる
                if (currentSortOption) { 
                    AppState.ui.sortStateLabel.textContent = `並び替え: ${currentSortOption.label}`;
                }

                // --- ログインフォームのイベントリスナーを設定 ---
                const loginForm = $('#login-form');
                const loginEmail = $('#login-email');
                const loginPassword = $('#login-password');
                const loginError = $('#login-error');

                if (loginForm) {
                    loginForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        const email = loginEmail.value;
                        const password = loginPassword.value;
                        
                        // ログイン処理を実行
                        signInWithEmailAndPassword(AppState.auth, email, password)
                            .then((userCredential) => {
                                // 成功
                                // (onAuthStateChanged が自動で検知するので、ここでは何もしなくてよい)
                                loginError.classList.add('hidden');
                                AppState.ui.loadingOverlay.classList.remove('hidden'); // ローディング画面を再表示


                            })
                            .catch((error) => {
                                // 失敗
                                const errorCode = error.code;
                                // ★ 修正: isDebugMode で分岐 ★
                                if (AppState.isDebugMode) {
                                    console.error("Login failed (Debug):", error.code, error.message);
                                } else {
                                    console.error("Login attempt failed."); // 本番では詳細を出力しない
                                }
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
                AppState.ui.loadingOverlay.classList.remove('hidden');
                App.initializeFirebase();
                App.initializeDateInputs(document.body);

                if (window.innerWidth < 1024) {
                    $('#sync-panel-details').removeAttribute('open');
                    $('#registration-panel-details').removeAttribute('open');
                }
                App.setupEventListeners();

                // ★追加: 自動バージョンチェック（文章作成不要版）
                App.checkVersionUpdate();
            },

            // ★追加: 毎回同じ定型文を出すだけの楽ちん機能
            checkVersionUpdate: () => {
                const currentVersion = AppState.appVersion; 
                const lastVersion = localStorage.getItem('last_known_version');

                // バージョンが変わった時だけ実行
                if (currentVersion && currentVersion !== 'Unknown' && currentVersion !== lastVersion) {
                    
                    // 次回のために新しいバージョンを保存
                    localStorage.setItem('last_known_version', currentVersion);

                    // ★ここに「ずっと使い回せる定型文」を書いておきます
                    const message = `
                        <div class="text-center space-y-4">
                            <div class="text-6xl">🚀</div>
                            <p class="text-lg text-white font-bold">アプリが更新されました！</p>
                            <p class="text-gray-300">
                                バージョン: <span class="text-teal-400 font-mono text-xl font-bold">${currentVersion}</span>
                            </p>
                            <div class="bg-gray-700 p-4 rounded-lg text-sm text-left text-gray-300">
                                <p>✅ 動作パフォーマンスの向上</p>
                                <p>✅ システムの安定性とセキュリティ強化</p>
                                <p>✅ その他、軽微な修正</p>
                            </div>
                        </div>
                    `;

                    // 少し待ってからモーダルを表示
                    setTimeout(() => {
                        // confirmModal を流用して表示（OKボタンだけ押させる）
                        App.showConfirm("アップデート完了", message); 
                    }, 1500);
                }
            },

            // --- Utility Functions ---

            // ★追加: モバイル判定 (画面幅またはUserAgentで簡易判定)
            isMobile: UI.isMobile,

            escapeHTML: Utils.escapeHTML,

            // ★ 修正: 暗号化ヘルパー (方針3) ★
            encryptData: (data) => {
                if (!data) return null;
                try {
                    return JSON.stringify(data);
                } catch (e) {
                    console.error("Data serialization failed:", e);
                    return null;
                }
            },

            // ★ 修正: 復号ヘルパー (方針3) ★
            decryptData: (encryptedString) => {
                if (!encryptedString) return null;
                try {
                    // もし古い暗号化データ（[や{で始まらない文字列）なら、解読できないのでリセット扱いにする
                    if (!encryptedString.startsWith('[') && !encryptedString.startsWith('{')) {
                        console.warn("Legacy encrypted data detected. Resetting preference.");
                        return null;
                    }
                    return JSON.parse(encryptedString);
                } catch (e) {
                    console.warn("Data parsing failed:", e);
                    return null;
                }
            },
            isValidDate: (dateString) => {
                if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateString)) return false;
                const d = new Date(dateString.replace(/\//g, '-'));
                if (isNaN(d.getTime())) return false;
                return d.toISOString().slice(0, 10).replace(/-/g, '/') === dateString;
            },

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
                    timer = setTimeout(() => {
                        func.apply(this, args);
                    }, delay);
                };
            },

            getTagObjects: (tagIds) => {
                return Array.from(tagIds || []).map(id => AppState.tags.get(id)).filter(Boolean);
            },

            // --- FAB Menu Logic ---
            toggleFabMenu: () => {
                const isOpen = AppState.ui.slidingFabContainer.classList.toggle('drawer-open');
                AppState.ui.fabBackdrop.classList.toggle('hidden', !isOpen);
                AppState.ui.slidingFabToggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
            },
            
            closeFabMenu: () => {
                AppState.ui.slidingFabContainer.classList.remove('drawer-open');
                AppState.ui.fabBackdrop.classList.add('hidden');
                AppState.ui.slidingFabToggle.setAttribute('aria-label', 'メニューを開く');
            },

            // --- Modal Management ---
            openModal: (title, contentHtml, onOpen = null, options = {}) => {
                App.closeFabMenu();
                AppState.checkModalDirtyState = () => false;
                // ★ 修正: autoFocus オプションを追加 (デフォルトは true) ★
                const { size = 'max-w-2xl', headerActions = '', autoFocus = true } = options;
                
                Object.values(AppState.activeCharts).forEach(chart => chart.destroy());
                AppState.activeCharts = {};

                AppState.ui.modalContainer.classList.remove('max-w-2xl', 'max-w-4xl', 'max-w-5xl', 'max-w-7xl');
                AppState.ui.modalContainer.classList.add(size);
                
                $('#modal-header-actions').innerHTML = headerActions; // ← 修正: ヘッダーにボタンを挿入
                AppState.ui.modalTitle.textContent = title;
                AppState.ui.modalContentHost.innerHTML = contentHtml;
                App.initializeDateInputs(AppState.ui.modalContentHost); 
                AppState.ui.modalBackdrop.classList.remove('hidden');
                AppState.ui.modalWrapper.classList.remove('hidden');
                AppState.ui.slidingFabContainer.classList.add('fab-hidden');
                
                setTimeout(() => {
                    AppState.ui.modalBackdrop.classList.add('opacity-100');
                    AppState.ui.modalContainer.classList.remove('scale-95', 'opacity-0');
                    if (onOpen) onOpen();
                    
                    if (autoFocus) {
                        const firstFocusable = AppState.ui.modalContentHost.querySelector('input, select, button');
                        if (firstFocusable) {
                            setTimeout(() => firstFocusable.focus(), 100);
                        }
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
                AppState.ui.slidingFabContainer.classList.remove('fab-hidden');
                
                setTimeout(() => {
                    AppState.ui.modalBackdrop.classList.add('hidden');
                    AppState.ui.modalWrapper.classList.add('hidden');
                    AppState.ui.modalContentHost.innerHTML = '';
                    Object.values(AppState.activeCharts).forEach(chart => chart.destroy());
                    AppState.activeCharts = {};
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
                    const editImageUpload = $('#edit-image-upload'); // モーダル内の要素なので$で都度取得
                    if (editImageUpload) editImageUpload.value = '';
                }
            },

            // --- Loading Timeout Logic ---
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

                const errorCode = isStall ? 'DATA_STALL' : 'TIMEOUT_30S';
                const errorMessageTitle = isStall ? 'データ取得の停滞' : '読み込みタイムアウト';
                console.error(`Loading failed: ${errorCode}`);

                clearTimeout(AppState.loadingTimeout);
                clearTimeout(AppState.stallTimeout);
                
                const statusParts = [];
                if (!AppState.loadingStatus.auth) statusParts.push('認証');
                if (!AppState.loadingStatus.tags) statusParts.push('タグ');
                if (!AppState.loadingStatus.works) statusParts.push('作品');

                const errorHtml = `
                    <i class="fas fa-exclamation-triangle fa-3x text-red-400"></i>
                    <p class="mt-4 text-red-300 font-semibold">${errorMessageTitle || '読み込みタイムアウト'}</p>
                    <p class="mt-2 text-gray-400 text-sm">
                        ${statusParts ? `未完了: ${statusParts.join(', ')}` : 'タイムアウトしました。'}
                    </p>
                    <p class="mt-4 text-sm text-gray-500">ページを再読み込みするか、同期IDを確認してください。</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg">再読み込み</button>
                `;

                // ★ 修正: メインのローディングオーバーレイが表示されているか？
                if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
                    // 表示中 (初回ロード) なら、オーバーレイを書き換える
                    AppState.ui.loadingContent.innerHTML = errorHtml;
                } else {
                    // 非表示 (データ切り替え中) なら、作品リストのメッセージ欄を書き換える
                    AppState.ui.workListMessage.innerHTML = `<div class="text-center py-10">${errorHtml}</div>`;
                    AppState.ui.workListMessage.classList.remove('hidden');
                    AppState.ui.workListEl.classList.add('hidden');
                    AppState.ui.paginationControls.classList.add('hidden');
                }
            },
            
            startLoadingTimeout: () => {
                clearTimeout(AppState.loadingTimeout);
                AppState.loadingTimeout = setTimeout(() => App.handleLoadingTimeout(false), 90000);
                setTimeout(() => {
                    // isLoadComplete でチェックするのが一番確実
                    if (!AppState.isLoadComplete) { 
                        // Spec通り: works「か」tags (どちらか片方) がまだなら
                        if (!AppState.loadingStatus.works || !AppState.loadingStatus.tags) {
                            const btn = $('#lite-mode-switch-prod'); // $() ヘルパーは AppState.ui の外でも使える
                            if (btn) btn.classList.remove('hidden');
                        }
                    }
                }, 30000);
            },

            handleDataFetchError: (error, type) => {
                 if (AppState.isLoadComplete) return;
                 // ★ 修正: isDebugMode で分岐 ★
                 if (AppState.isDebugMode) {
                     console.error(`Error fetching ${type} (Debug): `, error);
                 } else {
                     console.error(`Error fetching ${type}.`); // 本番では詳細を出力しない
                 }
                clearTimeout(AppState.loadingTimeout);
                 
                 const errorHtml = `
                    <i class="fas fa-exclamation-triangle fa-3x text-red-400"></i>
                    <p class="mt-4 text-red-300 font-semibold">${type}データの取得に失敗</p>
                    <p class="mt-2 text-gray-400 text-sm">
                        ${error ? App.escapeHTML(error.message) : '不明なエラー'}
                    </p>
                    <p class="mt-4 text-sm text-gray-500">ページを再読み込みするか、Firebaseのセキュリティルールを確認してください。</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg">再読み込み</button>
                `;
                
                // ★ 修正: メインのローディングオーバーレイが表示されているか？
                if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
                    // 表示中 (初回ロード) なら、オーバーレイを書き換える
                    AppState.ui.loadingContent.innerHTML = errorHtml;
                } else {
                    // 非表示 (データ切り替え中) なら、作品リストのメッセージ欄を書き換える
                    AppState.ui.workListMessage.innerHTML = `<div class="text-center py-10">${errorHtml}</div>`;
                    AppState.ui.workListMessage.classList.remove('hidden');
                    AppState.ui.workListEl.classList.add('hidden');
                    AppState.ui.paginationControls.classList.add('hidden');
                }
            },

            checkLoadingComplete: () => {
                if (AppState.isLoadComplete) return;
                
                // ★ メインのローディングオーバーレイが表示されている場合のみプログレスバーを更新
                if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
                    App.updateLoadingProgress();
                }
                
                if (AppState.loadingStatus.auth && AppState.loadingStatus.works && AppState.loadingStatus.tags) {
                    AppState.isLoadComplete = true;
                    clearTimeout(AppState.loadingTimeout);
                    clearTimeout(AppState.stallTimeout);
                    console.log("All data loaded successfully.");
                    
                    // ★ メインのローディングオーバーレイが表示されている場合のみ、それを閉じる
                    if (!AppState.ui.loadingOverlay.classList.contains('hidden')) {
                        AppState.ui.loadingText.textContent = '読み込み完了！';
                        AppState.ui.loadingProgressBar.style.width = `100%`;

                        setTimeout(() => {
                            AppState.ui.loadingOverlay.classList.add('opacity-0');
                            AppState.ui.appContainer.classList.remove('opacity-0');
                            setTimeout(() => AppState.ui.loadingOverlay.classList.add('hidden'), 500);

                            const lastSelectedId = localStorage.getItem('lastSelectedWorkId');
                            if (lastSelectedId) {
                                localStorage.removeItem('lastSelectedWorkId');
                                const work = AppState.works.find(w => w.id === lastSelectedId);
                                if (work && ((work.rating || 0) === 0 || !work.tagIds || work.tagIds.length === 0)) {
                                    setTimeout(() => App.openFeedbackModal(work), 1000); 
                                }
                            }
                            if (AppState.isLiteMode) {
                                const banner = $('#lite-mode-banner');
                                if (banner) banner.classList.remove('hidden');
                                App.showToast("Liteモードで起動中 (50件のみ表示、画像と更新を制限)", "info", 4000);
                            }
                        }, 500);
                    } else {
                        // データ切り替え中の読み込み完了
                        // (onSnapshotがrenderWorkListを呼び出し、リストが自動的に描画される)
                        console.log("Data sync complete. Rendering list.");
                    }
                }
            },

            // --- Firebase & Data Sync Logic ---
            initializeFirebase: () => {
                console.log("Using initialized Firebase from config.");
                
                AppState.auth = auth;
                AppState.db = db;
                AppState.storage = storage;
                
                App.setupAuthObserver();

                // ★★★ App Check の初期化 (DDoS対策) ★★★
                try {
                    const app = getApp();
                    
                    // 開発環境（localhost）なら、デバッグモードをONにする
                    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
                        // コンソールに出たデバッグトークンをFirebaseに登録すれば、ローカルでもテスト可能になります
                        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                    }

                    // あなたのサイトキーでApp Checkを開始
                    initializeAppCheck(app, {
                        provider: new ReCaptchaEnterpriseProvider('6Lem8v8rAAAAAJiur2mblUOHF28x-Vh0zRjg6B6u'),
                        isTokenAutoRefreshEnabled: true
                    });
                    
                    console.log("App Check initialized successfully.");

                } catch (e) {
                    console.warn("App Check initialization failed:", e);
                }
            },

            setupAuthObserver: () => {
                // ★ 変更: onAuthStateChanged -> onIdTokenChanged
                onIdTokenChanged(AppState.auth, user => { 
                    if (user) {
                        // --- 1. ログイン済みの(または成功した)場合 ---

                        AppState.ui.loadingText.textContent = '認証情報を確認中...';
                        
                        // ログイン画面が表示されていれば隠す
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
                        // --- 2. 未ログインの場合 ---
                        // 匿名認証は行わず、ログイン画面を表示する
                        AppState.ui.loadingOverlay.classList.add('hidden'); // ローディング画面は隠す
                        
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
            
            // ★追加: ログイン後に設定を読み込む関数
            loadUserSettings: () => {
                // 1. サイトフィルタなどの復元 (listFilters)
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

                // 2. ソート順の復元
                const savedSortState = App.decryptData(localStorage.getItem('sortState_encrypted'));
                if (savedSortState) {
                    AppState.sortState = savedSortState;
                    // UIへの反映
                    const sortOptions = App.getSortOptions();
                    const currentSortOption = sortOptions.find(opt => opt.by === AppState.sortState.by && opt.order === AppState.sortState.order);
                    if (currentSortOption && AppState.ui.sortStateLabel) { 
                        AppState.ui.sortStateLabel.textContent = `並び替え: ${currentSortOption.label}`;
                    }
                }

                // 3. 抽選設定の復元
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

                // 4. 検索履歴の復元
                const savedHistory = App.decryptData(localStorage.getItem('searchHistory_encrypted'));
                if (Array.isArray(savedHistory) && savedHistory.every(item => typeof item === 'string')) {
                    AppState.searchHistory = savedHistory.slice(0, AppState.maxSearchHistory);
                }

                // 5. カスタムプリセットの復元
                const savedPresets = App.decryptData(localStorage.getItem('customPresets_encrypted')); // ★この行を追加
                
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
                
                console.log("User settings loaded.");
            },

            loadDataSet: (newSyncId) => {
                // 既に選択中のIDを再度読み込もうとした場合、リフレッシュとして処理を続行
                if (AppState.syncId === newSyncId && AppState.isLoadComplete) {
                    console.log("Reloading data for the same Sync ID.");
                } else if (AppState.syncId === newSyncId) {
                    return; // 読み込み中に同じIDがクリックされた場合は無視
                }
                
                AppState.syncId = newSyncId;
                AppState.ui.syncIdDisplay.value = AppState.syncId;
                localStorage.setItem('r18_sync_id', AppState.syncId);
                
                AppState.unsubscribeWorks();
                AppState.unsubscribeTags();

                AppState.works = [];
                AppState.tags = new Map();
                
                // ★ 修正: App.renderAll() の代わりに、リストエリアにローディング表示を挿入 ★
                AppState.ui.workListEl.classList.add('hidden'); // リスト本体を隠す
                AppState.ui.paginationControls.classList.add('hidden'); // ページネーションを隠す
                AppState.ui.workListMessage.innerHTML = `
                    <div class="text-center py-10 text-gray-500">
                        <i class="fas fa-spinner fa-spin fa-3x text-teal-400"></i>
                        <p class="mt-4 text-base">データを読み込み中...</p>
                    </div>`;
                AppState.ui.workListMessage.classList.remove('hidden'); // メッセージエリアを表示
                AppState.ui.workCountEl.textContent = '読み込み中...'; // 件数表示も更新

                // ★ 修正: 読み込みステータスをリセット ★
                AppState.isLoadComplete = false;
                AppState.loadingStatus.works = false;
                AppState.loadingStatus.tags = false;
                
                // 読み込みタイムアウトも再設定
                clearTimeout(AppState.stallTimeout);
                AppState.stallTimeout = setTimeout(() => App.handleLoadingTimeout(true), 15000); // 15秒停滞したらタイムアウト

                if (AppState.currentUser && AppState.syncId && !AppState.isDebugMode) {
                    if (AppState.isLiteMode) {
                        // Liteモード時: onSnapshot を使わず、静的に取得
                        console.log("Lite Mode: Bypassing subscriptions, fetching limited data...");
                        App.fetchLimitedData(); // 新しいヘルパー関数を呼ぶ
                    } else {
                        // 通常モード時: 従来通り onSnapshot で購読
                        App.subscribeToWorks();
                        App.subscribeToTags();
                    }
                }
            },
            
            fetchLimitedData: async () => {
                console.log("Lite Mode: Fetching limited works and all tags...");
                try {
                    // 1. Fetch Limited Works
                    AppState.ui.loadingText.textContent = '作品データを取得中... (Lite)';
                    const worksRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
                    // 登録日の新しい順 (sortState.by は 'registeredAt' がデフォルト) で 50件取得
                    const worksQuery = query(worksRef, orderBy('registeredAt', 'desc'), limit(50));
                    const worksSnapshot = await getDocs(worksQuery);
                    AppState.works = worksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    AppState.loadingStatus.works = true;
                    App.checkLoadingComplete(); // ワークス完了を通知

                    // 2. Fetch All Tags (statically) - タグはフィルタリングに必須なので全件取得
                    AppState.ui.loadingText.textContent = 'タグデータを取得中... (Lite)';
                    const tagsRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`);
                    const tagsSnapshot = await getDocs(tagsRef);
                    AppState.tags = new Map(tagsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
                    AppState.loadingStatus.tags = true;
                    App.checkLoadingComplete(); // タグ完了を通知
                    
                    App.renderAll(); 

                } catch (error) {
                    // どちらかで失敗したらエラー
                    if (!AppState.loadingStatus.works) {
                        App.handleDataFetchError(error, '作品 (Lite)');
                    } else {
                        App.handleDataFetchError(error, 'タグ (Lite)');
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
            
            subscribeToWorks: () => {
                if (AppState.isDebugMode) return;
                AppState.ui.loadingText.textContent = '作品データを取得中...'; // ← 具体的なテキストを追加
                let isFirstLoad = true;
                const worksRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
                AppState.unsubscribeWorks = onSnapshot(worksRef, (snapshot) => {
                    
                    const workChanges = snapshot.docChanges();
                    
                    workChanges.forEach(change => {
                        const data = { id: change.doc.id, ...change.doc.data() };
                        const index = AppState.works.findIndex(w => w.id === change.doc.id);

                        if (change.type === "added") {
                            if (index === -1) AppState.works.push(data);
                        }
                        if (change.type === "modified") {
                            if (index > -1) AppState.works[index] = data;
                        }
                        if (change.type === "removed") {
                            if (index > -1) AppState.works.splice(index, 1);
                        }
                    });

                    if (isFirstLoad) {
                        isFirstLoad = false;
                        AppState.loadingStatus.works = true;
                        App.checkLoadingComplete();
                    }
                    App.renderWorkList();
                }, error => App.handleDataFetchError(error, '作品'));
            },

            subscribeToTags: () => {
                if (AppState.isDebugMode) return;
                AppState.ui.loadingText.textContent = 'タグデータを取得中...'; // ← 具体的なテキストを追加
                let isFirstLoad = true;
                const tagsRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`);
                AppState.unsubscribeTags = onSnapshot(tagsRef, (snapshot) => {
                    AppState.tags = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
                     if (isFirstLoad) {
                        isFirstLoad = false;
                        AppState.loadingStatus.tags = true;
                        App.checkLoadingComplete();
                     }
                     if (!AppState.ui.modalWrapper.classList.contains('hidden') && $('#tag-list')) {
                         $('#tag-list').dispatchEvent(new Event('refresh-tags', {bubbles:true}));
                     }
                     App.renderAll();
                }, error => App.handleDataFetchError(error, 'タグ'));
            },

            // --- Image Processing ---
            processImage: Utils.processImage,

            // --- Link Preview Logic (Fixed) ---
            fetchLinkPreview: async (url, containerElement) => {
                // 1. 厳格なバリデーション (サーバー通信前の門番)
                if (!url || typeof url !== 'string') return;
                const trimmedUrl = url.trim();
                
                // "http"で始まり、かつ "http://" (7文字) より長い場合のみ許可
                if (!trimmedUrl.startsWith('http') || trimmedUrl.length < 8) {
                    containerElement.innerHTML = '';
                    containerElement.classList.add('hidden');
                    return;
                }
                
                // ローディング表示
                containerElement.innerHTML = `<div class="text-xs text-gray-400 animate-pulse py-2"><i class="fas fa-spinner fa-spin mr-2"></i>リンク情報を取得中...</div>`;
                containerElement.classList.remove('hidden');

                try {
                    // ★修正: 設定ファイルから読み込んだ 'functions' をそのまま使うだけでOK！
                    const getPreview = httpsCallable(functions, 'getLinkPreview');
                    
                    const result = await getPreview({ url: trimmedUrl });
                    const data = result.data.data;

                    if (!result.data.success || !data) {
                        // 取得失敗時は静かに隠す
                        containerElement.innerHTML = '';
                        containerElement.classList.add('hidden');
                        return;
                    }

                    const html = `
                        <div class="mt-2 bg-gray-800 border-l-4 border-red-600 rounded-r shadow-md overflow-hidden max-w-full">
                            <div class="p-3">
                                <div class="text-xs text-gray-400 mb-1">${App.escapeHTML(data.siteName)}</div>
                                <a href="${App.escapeHTML(data.url)}" target="_blank" rel="noopener" class="block font-bold text-blue-400 hover:underline text-sm mb-2 truncate">
                                    ${App.escapeHTML(data.title)}
                                </a>
                                <div class="flex gap-3">
                                    ${data.image ? `
                                    <div class="flex-shrink-0 w-24 h-16 sm:w-32 sm:h-20 bg-black rounded overflow-hidden">
                                        <img src="${App.escapeHTML(data.image)}" class="w-full h-full object-cover" alt="Thumb">
                                    </div>` : ''}
                                    <div class="flex-grow min-w-0">
                                        <p class="text-xs text-gray-300 line-clamp-3">${App.escapeHTML(data.description)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    containerElement.innerHTML = html;

                    // タイトル自動入力 (一括登録画面用)
                    const batchNameInput = $('#batchWorkName');
                    if (batchNameInput && !batchNameInput.value && data.title) {
                        batchNameInput.value = data.title;
                        batchNameInput.dispatchEvent(new Event('input'));
                        App.showToast('タイトルを自動入力しました。');
                    }

                } catch (error) {
                    // エラーが出てもコンソールに出すだけで、UIにはエラーを表示しない
                    console.warn("Link Preview skipped:", error.message);
                    containerElement.innerHTML = '';
                    containerElement.classList.add('hidden');
                }
            },

            // ★追加: Storageへのアップロード処理
            uploadImageToStorage: Actions.uploadImageToStorage,

            // --- CRUD Operations ---
            handleAddWork: Actions.handleAddWork,

            updateWork: Actions.updateWork,

            deleteWork: Actions.deleteWork,

            addTag: Actions.addTag,
            
            deleteTag: Actions.deleteTag,

            // ★追加: 全データ削除ロジック (イベントリスナーから切り出し)
            handleDeleteAllData: async () => {
                 if (AppState.isDebugMode) return App.showToast('デバッグモード中は全削除できません。');
                 // 確認は events.js 側で行っているが、念のため二重チェックしても良い
                 try {
                    const batch = writeBatch(AppState.db);
                    const worksRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
                    const worksSnapshot = await getDocs(worksRef);
                    worksSnapshot.forEach(doc => batch.delete(doc.ref));
                    
                    const tagsRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`);
                    const tagsSnapshot = await getDocs(tagsRef);
                    tagsSnapshot.forEach(doc => batch.delete(doc.ref));

                    await batch.commit();
                    App.showToast("全ての作品・タグデータを削除しました。");
                } catch(error) { 
                    if (AppState.isDebugMode) console.error("Error deleting all data:", error);
                    App.showToast("データ削除中にエラーが発生しました。"); 
                }
            },

            // --- Rendering Logic ---

            saveShowSiteIcon: (value) => {
                AppState.showSiteIcon = value;
                localStorage.setItem('showSiteIcon', value);
            },

            renderAll: () => {
                App.renderWorkList();
                App.renderActiveFilters();
                App.renderLotterySummary();
            },

            // ★追加: URLからサイトIDを取得
            getWorkSite: (url) => {
                if (!url) return 'other';
                if (url.includes('dlsite.com')) return 'dlsite';
                // dmm.co.jp または dmm.com を FANZA とみなす
                if (url.includes('dmm.co.jp') || url.includes('dmm.com')) return 'fanza';
                return 'other';
            },

            // src/main.js の Appオブジェクト内 renderWorkList: ... の部分

            // ★★★ lit-html を使った高速・安全なレンダリング ★★★
            renderWorkList: () => {
                const { ui, isLoadComplete, isDebugMode, works, listViewMode, currentPage, itemsPerPage } = AppState;
                if (!ui.workListEl) return;
                
                // ロード完了前はデバッグモード以外描画しない
                if (!isLoadComplete && !isDebugMode) return;

                // フィルタリングとソート（既存ロジック）
                const filteredWorks = App.getFilteredAndSortedWorks();
                const totalItems = filteredWorks.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

                // ページ調整
                if (currentPage > totalPages) {
                    AppState.currentPage = totalPages;
                }
                const startIndex = (AppState.currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const worksToShow = filteredWorks.slice(startIndex, endIndex);

                // 件数表示の更新
                ui.workCountEl.textContent = `${totalItems} / ${works.length} 作品`;

                // グリッド/リストのクラス切り替え
                ui.viewGridBtn.classList.toggle('view-btn-active', listViewMode === 'grid');
                ui.viewListBtn.classList.toggle('view-btn-active', listViewMode === 'list');
                const isGrid = listViewMode === 'grid';
                ui.workListEl.classList.toggle('grid', isGrid);
                ui.workListEl.classList.toggle('grid-cols-1', isGrid);
                ui.workListEl.classList.toggle('md:grid-cols-2', isGrid);
                ui.workListEl.classList.toggle('xl:grid-cols-3', isGrid);
                ui.workListEl.classList.toggle('gap-6', isGrid);
                ui.workListEl.classList.toggle('space-y-2', !isGrid);

                // 0件時の表示
                if (works.length === 0) {
                    ui.workListMessage.innerHTML = `<div class="text-center py-10 text-gray-500"><i class="fas fa-ghost fa-3x"></i><p class="mt-4 text-base">まだ作品が登録されていません。<br>左上の「作品登録」から追加してみましょう！</p></div>`;
                    ui.workListMessage.classList.remove('hidden');
                    ui.workListEl.classList.add('hidden');
                    $('#pagination-controls-top').classList.add('hidden');
                    $('#pagination-controls').classList.add('hidden');
                    return;
                }
                if (filteredWorks.length === 0) {
                    ui.workListMessage.innerHTML = `<div class="text-center py-10 text-gray-500"><i class="fas fa-search-minus fa-3x"></i><p class="mt-4 text-base">条件に一致する作品がありません。<br>絞り込み条件を見直してください。</p></div>`;
                    ui.workListMessage.classList.remove('hidden');
                    ui.workListEl.classList.add('hidden');
                    $('#pagination-controls-top').classList.add('hidden');
                    $('#pagination-controls').classList.add('hidden');
                    return;
                }

                ui.workListMessage.classList.add('hidden');
                ui.workListEl.classList.remove('hidden');

                // ★★★ ここが変更点: lit-html の render 関数を使用 ★★★
                // map で各作品のテンプレート(HTMLタグの部品)を配列にし、lit-html に渡す
                const template = html`
                    ${worksToShow.map(work => isGrid ? UI.renderWorkCard(work) : UI.renderWorkListItem(work))}
                `;
                
                // render関数が、前回の表示との「差分だけ」を計算して高速に書き換えてくれる
                render(template, ui.workListEl);

                // ページネーションの表示更新（ここはDOM操作のまま）
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

                // Mood / Rating filter
                if (filters.unratedOrUntaggedOnly) {
                    tempWorks = tempWorks.filter(w => (w.rating || 0) === 0 || !w.tagIds || w.tagIds.length === 0);
                } else if (filters.mood) { // Lottery
                    if (filters.mood === 'best') tempWorks = tempWorks.filter(w => (w.rating || 0) >= 4);
                    if (filters.mood === 'hidden_gem') tempWorks = tempWorks.filter(w => (w.rating || 0) <= 2);
                } else if (filters.rating && filters.rating.value > 0) { // List
                    // ↓↓↓ 修正: "below" (以下) のロジックと、(w.rating || 0) の安全対策を追加 ↓↓↓
                    if (filters.rating.type === 'exact') {
                        tempWorks = tempWorks.filter(w => (w.rating || 0) === filters.rating.value);
                    } else if (filters.rating.type === 'above') {
                        tempWorks = tempWorks.filter(w => (w.rating || 0) >= filters.rating.value);
                    } else if (filters.rating.type === 'below') { 
                        tempWorks = tempWorks.filter(w => (w.rating || 0) <= filters.rating.value);
                    }
                }

                // Genre filter
                if (filters.genres && filters.genres.size > 0) {
                    tempWorks = tempWorks.filter(w => filters.genres.has(w.genre));
                }
                
                if (filters.sites && filters.sites.size > 0) {
                    tempWorks = tempWorks.filter(w => {
                        const site = App.getWorkSite(w.sourceUrl);
                        return filters.sites.has(site);
                    });
                }

                // Date filter
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
                
                // Tag filter
                const andTags = filters.andTagIds || new Set();
                if (andTags && andTags.size > 0) {
                    tempWorks = tempWorks.filter(w => w.tagIds && [...andTags].every(tid => w.tagIds.includes(tid)));
                }
                if (filters.orTagIds && filters.orTagIds.size > 0) {
                    tempWorks = tempWorks.filter(w => w.tagIds && [...filters.orTagIds].some(tid => w.tagIds.includes(tid)));
                }
                if (filters.notTagIds && filters.notTagIds.size > 0) {
                    tempWorks = tempWorks.filter(w => !w.tagIds || ![...filters.notTagIds].some(tid => w.tagIds.includes(tid)));
                }

                return tempWorks;
            },
            
            getFilteredAndSortedWorks: () => {
                let tempWorks = App.getFilteredWorks(AppState.listFilters);
                const { searchQuery, sortState, tags } = AppState; // tags を追加

                if (searchQuery) {
                    const normalizedQuery = App.normalizeString(searchQuery); // 正規化
                    const queryRegex = new RegExp(normalizedQuery.replace(/\./g, '.'), 'i'); // ワイルドカード "." を含む正規表現を作成

                    tempWorks = tempWorks.filter(w => {
                        // 作品名を正規化してチェック
                        const normalizedName = App.normalizeString(w.name);
                        if (queryRegex.test(normalizedName)) return true;

                        // ジャンル名を正規化してチェック (部分一致)
                        const normalizedGenre = App.normalizeString(w.genre);
                        if (queryRegex.test(normalizedGenre)) return true;

                        // タグ名を正規化してチェック
                        if (w.tagIds && w.tagIds.length > 0) {
                            for (const tagId of w.tagIds) {
                                const tag = tags.get(tagId);
                                if (tag) {
                                    const normalizedTagName = App.normalizeString(tag.name);
                                    if (queryRegex.test(normalizedTagName)) return true;
                                }
                            }
                        }
                        return false; // どれにも一致しない場合
                    });
                }

                // 並び替え処理 (変更なし)
                return tempWorks.sort((a, b) => {
                    const order = sortState.order === 'asc' ? 1 : -1;
                    const by = sortState.by;

                    if (by === 'name' || by === 'genre') {
                        const valA = a[by] || '';
                        const valB = b[by] || '';
                        return valA.localeCompare(valB, 'ja') * order;
                    }
                    
                    // 日付や数値の比較
                    let valA, valB;
                    if (by === 'registeredAt' || by === 'lastSelectedAt') {
                        // Timestamp オブジェクトまたは null/undefined を想定
                        valA = a[by] ? a[by].toMillis() : 0;
                        valB = b[by] ? b[by].toMillis() : 0;
                        // 日付の場合、null/undefined は最後に来るように調整
                        if (valA === 0) valA = (order === 1 ? Infinity : -Infinity);
                        if (valB === 0) valB = (order === 1 ? Infinity : -Infinity);
                    } else {
                        // rating, selectionCount など
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
                
                if (listFilters.unratedOrUntaggedOnly) {
                    filters.push({type: 'unrated', label: '未評価/未タグ'});
                } else if (listFilters.rating.value > 0) {
                    filters.push({type: 'rating', label: `評価: ${'★'.repeat(listFilters.rating.value)}${listFilters.rating.type === 'above' ? '以上' : ''}`});
                }

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
                            ${f.label}
                            <button data-action="remove-filter" data-type="${f.type}" data-value="${f.value || ''}" class="ml-1.5 inline-flex text-gray-300 hover:text-white">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </span>`).join('');
            },
            
            renderLotterySummary: () => {
                 const { mood, genres, andTagIds, orTagIds, notTagIds, dateFilter, priority, method, unratedOrUntaggedOnly } = AppState.lotterySettings;
                 const moodMap = { default: '問わない', favorite: 'お気に入り', best: '最高評価', hidden_gem: '隠れた名作' };
                 const priorityMap = { new: '新しい順', old: '古い順', random: 'ランダム' };
                 const methodMap = { normal: '通常', decrease_unselected: '未選択優先' };
                 const summaryParts = [];

                if (unratedOrUntaggedOnly) {
                    summaryParts.push('未評価/未タグ付のみ');
                } else {
                    summaryParts.push(`気分: ${moodMap[mood]}`);
                }
                 if (genres.size > 0) summaryParts.push(`ジャンル: ${[...genres].join(', ')}`);
                 if (andTagIds.size > 0) summaryParts.push(`タグ(AND): ${andTagIds.size}件`);
                 if (orTagIds.size > 0) summaryParts.push(`タグ(OR): ${orTagIds.size}件`);
                 if (notTagIds.size > 0) summaryParts.push(`タグ(NOT): ${notTagIds.size}件`);
                 if (dateFilter.mode === 'specific' && dateFilter.date) summaryParts.push(`登録日: ${dateFilter.date}`);
                 if (dateFilter.mode === 'range' && dateFilter.startDate && dateFilter.endDate) summaryParts.push(`期間: ${dateFilter.startDate} ~ ${dateFilter.endDate}`);
                 summaryParts.push(`優先度: ${priorityMap[priority]}`);
                 summaryParts.push(`方法: ${methodMap[method]}`);

                 AppState.ui.lotterySummaryEl.innerHTML = (
                    mood === 'default' && 
                    genres.size === 0 && 
                    andTagIds.size === 0 && orTagIds.size === 0 && notTagIds.size === 0 &&
                    dateFilter.mode === 'none' &&
                    !unratedOrUntaggedOnly
                 )
                     ? `<p class="text-gray-400">設定を開いて条件を選択してください。</p>`
                     : summaryParts.map(s => `<span class="inline-block bg-gray-600 px-2 py-1 rounded text-xs mr-1 mb-1">${s}</span>`).join('');
            },

            // --- Event Handlers & Site Search ---
            openSearchWindow: (site, query) => {
                let url;
                const encodedQuery = encodeURIComponent(query);
                switch(site) {
                    case 'dlsite': url = query ? `https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category%5B0%5D/male/keyword/${encodedQuery}/` : 'https://www.dlsite.com/maniax/'; break;
                    case 'fanza': url = query ? `https://www.dmm.co.jp/dc/doujin/-/list/narrow/=/word=${encodedQuery}/` : 'https://www.dmm.co.jp/dc/doujin/'; break;
                    case 'melonbooks': url = query ? `https://www.melonbooks.co.jp/search/search.php?name=${encodedQuery}&search_target=2` : 'https://www.melonbooks.co.jp/'; break;
                    case 'booth': url = query ? `https://booth.pm/ja/search/${encodedQuery}` : 'https://booth.pm/'; break;
                }
                if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            },
            
            normalizeString: (str) => {
                if (!str) return '';
                return str
                    .toLowerCase() // 小文字化
                    .normalize('NFKC') // 全角記号などを半角に、濁点などを結合文字に
                    .replace(/[\u3041-\u3096]/g, char => String.fromCharCode(char.charCodeAt(0) + 0x60)) // ひらがな -> カタカナ
                    .replace(/[！＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)) // 全角記号 -> 半角記号
                    .replace(/　/g, ' ') // 全角スペース -> 半角スペース
                    .replace(/[〇*]/g, '.') // ワイルドカード文字を正規表現の "." に変換
                    .trim();
            },

            // ★この関数の中身を復活させます
            setupInputClearButton: (inputEl, buttonEl) => {
                if (!inputEl || !buttonEl) return;

                const updateButtonVisibility = () => {
                    // 文字が入っている時だけボタンを表示
                    buttonEl.classList.toggle('hidden', inputEl.value.length === 0);
                };

                // 入力するたびにボタンの表示/非表示をチェック
                inputEl.addEventListener('input', updateButtonVisibility);
                
                // ボタンを押した時の動作
                buttonEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    inputEl.value = ''; // 文字を消す
                    // 重要: 「入力されたこと」にする（これで検索結果がリセットされます）
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    updateButtonVisibility();
                    inputEl.focus(); // 入力欄にカーソルを戻す
                });

                // 初回実行
                updateButtonVisibility();
            },

            // 検索履歴の更新と保存
            updateSearchHistory: (query) => {
                const normalizedQuery = query.trim();
                if (!normalizedQuery) return;
                // 既存の履歴から同じものを削除
                AppState.searchHistory = AppState.searchHistory.filter(item => item !== normalizedQuery);
                // 先頭に追加
                AppState.searchHistory.unshift(normalizedQuery);
                // 最大件数を超えたら末尾を削除
                if (AppState.searchHistory.length > AppState.maxSearchHistory) {
                    AppState.searchHistory.pop();
                }
                const encryptedHistory = App.encryptData(AppState.searchHistory);
                if (encryptedHistory) {
                    localStorage.setItem('searchHistory_encrypted', encryptedHistory);
                }
            },

            // 検索履歴のレンダリング
            // 検索履歴のレンダリング
            // 検索履歴のレンダリング
            renderSearchHistory: () => {
                const box = $('#search-suggest-box');
                if (!box) return;
                if (AppState.searchHistory.length === 0) {
                    box.innerHTML = `<div class="px-4 py-2 text-sm text-gray-400">検索履歴はありません</div>`;
                } else {
                    box.innerHTML = `
                        <div class="px-4 pt-2 pb-1 flex justify-between items-center">
                            <span class="text-xs font-semibold text-gray-400">検索履歴</span>
                            <button type="button" data-action="clear-history" class="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded hover:bg-gray-700">すべて削除</button>
                        </div>
                        ${AppState.searchHistory.map(item => `
                            <div class="search-history-item w-full flex justify-between items-center text-left px-4 py-2 text-sm hover:bg-gray-500 group">
                                <button type="button" data-action="select-history" data-query="${App.escapeHTML(item)}" class="flex-grow text-left truncate">
                                    ${App.escapeHTML(item)}
                                </button>
                                <button type="button" data-action="delete-history" data-query="${App.escapeHTML(item)}" class="w-6 h-6 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white rounded-full hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" title="履歴から削除">
                                    <i class="fas fa-times text-xs"></i>
                                </button>
                            </div>
                        `).join('')}
                    `;
                }
                box.classList.remove('hidden');
                AppState.isSuggestBoxOpen = true;
            },

            // サジェスト候補の生成とレンダリング
            renderSuggestions: (query) => {
                const box = $('#search-suggest-box');
                if (!box || !query) {
                    App.closeSuggestBox(); // クエリが空なら閉じる
                    return;
                }
                const normalizedQuery = App.normalizeString(query);
                if (!normalizedQuery) {
                    App.closeSuggestBox();
                    return;
                }

                const suggestions = [];
                const addedSuggestions = new Set(); // 重複防止用

                // 作品名から検索
                AppState.works.forEach(work => {
                    const normalizedName = App.normalizeString(work.name);
                    if (normalizedName.includes(normalizedQuery) && !addedSuggestions.has(work.name)) {
                        suggestions.push({ type: '作品名', value: work.name });
                        addedSuggestions.add(work.name);
                    }
                });

                // タグ名から検索
                AppState.tags.forEach(tag => {
                    const normalizedTagName = App.normalizeString(tag.name);
                    if (normalizedTagName.includes(normalizedQuery) && !addedSuggestions.has(tag.name)) {
                        suggestions.push({ type: 'タグ', value: tag.name });
                        addedSuggestions.add(tag.name);
                    }
                });

                // ジャンル名から検索 (完全一致のみ)
                ['漫画', 'ゲーム', '動画'].forEach(genre => {
                    const normalizedGenre = App.normalizeString(genre);
                    if (normalizedGenre === normalizedQuery && !addedSuggestions.has(genre)) {
                         suggestions.push({ type: 'ジャンル', value: genre });
                         addedSuggestions.add(genre);
                    }
                });


                if (suggestions.length === 0) {
                    box.innerHTML = `<div class="px-4 py-2 text-sm text-gray-400">候補が見つかりません</div>`;
                } else {
                    box.innerHTML = suggestions.slice(0, 10).map(item => `
                        <button data-query="${App.escapeHTML(item.value)}" class="search-suggestion-item w-full text-left px-4 py-2 text-sm hover:bg-gray-500 block">
                            ${App.escapeHTML(item.value)} <span class="text-xs text-gray-400 ml-2">(${item.type})</span>
                        </button>
                    `).join('');
                }
                box.classList.remove('hidden');
                AppState.isSuggestBoxOpen = true;
            },

            // サジェスト/履歴ボックスを閉じる
            closeSuggestBox: () => {
                const box = $('#search-suggest-box');
                if (box) box.classList.add('hidden');
                AppState.isSuggestBoxOpen = false;
            },

            // 検索の実行
            performSearch: (query) => {
                AppState.searchQuery = query.trim();
                App.updateSearchHistory(AppState.searchQuery); // 履歴を更新
                AppState.currentPage = 1; // 検索したら1ページ目に戻る
                App.renderWorkList(); // リストを再描画
                App.closeSuggestBox(); // ボックスを閉じる
                // 検索ボックスの内容も確定させる (サジェスト選択時など)
                if (AppState.ui.searchInput.value !== AppState.searchQuery) {
                    AppState.ui.searchInput.value = AppState.searchQuery;
                }
            },

            setupEventListeners: () => {
                // events.js に移動した関数を呼ぶ。this(App)を渡す。
                setupAppEventListeners(App);

                // ★追加: 検索ボックスにクリアボタンの機能を紐付ける
                if (AppState.ui && AppState.ui.searchInput) {
                    App.setupInputClearButton(AppState.ui.searchInput, $('#clearSearchBtn'));
                }
            },

            // --- Modal Implementations ---
            
            openExternalSearchModal: Modals.openExternalSearchModal,
            
            openHistoryModal: Modals.openHistoryModal,

            openEditModal: Modals.openEditModal,
            
            openFilterModal: (tempState = null) => {
                const source = tempState || AppState.listFilters;
                const state = {
                    ...source,
                    genres: new Set(source.genres),
                    sites: new Set(source.sites), // ★追加
                    andTagIds: new Set(source.andTagIds),
                    orTagIds: new Set(source.orTagIds),
                    notTagIds: new Set(source.notTagIds),
                    dateFilter: { ...(source.dateFilter || AppState.defaultDateFilter()) },
                    rating: { ...(source.rating || { type: 'exact', value: 0 }) }
                };
                
                if (!state.dateFilter.date) state.dateFilter.date = App.formatDateForInput(new Date());
                if (!state.dateFilter.startDate) state.dateFilter.startDate = App.formatDateForInput(new Date());
                if (!state.dateFilter.endDate) state.dateFilter.endDate = App.formatDateForInput(new Date());

                // 選択肢定義
                const genreOptions = [{value:'漫画', label:'漫画'}, {value:'ゲーム', label:'ゲーム'}, {value:'動画', label:'動画'}];
                const siteOptions = [{value:'dlsite', label:'DLsite'}, {value:'fanza', label:'FANZA'}, {value:'other', label:'その他'}];

                const content = `
                <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 class="font-semibold mb-2 text-sm text-gray-400">ジャンル (選択なし=すべて)</h4>
                            ${App.createCheckboxGroupHTML('filter-genre', genreOptions, state.genres)}
                        </div>
                        <div>
                            <h4 class="font-semibold mb-2 text-sm text-gray-400">サイト (選択なし=すべて)</h4>
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
                    
                    // チェックボックスの変更監視
                    $$('input[name="filter-genre"], input[name="filter-site"]').forEach(cb => {
                        cb.addEventListener('change', updatePreview);
                    });

                    unratedToggle.addEventListener('change', () => {
                        const isDisabled = unratedToggle.checked;
                        ratingStars.classList.toggle('opacity-50', isDisabled);
                        ratingStars.classList.toggle('pointer-events-none', isDisabled);
                        ratingTypeSelect.disabled = isDisabled;
                        updatePreview();
                    });
                    ratingTypeSelect.addEventListener('change', updatePreview);

                    // (Rating Star Logic - 同じなので省略せず記載)
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

                    // (Tag Render Logic)
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
                        App.openTagFilterModal({
                            and: tempAndTags, or: tempOrTags, not: tempNotTags,
                            onConfirm: (newTags) => {
                                if(newTags) {
                                    capturedState.andTagIds = newTags.and;
                                    capturedState.orTagIds = newTags.or;
                                    capturedState.notTagIds = newTags.not;
                                }
                                App.openFilterModal(capturedState);
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
                        localStorage.removeItem('listFilters'); // 削除時は暗号化キーも考慮して消すのがベストですが、とりあえず元のキー
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

            getSortOptions: () => {
                return [
                    { by: 'registeredAt', order: 'desc', label: '登録日 (新しい順)' }, { by: 'registeredAt', order: 'asc', label: '登録日 (古い順)' },
                    { by: 'name', order: 'asc', label: '作品名 (昇順)' }, { by: 'name', order: 'desc', label: '作品名 (降順)' },
                    { by: 'lastSelectedAt', order: 'desc', label: '抽選日 (新しい順)' }, { by: 'lastSelectedAt', order: 'asc', label: '抽選日 (古い順)' },
                    { by: 'genre', order: 'asc', label: 'ジャンル (昇順)' },
                ];
            },
            
            // --- Date Filter UI & Logic ---
            createDateFilterHTML: (context, state, isOpen = false) => { // ← 修正: isOpen 引数を追加
                const html = `
                    <div class="space-y-3">
                        <div class="flex flex-wrap gap-x-6 gap-y-2">
                            <label class="flex items-center"><input type="radio" name="date-filter-mode-${context}" value="none" class="mr-2" ${state.mode === 'none' ? 'checked' : ''}>指定なし</label>
                            <label class="flex items-center"><input type="radio" name="date-filter-mode-${context}" value="specific" class="mr-2" ${state.mode === 'specific' ? 'checked' : ''}>特定日</label>
                            <label class="flex items-center"><input type="radio" name="date-filter-mode-${context}" value="range" class="mr-2" ${state.mode === 'range' ? 'checked' : ''}>期間</label>
                        </div>
                        <div id="date-filter-specific-${context}" class="${state.mode === 'specific' ? '' : 'hidden'}">
                            ${App.createDateInputHTML(`date-filter-specific-date-${context}`, state.date)}
                        </div>
                        
                        <div id="date-filter-range-${context}" class="${state.mode === 'range' ? '' : 'hidden'}">
                            <div class="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                                ${App.createDateInputHTML(`date-filter-start-date-${context}`, state.startDate)}
                                <span class="text-center block sm:inline">～</span>
                                ${App.createDateInputHTML(`date-filter-end-date-${context}`, state.endDate)}
                            </div>
                        </div>
                        <details class="bg-gray-700 rounded-lg" ${isOpen ? 'open' : ''}> <summary class="px-3 py-2 text-xs text-gray-400 cursor-pointer">対象作品プレビュー (最大50件)</summary>
                            <div class="p-3 border-t border-gray-600">
                                <p id="date-filter-preview-count-${context}" class="text-sm mb-2">対象: 0 作品</p>
                                <div id="date-filter-preview-grid-${context}" class="date-filter-preview-grid max-h-48 overflow-y-auto">
                                    </div>
                            </div>
                        </details>
                    </div>
                `;
                return html;
            },
            
            setupDateFilterEventListeners: (context, updateCallback) => {
                 $$(`input[name="date-filter-mode-${context}"]`).forEach(radio => {
                    radio.addEventListener('change', () => {
                        const mode = radio.value;
                        // ↓↓↓ 正常に動作する index.html のロジックに戻します ↓↓↓
                        $('#date-filter-specific-' + context).classList.toggle('hidden', mode !== 'specific');
                        $('#date-filter-range-' + context).classList.toggle('hidden', mode !== 'range');
                        // ↑↑↑ 修正ここまで ↑↑↑
                        updateCallback();
                    });
                });
                const addListener = (id) => {
                    const input = $(`#${id}`);
                    if (!input) return;
                    input.addEventListener('change', updateCallback);
                    input.addEventListener('input', App.debounce(updateCallback, 300));
                };
                addListener(`date-filter-specific-date-${context}`);
                addListener(`date-filter-start-date-${context}`);
                addListener(`date-filter-end-date-${context}`);
            },
            
            // チェックボックスグループ生成ヘルパー
            createCheckboxGroupHTML: (groupName, options, selectedSet) => {
                return `
                <div class="flex flex-wrap gap-3">
                    ${options.map(opt => `
                        <label class="inline-flex items-center cursor-pointer bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors select-none">
                            <input type="checkbox" name="${groupName}" value="${opt.value}" class="form-checkbox h-4 w-4 text-sky-500 rounded border-gray-500 bg-gray-800 focus:ring-sky-500 focus:ring-offset-gray-800" ${selectedSet.has(opt.value) ? 'checked' : ''}>
                            <span class="ml-2 text-sm text-gray-200">${opt.label}</span>
                        </label>
                    `).join('')}
                </div>`;
            },
            
            createDateInputHTML: (id, value) => {
                return `<input type="text" id="${id}" value="${value}" placeholder="YYYY/MM/DD" data-role="date-input" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-500">`;
            },
            
            initializeDateInputs: (container) => {
                container.querySelectorAll('input[data-role="date-input"]').forEach(textInput => {
                    if (textInput.dataset.initialized) return;
                    textInput.dataset.initialized = 'true';
                    const validateDateInput = () => {
                        if (App.isValidDate(textInput.value) || textInput.value === '') { // 修正
                            textInput.classList.remove('border-red-500');
                        } else {
                            textInput.classList.add('border-red-500');
                        }
                    };
                    textInput.addEventListener('input', validateDateInput);
                    textInput.addEventListener('change', validateDateInput);
                });
            },
            
            getDateInputValue: (id) => {
                const input = $(`#${id}`);
                return input ? input.value : '';
            },

            // --- Lottery Logic (Moved to lottery.js) ---
            getLotteryPool: () => Lottery.getLotteryPool(App),

            openLotterySettingsModal: (tempState) => Lottery.openLotterySettingsModal(App, tempState),

            openHelpModal: () => Lottery.openHelpModal(App),

            performLottery: () => Lottery.performLottery(App),
            
            openLotteryResultModal: (work, tempState) => Lottery.openLotteryResultModal(work, App, tempState),

            openFeedbackModal: (work, tempState) => Lottery.openFeedbackModal(work, App, tempState),

            // --- Batch Registration Logic (Moved to batch.js) ---
            openBatchRegistrationModal: (keepData) => Batch.openBatchRegistrationModal(App, keepData),
            
            renderTempWorkList: () => Batch.renderTempWorkList(App),
            
            removeTempWork: (index) => Batch.removeTempWork(index, App),
            
            loadTempWorkToForm: (index) => Batch.loadTempWorkToForm(index, App),
            
            resetBatchRegForm: () => Batch.resetBatchRegForm(App),
            
            openBatchConfirmModal: () => Batch.openBatchConfirmModal(App),
            
            executeBatchSave: () => Batch.executeBatchSave(App),

            // --- Image Generator ---

            openMemoModal: (workId, memo, rating, tags, cb) => Modals.openMemoModal(workId, memo, rating, tags, cb),

            // --- Stats Dashboard Logic (Moved to stats.js) ---
            openStatsDashboardModal: () => Stats.openStatsDashboardModal(App),
            
            setupChartDefaults: () => Stats.setupChartDefaults(App),

            renderStatsOverview: () => Stats.renderStatsOverview(App),
            
            renderTrendsChart: (mode) => Stats.renderTrendsChart(mode, App),
            
            renderTrendsDetail: (key, detailData) => Stats.renderTrendsDetail(key, detailData, App),


            generateDebugData: () => {
                const newTags = [];
                const tagNames = ['アクション', 'RPG', 'ファンタジー', 'シミュレーション', 'パズル', 'アドベンチャー', 'コメディ', 'ホラー', 'ドット絵', '3D', '学園モノ', '異世界', 'ボイスあり', '放置ゲーム', 'ローグライク'];
                const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
                for (let i = 0; i < tagNames.length; i++) {
                    newTags.push({ id: `debug_tag_${i}`, name: tagNames[i], color: colors[i], useCount: Math.floor(Math.random() * 50), createdAt: Timestamp.now() }); // createdAt を追加
                }

                const newWorks = [];
                const genres = ['ゲーム', '漫画', '動画'];
                const workPrefixes = ['超次元', 'ドキドキ', '異世界転生したら', '新人', '隣の', '学園の', '魔王と', '聖なる', '禁断の', '伝説の'];
                const workSuffixes = ['プリンセス', 'クエスト', 'ハーレム物語', 'デイズ', '事件簿', 'ファンタジア', 'サバイバル', 'ロマンス', '英雄譚'];

                for (let i = 0; i < 50; i++) {
                    const randomDate = new Date(Date.now() - Math.floor(Math.random() * 365 * 2 * 24 * 60 * 60 * 1000)); // Within last 2 years
                    const numTags = Math.floor(Math.random() * 5);
                    const workTags = new Set();
                    while (workTags.size < numTags && newTags.length > 0) { // newTagsが空でないことを確認
                        workTags.add(newTags[Math.floor(Math.random() * newTags.length)].id);
                    }
                    const selectionHistory = [];
                    const selectionCount = Math.floor(Math.random() * 20);
                    for (let j = 0; j < selectionCount; j++) {
                        selectionHistory.push(Timestamp.fromDate(new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000))));
                    }
                    selectionHistory.sort((a,b) => a.toMillis() - b.toMillis());

                    const siteRoll = Math.random();
                    let url;
                    if (siteRoll < 0.45) url = 'https://www.dlsite.com/maniax/work/=/product_id/RJ12345.html';
                    else if (siteRoll < 0.8) url = 'https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_12345/';
                    else url = `https://example.com/other/${i}`; // ユニークなURLにする


                    newWorks.push({
                        id: `debug_work_${i}`,
                        name: `${workPrefixes[Math.floor(Math.random() * workPrefixes.length)]} ${workSuffixes[Math.floor(Math.random() * workSuffixes.length)]} ${i + 1}`,
                        genre: genres[Math.floor(Math.random() * genres.length)],
                        registeredAt: Timestamp.fromDate(randomDate),
                        lastSelectedAt: selectionHistory.length > 0 ? selectionHistory[selectionHistory.length -1] : null,
                        rating: Math.floor(Math.random() * 6),
                        selectionCount: selectionCount,
                        selectionHistory: selectionHistory,
                        tagIds: Array.from(workTags),
                        sourceUrl: url,
                        imageUrl: `https://placehold.co/600x400/1f2937/4b5563?text=Debug+${i+1}`
                    });
                }

                return { works: newWorks, tags: new Map(newTags.map(tag => [tag.id, tag])) }; // Map で返すように変更
            }, // ← App.generateDebugData の終わりカンマ
            
            toggleDebugMode: async () => {
                const btn = $('#toggleDebugModeBtn');
                const syncPanel = $('#sync-panel-details');
                const regPanel = $('#registration-panel-details');
                
                if (AppState.isDebugMode) { // 修正
                    // --- Exit Debug Mode ---
                    if (!await App.showConfirm("デバッグモード終了", "デバッグモードを終了します。<br>変更を反映するにはページのリロードが必要です。今すぐリロードしますか？")) return;
                    
                    AppState.isDebugMode = false; // 修正
                    $('#debug-banner').classList.add('hidden');
                    // ... (ボタンのスタイル変更) ...
                    
                    App.showToast("デバッグモードを終了しました。ページをリロードします。");
                    
                    // データをリセットする代わりに、ページ全体をリロード
                    setTimeout(() => {
                        location.reload();
                    }, 1000); // トースト表示の猶予
                } else {
                    // --- Enter Debug Mode ---
                    if (!await App.showConfirm("デバッグモード開始", "デバッグモードを開始しますか？<br>現在の接続は切れ、リフレッシュするまでテストデータが表示されます。データは保存されません。")) return; // 修正 (`...` を正しい説明文に置き換え、バッククォート `)` で閉じる)

                    AppState.isDebugMode = true; // 修正
                    $('#debug-banner').classList.remove('hidden'); // バナーを表示
                    AppState.unsubscribeWorks(); // 修正
                    AppState.unsubscribeTags(); // 修正
                    
                    const debugData = App.generateDebugData(); // 修正
                    AppState.works = debugData.works; // 修正
                    AppState.tags = debugData.tags; // 修正
                    
                    // ... (UIのスタイル変更) ...
                    
                    App.showToast("デバッグモードを開始しました。"); // 修正
                    App.renderAll(); // 修正
                }
            },

            // 1. バックアップデータ（JSON文字列）を生成する関数
            generateBackupJSON: () => {
                // タグデータを前処理 (Map -> Array)
                const tagsToSave = Array.from(AppState.tags.values()).map(tag => {
                    return {
                        ...tag,
                        createdAt: tag.createdAt ? tag.createdAt.toMillis() : null,
                        lastUsedAt: tag.lastUsedAt ? tag.lastUsedAt.toMillis() : null
                        // (Grok/ChatGPT案: 安定版 index.html の generateDebugData に合わせる)
                        // (もし安定版のタグデータ構造に lastSelectedAt がある場合は、そちらも変換してください)
                        // lastSelectedAt: tag.lastSelectedAt ? tag.lastSelectedAt.toMillis() : null
                    };
                });

                // 作品データを前処理 (Timestamp -> Milliseconds)
                const worksToSave = AppState.works.map(work => {
                    return {
                        ...work,
                        registeredAt: work.registeredAt ? work.registeredAt.toMillis() : null,
                        lastSelectedAt: work.lastSelectedAt ? work.lastSelectedAt.toMillis() : null,
                        selectionHistory: (work.selectionHistory || []).map(ts => ts.toMillis())
                    };
                });
                
                // 1つのオブジェクトにまとめる
                const backupData = {
                    version: AppState.appVersion,
                    exportedAt: new Date().toISOString(), // いつエクスポートしたか
                    syncId: AppState.syncId, // どのIDのデータか
                    tags: tagsToSave,
                    works: worksToSave
                };

                // オブジェクトをJSON文字列に変換 (null, 2 は「読みやすくインデントする」)
                return JSON.stringify(backupData, null, 2); 
            },

            // 2. データをファイルとしてダウンロードさせる関数
            downloadJSON: (jsonString, fileName) => {
                const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                
                link.setAttribute("href", url);
                link.setAttribute("download", fileName); // ファイル名を指定
                link.style.visibility = 'hidden';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                App.showToast("バックアップファイルがダウンロードされました。");
            },

            // 3. 実行用の関数 (これをボタンから呼び出す)
            handleExportBackup: () => {
                try {
                    const jsonString = App.generateBackupJSON();
                    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                    const fileName = `selector_backup_${AppState.syncId}_${dateStr}.json`;
                    
                    App.downloadJSON(jsonString, fileName);

                } catch (error) {
                    // ★ 修正: isDebugMode で分岐 ★
                    if (AppState.isDebugMode) {
                        console.error("バックアップの生成に失敗しました (Debug):", error);
                    } else {
                        console.error("バックアップの生成に失敗しました。"); // 本番では詳細を出力しない
                    }
                    App.showToast("バックアップファイルの生成に失敗しました。", "error");
                }
            },

            // --- 新しいFABメニュー制御 (main.jsのAppオブジェクト内) ---
            
            toggleFabMenu: () => {
                const menuContent = document.getElementById('fab-menu-content');
                const backdrop = document.getElementById('fab-backdrop');
                const icon = document.getElementById('fab-icon');
                
                if (!menuContent) return;

                const isClosed = menuContent.classList.contains('hidden');

                if (isClosed) {
                    // 開く
                    menuContent.classList.remove('hidden');
                    backdrop.classList.remove('hidden');
                    
                    // アニメーション
                    requestAnimationFrame(() => {
                        menuContent.classList.remove('scale-95', 'opacity-0');
                        menuContent.classList.add('scale-100', 'opacity-100');
                        backdrop.classList.remove('opacity-0');
                        backdrop.classList.add('opacity-100');
                        icon.classList.remove('fa-bars');
                        icon.classList.add('fa-times', 'rotate-90'); // ×印にして回転
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

                // 閉じるアニメーション
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
            }
        }; // --- End of App Object ---
        

        // --- 4. App Initialization (安全策を追加した修正版) ---
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                let version = 'Unknown';
                try {
                    // 1. sw.js を取得しようと試みる
                    const response = await fetch('sw.js?t=' + Date.now());
                    if (response.ok) {
                        const swText = await response.text();
                        const match = swText.match(/const APP_VERSION = '([^']+)';/);
                        if (match && match[1]) {
                            version = match[1];
                        }
                    }
                } catch (e) {
                    console.warn("バージョン情報の取得に失敗しましたが、起動を続行します:", e);
                }
                
                // 3. AppStateにバージョンを設定
                console.log('Detected App Version:', version);
                AppState.appVersion = version;
                
                // 4. アプリを初期化 (ここが失敗すると元も子もないのでtry-catchの外には出さない)
                App.init();

            } catch (error) {
                console.error("アプリの初期化に失敗:", error);
                document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
                    <b>アプリの起動に失敗しました:</b><br>
                    ${error.message}
                </div>`;
            }
        });

        // ★追加: Appをグローバルスコープに公開 (HTML内の onclick="App.～" を動かすため)
window.App = App;