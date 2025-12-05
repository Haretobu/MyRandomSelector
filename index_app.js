        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
        import { 
            getAuth, 
            signInWithEmailAndPassword, 
            onIdTokenChanged
        } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { 
            getFirestore, 
            doc, 
            getDoc, 
            setDoc, 
            updateDoc, 
            deleteDoc, 
            onSnapshot, 
            collection, 
            query, 
            writeBatch,
            Timestamp,
            serverTimestamp,
            getDocs,
            addDoc,
            arrayUnion,
            arrayRemove,
            deleteField,
            orderBy,
            limit
        } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        import { 
            getStorage, 
            ref, 
            uploadString, 
            getDownloadURL, 
            deleteObject 
        } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

        import { 
            getFunctions, 
            httpsCallable 
        } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

        
        // --- 1. UI Helper Functions ---
        // (Grok/ChatGPT案: 構造化)
        // これら2つは利便性のためにグローバルに残します
        const $ = (selector) => document.querySelector(selector);
        const $$ = (selector) => document.querySelectorAll(selector);


        // --- 2. App State ---
        // (Grok/ChatGPT案: 状態管理の集約)
        // すべてのグローバル変数をこのオブジェクトにまとめます
        const AppState = {
            firebaseApp: null,
            auth: null,
            db: null,
            
            // App Config
            DEFAULT_APP_ID: 'r18-random-selector',
            appId: typeof __app_id !== 'undefined' ? __app_id : 'r18-random-selector',
            appVersion: 'v.UNKNOWN', // バージョンを更新
            firebaseConfig: typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
                "apiKey": "AIzaSyAnlTrmb0MW8yznBxpWF6B83R9luFnGVts",
                "authDomain": "serecter222.firebaseapp.com",
                "projectId": "serecter222",
                "storageBucket": "serecter222.firebasestorage.app",
                "messagingSenderId": "1019715441654",
                "appId": "1:1019715441654:web:6caa7779148cce46c92dd7"
            },

            // State Management
            works: [],
            tags: new Map(),
            unsubscribeWorks: () => {},
            unsubscribeTags: () => {},
            syncId: '',
            currentUser: null,
            loadingTimeout: null,
            stallTimeout: null,
            isLoadComplete: false,
            loadingStatus: { auth: false, works: false, tags: false },
            listViewMode: localStorage.getItem('listViewMode') || 'grid',
            showSiteIcon: localStorage.getItem('showSiteIcon') === 'false' ? false : true,
            modalStateStack: [],
            activeCharts: {},
            isDebugMode: false,
            checkModalDirtyState: () => false,
            isLiteMode: false,

            // Image Edit State
            tempNewImageUrl: null,
            deleteImageFlag: false,

            // Filters and Sort State
            defaultDateFilter: () => ({ mode: 'none', date: '', startDate: '', endDate: '' }),
            listFilters: {
                genres: new Set(),
                sites: new Set(), // ★追加: サイトフィルタ (DLsite/FANZA/Other)
                rating: { type: 'exact', value: 0 },
                andTagIds: new Set(),
                orTagIds: new Set(),
                notTagIds: new Set(),
                dateFilter: { mode: 'none', date: '', startDate: '', endDate: '' },
                unratedOrUntaggedOnly: false,
            },
            sortState: {
                by: 'registeredAt',
                order: 'desc',
            },
            searchQuery: '',
            searchDebounceTimer: null,
            searchHistory: [], // 検索履歴を保持する配列
            maxSearchHistory: 10, // 履歴の最大保存数
            suggestions: [], // サジェスト候補を保持する配列
            isSuggestBoxOpen: false, // サジェスト/履歴ボックスの表示状態
            currentPage: 1,
            itemsPerPage: 20,
            expandedTagsWorkIds: new Set(), // (Grok/ChatGPT案: クリーンアップ) ※これは削除候補でしたが、`renderWorkCard`でまだ使われているため残します

            customPresets: [],
            tempWorks: [],           // 一時保存リスト (買い物かご)
            editingTempIndex: -1,    // 編集中のリストインデックス (-1は新規)
            isRegFormDirty: false,   // フォームの内容が変更されているか (未保存チェック用)
            // Lottery State
            lotterySettings: {
                mood: 'default',
                genres: new Set(),
                sites: new Set(), // ★追加: サイトフィルタ
                andTagIds: new Set(),
                orTagIds: new Set(),
                notTagIds: new Set(),
                dateFilter: { mode: 'none', date: '', startDate: '', endDate: '' },
                priority: 'new',
                method: 'normal',
                unratedOrUntaggedOnly: false,
            },

            // UI Elements (ここで一元管理)
            ui: {}
        };
        // listFilters.dateFilter の初期化
        AppState.listFilters.dateFilter = AppState.defaultDateFilter();
        // lotterySettings.dateFilter の初期化
        AppState.lotterySettings.dateFilter = AppState.defaultDateFilter();


        // --- 3. App Logic ---
        // (Grok/ChatGPT案: 関数のグループ化)
        // すべての関数を App オブジェクトにまとめます
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
            },

            // --- Utility Functions ---

            // ★追加: モバイル判定 (画面幅またはUserAgentで簡易判定)
            isMobile: () => {
                return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            },

            escapeHTML: (str) => {
                if (typeof str !== 'string' || !str) return '';
                return str.replace(/[&<>"']/g, function(match) {
                    return {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    }[match];
                });
            },
            // ★ 修正: 暗号化ヘルパー (方針3) ★
            encryptData: (data) => {
                if (!AppState.currentUser || !AppState.currentUser.uid || !data) return null;
                // ユーザーのUIDを秘密鍵として使用
                const secretKey = AppState.currentUser.uid;
                const jsonString = JSON.stringify(data);
                return CryptoJS.AES.encrypt(jsonString, secretKey).toString();
            },

            // ★ 修正: 復号ヘルパー (方針3) ★
            decryptData: (encryptedString) => {
                if (!AppState.currentUser || !AppState.currentUser.uid || !encryptedString) return null;
                const secretKey = AppState.currentUser.uid;
                try {
                    const bytes = CryptoJS.AES.decrypt(encryptedString, secretKey);
                    const jsonString = bytes.toString(CryptoJS.enc.Utf8);
                    if (!jsonString) return null; // 復号失敗 (キーが違うなど)
                    return JSON.parse(jsonString);
                } catch (e) {
                    if (AppState.isDebugMode) {
                        console.error("Data decryption failed (Debug):", e);
                    } else {
                        console.error("Data decryption failed.");
                    }
                    return null; // 復号失敗
                }
            },
            isValidDate: (dateString) => {
                if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateString)) return false;
                const d = new Date(dateString.replace(/\//g, '-'));
                if (isNaN(d.getTime())) return false;
                return d.toISOString().slice(0, 10).replace(/-/g, '/') === dateString;
            },

            showToast: (message, type = 'info', duration = 3000) => {
                let finalDuration = duration;
                AppState.ui.toastEl.classList.remove('bg-red-600', 'bg-gray-700');

                if (type === 'error') {
                    finalDuration = 5000; // エラー時は5秒
                    AppState.ui.toastEl.classList.add('bg-red-600'); // 色も赤くする
                } else {
                    AppState.ui.toastEl.classList.add('bg-gray-700');
                }
                AppState.ui.toastMessageEl.textContent = message;
                AppState.ui.toastEl.classList.remove('translate-y-20', 'opacity-0');
                AppState.ui.toastEl.classList.add('translate-y-0', 'opacity-100');
                setTimeout(() => {
                    AppState.ui.toastEl.classList.remove('translate-y-0', 'opacity-100');
                    AppState.ui.toastEl.classList.add('translate-y-20', 'opacity-0');
                }, finalDuration); // 変更
            },

            showConfirm: (title, message) => {
                return new Promise((resolve) => {
                    AppState.ui.confirmTitle.textContent = title;
                    AppState.ui.confirmMessage.innerHTML = message;
                    AppState.ui.confirmModal.classList.remove('hidden');

                    const okHandler = () => {
                        AppState.ui.confirmModal.classList.add('hidden');
                        AppState.ui.confirmOkBtn.removeEventListener('click', okHandler);
                        AppState.ui.confirmCancelBtn.removeEventListener('click', cancelHandler);
                        resolve(true);
                    };
                    const cancelHandler = () => {
                        AppState.ui.confirmModal.classList.add('hidden');
                        AppState.ui.confirmOkBtn.removeEventListener('click', okHandler);
                        AppState.ui.confirmCancelBtn.removeEventListener('click', cancelHandler);
                        resolve(false);
                    };
                    
                    AppState.ui.confirmOkBtn.addEventListener('click', okHandler);
                    AppState.ui.confirmCancelBtn.addEventListener('click', cancelHandler);
                });
            },

            formatDate: (timestamp, includeTime = true) => {
                if (!timestamp || !timestamp.toDate) return 'N/A';
                const date = timestamp.toDate();
                const options = {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                    hour12: false
                };
                if (!includeTime) {
                    delete options.hour;
                    delete options.minute;
                }
                return new Intl.DateTimeFormat('ja-JP', options).format(date);
            },

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
                App.startLoadingTimeout();
                setTimeout(() => { AppState.ui.loadingContent.classList.remove('opacity-0'); }, 100);
                AppState.ui.loadingText.textContent = 'Firebase 初期化中...'; // ← 具体的なテキストを追加
                App.updateLoadingProgress();
                try {
                    AppState.firebaseApp = initializeApp(AppState.firebaseConfig);
                    AppState.auth = getAuth(AppState.firebaseApp);
                    AppState.db = getFirestore(AppState.firebaseApp);
                    AppState.storage = getStorage(AppState.firebaseApp);
                    App.setupAuthObserver();
                } catch (error) {
                    // ★ 修正: isDebugMode で分岐 ★
                    if (AppState.isDebugMode) {
                        console.error("Firebase initialization failed (Debug):", error);
                    } else {
                        console.error("Firebase initialization failed."); // 本番では詳細を出力しない
                    }
                    AppState.ui.loadingContent.innerHTML = `<p class="text-red-400">Firebaseの初期化に失敗しました。</p>`;
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
            processImage: (file) => {
                return new Promise((resolve, reject) => {
                    // ★ 修正: MIMEタイプチェックを追加 (方針5準拠) ★
                    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                    if (!allowedTypes.includes(file.type)) {
                        return reject(new Error("ファイル形式が正しくありません。(JPEG, PNG, WebP のみ可)"));
                    }
                    
                    // ★ 修正: ファイルサイズチェック (既存) ★
                    if (file.size > 900 * 1024) return reject(new Error("ファイルサイズが900KBを超えています。別の画像をお試しください。"));
                    
                    const reader = new FileReader();
                    reader.onload = e => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_SIZE = 512;
                            let { width, height } = img;
                            if (width > height) {
                                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                            } else {
                                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                            resolve(canvas.toDataURL('image/jpeg', 0.8));
                        };
                        img.src = e.target.result;
                    };
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });
            },

            // --- Link Preview Logic ---
            fetchLinkPreview: async (url, containerElement) => {
                if (!url || !url.startsWith('http')) return;
                
                containerElement.innerHTML = `<div class="text-xs text-gray-400 animate-pulse py-2"><i class="fas fa-spinner fa-spin mr-2"></i>リンク情報を取得中...</div>`;
                containerElement.classList.remove('hidden');

                try {
                    const functions = getFunctions(AppState.firebaseApp, 'us-central1');
                    const getPreview = httpsCallable(functions, 'getLinkPreview');
                    
                    const result = await getPreview({ url: url });
                    const data = result.data.data;

                    if (!result.data.success || !data) {
                        containerElement.innerHTML = `<div class="text-xs text-red-400 py-1">プレビューを取得できませんでした</div>`;
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

                    // もし現在開いているのが一括登録モーダルで、タイトル欄が空なら自動入力
                    const batchNameInput = $('#batchWorkName');
                    if (batchNameInput && !batchNameInput.value && data.title) {
                        batchNameInput.value = data.title;
                        batchNameInput.dispatchEvent(new Event('input')); // 変更検知のため発火
                        App.showToast('タイトルを自動入力しました。');
                    }

                } catch (error) {
                    console.error("Link Preview Error:", error);
                    containerElement.innerHTML = `<div class="text-xs text-gray-500 py-1">プレビュー読み込みエラー: ${App.escapeHTML(error.message)}</div>`;
                }
            },

            // ★追加: Storageへのアップロード処理
            uploadImageToStorage: async (dataUrl, workId) => {
                if (!dataUrl || !dataUrl.startsWith('data:image')) return null;
                const timestamp = Date.now();
                // ファイル名を "works/同期ID/作品ID_タイムスタンプ.jpg" にする
                const path = `works/${AppState.syncId}/${workId}_${timestamp}.jpg`;
                const storageRef = ref(AppState.storage, path);
                
                await uploadString(storageRef, dataUrl, 'data_url');
                return await getDownloadURL(storageRef);
            },

            // --- CRUD Operations ---
            handleAddWork: async (e) => {
                e.preventDefault();
                if (AppState.isDebugMode) { return App.showToast("デバッグモード中は作品を登録できません。"); }
                
                const form = e.target;
                const name = form.elements.workName.value.trim();
                const registeredAtStr = App.getDateInputValue('workRegisteredAt');
                
                if (!name || !registeredAtStr) return App.showToast("作品名と登録日は必須です。");
                if (!App.isValidDate(registeredAtStr)) return App.showToast("登録日の形式が正しくありません (YYYY/MM/DD)。");
                
                const errorEl = $('#addWorkError');
                if (AppState.works.some(w => w.name.toLowerCase() === name.toLowerCase())) {
                    errorEl.textContent = `「${name}」は既に登録されています。`;
                    errorEl.classList.remove('hidden');
                    setTimeout(() => { errorEl.classList.add('hidden'); errorEl.textContent = ''; }, 4000);
                    return;
                }

                try {
                    const worksRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);
                    const newDocRef = doc(worksRef); 
                    
                    let imageUrl = null;
                    let imageFileName = null; // ★追加: ファイル名用変数

                    if (form.elements.workImage.files[0]) {
                        try {
                            const file = form.elements.workImage.files[0];
                            imageFileName = file.name; // ★追加: ファイル名を取得
                            const tempBase64 = await App.processImage(file);
                            imageUrl = await App.uploadImageToStorage(tempBase64, newDocRef.id);
                        } catch (error) { return App.showToast(error.message); }
                    }

                    const url = form.elements.workUrl.value.trim();
                    const newWork = {
                        name,
                        genre: form.elements.workGenre.value,
                        sourceUrl: url,
                        registeredAt: Timestamp.fromDate(new Date(registeredAtStr.replace(/\//g, '-'))),
                        imageUrl, 
                        imageFileName, // ★追加: 保存対象に含める
                        selectionCount: 0, rating: 0, tagIds: [], lastSelectedAt: null,
                        selectionHistory: []
                    };

                    await setDoc(newDocRef, newWork);
                    
                    App.showToast(`"${name}" を登録しました。`);
                    
                    // フォームのリセット処理（日付以外）
                    form.elements.workName.value = '';
                    form.elements.workUrl.value = '';
                    form.elements.workImage.value = '';
                    $('#imagePreview').classList.add('hidden');
                    $('#imagePreview').src = '';
                    
                    // ★変更: 日付のリセット行を削除しました (入力した日付が維持されます)

                } catch (error) {
                    if (AppState.isDebugMode) console.error("Error adding work:", error);
                    App.showToast("作品の登録に失敗しました。", "error");
                }
            },

            updateWork: async (workId, updatedData) => {
                if (AppState.isDebugMode) {
                    const workIndex = AppState.works.findIndex(w => w.id === workId);
                    if (workIndex !== -1) {
                        AppState.works[workIndex] = { ...AppState.works[workIndex], ...updatedData };
                        App.renderAll();
                    }
                    return true;
                }
                try {
                    const workRef = doc(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId);
                    await updateDoc(workRef, updatedData);
                    return true;
                } catch (error) {
                    // ★ 修正: isDebugMode で分岐 ★
                    if (AppState.isDebugMode) {
                        console.error("Error updating work (Debug):", error);
                    } else {
                        console.error("Error updating work."); // 本番では詳細を出力しない
                    }
                    App.showToast("作品の更新に失敗しました。", "error");
                    return false;
                }
            },

            deleteWork: async (workId, workName) => {
                // if (AppState.isDebugMode) { return App.showToast("デバッグモード中は作品を削除できません。"); }
                if (!await App.showConfirm("作品の削除", `「${App.escapeHTML(workName)}」を本当に削除しますか？<br>この操作は取り消せません。`)) return;
                
                try {
                    // ★追加: Storageの画像も削除
                    const work = AppState.works.find(w => w.id === workId);
                    if (work && work.imageUrl && work.imageUrl.includes('firebasestorage')) {
                        try {
                            const imageRef = ref(AppState.storage, work.imageUrl);
                            await deleteObject(imageRef);
                        } catch (e) {
                            console.log("画像削除スキップ (見つからない等):", e);
                        }
                    }

                    await deleteDoc(doc(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, workId));
                    App.showToast(`「${workName}」を削除しました。`);
                } catch (error) {
                    if (AppState.isDebugMode) console.error("Error deleting work:", error);
                    App.showToast("作品の削除に失敗しました。", "error");
                }
            },

            addTag: async (name, color) => {
                 if (AppState.isDebugMode) { return App.showToast("デバッグモード中はタグを作成できません。"); }
                 const normalizedName = name.trim().toLowerCase();
                 if ([...AppState.tags.values()].some(t => t.name.toLowerCase() === normalizedName)) {
                    App.showToast("同じ名前のタグが既に存在します。", "error"); return null;
                 }
                 const newTag = {
                    name: name.trim(), color, useCount: 0,
                    createdAt: Timestamp.now(), lastSelectedAt: null
                 };
                 try {
                    const docRef = doc(collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`));
                    await setDoc(docRef, newTag);
                    App.showToast(`タグ「${name}」を作成しました。`);
                    return { id: docRef.id, ...newTag };
                 } catch (error) {
                    // ★ 修正: isDebugMode で分岐 ★
                    if (AppState.isDebugMode) {
                        console.error("Error adding tag (Debug):", error);
                    } else {
                        console.error("Error adding tag."); // 本番では詳細を出力しない
                    }
                    App.showToast("タグの作成に失敗しました。", "error"); return null;
                 }
            },
            
            deleteTag: async (tagId) => {
                 if (AppState.isDebugMode) { return App.showToast("デバッグモード中はタグを削除できません。"); }
                 const tagToDelete = AppState.tags.get(tagId);
                 if (!tagToDelete || !await App.showConfirm("タグの削除", `タグ「${App.escapeHTML(tagToDelete.name)}」を削除しますか？<br>全ての作品からこのタグが解除されます。`)) return;
                 try {
                    const batch = writeBatch(AppState.db);
                    batch.delete(doc(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/tags`, tagId));
                    AppState.works.filter(w => w.tagIds?.includes(tagId)).forEach(work => {
                        const newTagIds = work.tagIds.filter(id => id !== tagId);
                        batch.update(doc(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`, work.id), { tagIds: newTagIds });
                    });
                    await batch.commit();
                    App.showToast(`タグ「${tagToDelete.name}」を削除しました。`);
                 } catch(error) {
                    // ★ 修正: isDebugMode で分岐 ★
                    if (AppState.isDebugMode) {
                        console.error("Error deleting tag (Debug):", error);
                    } else {
                        console.error("Error deleting tag."); // 本番では詳細を出力しない
                    }
                    App.showToast("タグの削除中にエラーが発生しました。", "error");
                 }
            },

            // --- Rendering Logic ---

            _renderRatingStars: (rating) => {
                const stars = [];
                const numRating = rating || 0;
                for (let i = 1; i <= 5; i++) {
                    if (numRating >= i) {
                        stars.push('<i class="fas fa-star text-yellow-400"></i>'); // Full
                    } else if (numRating === (i - 0.5)) {
                        stars.push('<i class="fas fa-star-half-alt text-yellow-400"></i>'); // Half
                    } else {
                        stars.push('<i class="far fa-star text-gray-500"></i>'); // Empty
                    }
                }
                return stars.join('');
            },

            _renderTagsHTML: (tagIds, maxToShow = Infinity, workId = null, viewMode = 'grid') => {
                const tagObjects = App.getTagObjects(tagIds); // App.getTagObjects を使用
                if (tagObjects.length === 0) return ''; // タグがなければ空文字

                const isExpanded = workId && AppState.expandedTagsWorkIds.has(workId); // AppState を使用
                const displayLimit = isExpanded ? Infinity : maxToShow;
                const displayedTags = tagObjects.slice(0, displayLimit);
                const hasMoreTags = tagObjects.length > maxToShow && !isExpanded;

                // Custom viewMode logic
                const gapClass = viewMode === 'list' ? 'gap-1' : 'gap-2';
                const tagPaddingClass = viewMode === 'list' ? 'px-1 py-0' : 'px-1.5 py-0.5';

                let html = displayedTags.map(tag => {
                    const safeName = App.escapeHTML(tag.name); // (安全のためエスケープ処理)
                    return `<span class="${tagPaddingClass} rounded font-semibold text-xs" style="background-color:${tag.color}; color:${App.getContrastColor(tag.color)}">${safeName}</span>`;
                }).join('');

                // ↓ 修正: 'else if (hasMoreTags && !workId)' のブロックを追加
                if (hasMoreTags && workId) {
                    // Grid view: "expand" button
                    html += ` <button data-action="toggle-tags" data-id="${workId}" class="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs">+${tagObjects.length - maxToShow}</button>`;
                } else if (isExpanded && tagObjects.length > maxToShow && workId) {
                    // Grid view: "show less" button
                    html += ` <button data-action="toggle-tags" data-id="${workId}" class="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs">一部に戻す</button>`;
                } else if (hasMoreTags && !workId) {
                    // List view: "+X" badge
                    html += ` <span class="px-1.5 py-0.5 rounded bg-gray-600 font-semibold text-xs">+${tagObjects.length - maxToShow}</span>`;
                }

                return `<div class="flex flex-wrap ${gapClass} text-xs">${html}</div>`;
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

            // ★追加: URLからサイトIDを取得
            getWorkSite: (url) => {
                if (!url) return 'other';
                if (url.includes('dlsite.com')) return 'dlsite';
                // dmm.co.jp または dmm.com を FANZA とみなす
                if (url.includes('dmm.co.jp') || url.includes('dmm.com')) return 'fanza';
                return 'other';
            },

            // ★修正: バッジ表示ロジックも更新
            getSiteBadgeHTML: (url) => {
                if (!AppState.showSiteIcon || !url) return '';
                if (url.includes('dlsite.com')) {
                    return `<span class="site-badge bg-sky-600 text-white">DL</span>`;
                }
                // dmm.co.jp または dmm.com なら FZ バッジを表示
                if (url.includes('dmm.co.jp') || url.includes('dmm.com')) {
                    return `<span class="site-badge bg-red-600 text-white">FZ</span>`;
                }
                return '';
            },

            renderWorkList: () => {
                const { ui, isLoadComplete, isDebugMode, works, listViewMode, currentPage, itemsPerPage } = AppState;
                if (!ui.workListEl) return;
                if (!isLoadComplete && !isDebugMode) return;

                const filteredWorks = App.getFilteredAndSortedWorks();
                const totalItems = filteredWorks.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

                if (currentPage > totalPages) {
                    AppState.currentPage = totalPages;
                }
                const startIndex = (AppState.currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const worksToShow = filteredWorks.slice(startIndex, endIndex);

                ui.workCountEl.textContent = `${totalItems} / ${works.length} 作品`;

                ui.viewGridBtn.classList.toggle('view-btn-active', listViewMode === 'grid');
                ui.viewListBtn.classList.toggle('view-btn-active', listViewMode === 'list');
                const isGrid = listViewMode === 'grid';
                ui.workListEl.classList.toggle('grid', isGrid);
                ui.workListEl.classList.toggle('grid-cols-1', isGrid);
                ui.workListEl.classList.toggle('md:grid-cols-2', isGrid);
                ui.workListEl.classList.toggle('xl:grid-cols-3', isGrid);
                ui.workListEl.classList.toggle('gap-6', isGrid);
                ui.workListEl.classList.toggle('space-y-2', !isGrid);

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

                ui.workListEl.innerHTML = worksToShow.map(work => isGrid ? App.renderWorkCard(work) : App.renderWorkListItem(work)).join('');

                // ページネーションの更新処理
                const topPagination = $('#pagination-controls-top');
                const bottomPagination = $('#pagination-controls');
                
                // ★修正: nullチェックを追加
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

            renderWorkCard: (work) => {
                const { expandedTagsWorkIds } = AppState;
                const safeWorkName = App.escapeHTML(work.name);
                const siteBadge = App.getSiteBadgeHTML(work.sourceUrl);

                // ★追加: 連携状態チェック & モバイル判定
                // (スマホの場合は強制的に非表示にするため、isLinked を false にするのと同等の扱いにし、HTML生成時に hidden クラスを付与)
                const isMobile = App.isMobile();
                const isLinked = work.isLocallyLinked === true;
                
                const rocketClass = isLinked 
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30" 
                    : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50";
                
                // モバイルなら hidden クラスを追加
                const rocketVisibility = isMobile ? "hidden" : "";
                
                const rocketLink = isLinked ? `href="nightowl://play?id=${work.id}"` : "";
                const rocketTitle = isLinked ? "PCで起動" : "PC連携未設定";

                return `
                <div class="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col transition-transform hover:scale-[1.02]">
                    <div class="relative">
                        <img src="${work.imageUrl || 'https://placehold.co/600x400/1f2937/4b5563?text=No+Image'}" alt="${safeWorkName}" class="w-full h-40 object-cover">
                        ${siteBadge}
                        <div class="absolute top-2 right-2 flex space-x-2">
                            <a ${rocketLink} title="${rocketTitle}" class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${rocketClass} ${rocketVisibility}">
                                <i class="fas fa-rocket text-xs"></i>
                            </a>
                            
                            <button data-action="edit" data-id="${work.id}" title="編集" class="w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ><i class="fas fa-pencil-alt text-sm"></i></button>
                            <button data-action="delete" data-id="${work.id}" data-name="${safeWorkName}" title="削除" class="w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ><i class="fas fa-trash-alt text-sm"></i></button>
                        </div>
                        <span class="absolute bottom-2 left-2 px-2 py-0.5 bg-black bg-opacity-60 text-xs rounded">${work.genre}</span>
                    </div>
                    <div class="p-4 flex flex-col flex-grow">
                        <p class="text-sm text-gray-400">${work.registeredAt ? App.formatDate(work.registeredAt, false) : 'N/A'}</p>
                        <h3 class="text-lg font-bold mt-1 mb-2 flex-grow cursor-pointer" data-action="copy-name" data-name="${safeWorkName}">${safeWorkName}</h3>
                        <div class="flex items-center space-x-1 mb-3">${App._renderRatingStars(work.rating)}</div>
                        ${App._renderTagsHTML(work.tagIds, 5, work.id, 'grid')} </div>
                </div>`;
            },

            renderWorkListItem: (work) => {
                const safeWorkName = App.escapeHTML(work.name);
                const siteBadge = App.getSiteBadgeHTML(work.sourceUrl);

                // ★追加: 連携状態チェック & モバイル判定
                const isMobile = App.isMobile();
                const isLinked = work.isLocallyLinked === true;
                
                const rocketColor = isLinked ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-gray-600 hover:bg-gray-500 opacity-50";
                const rocketVisibility = isMobile ? "hidden" : ""; // スマホなら隠す
                
                const rocketLink = isLinked ? `href="nightowl://play?id=${work.id}"` : "";
                const rocketTitle = isLinked ? "PCで起動" : "PC連携未設定";

                const imageUrl = AppState.isLiteMode
                    ? 'https://placehold.co/600x400/1f2937/4b5563?text=Lite+Mode' 
                    : (work.imageUrl || 'https://placehold.co/600x400/1f2937/4b5563?text=No+Image');
                // Liteモード時は遅延読み込みを強制
                const loadingAttr = AppState.isLiteMode ? 'loading="lazy"' : '';
                
                return `
                <div class="work-list-item">
                    <div class="relative flex-shrink-0">
                        <img src="${work.imageUrl || 'https://placehold.co/150x100/1f2937/4b5563?text=No+Img'}" alt="${safeWorkName}" class="w-20 h-16 object-cover rounded-md">
                        ${siteBadge}
                    </div>
                    <div class="flex-grow min-w-0 overflow-hidden">
                        <p class="font-bold cursor-pointer line-clamp-2" data-action="copy-name" data-name="${safeWorkName}">${safeWorkName}</p>
                        <div class="flex items-center flex-wrap gap-x-4 text-sm text-gray-400 truncate">
                            <span>${work.genre}</span><span>${work.registeredAt ? App.formatDate(work.registeredAt, false) : 'N/A'}</span>
                            <span class="flex items-center space-x-1">${App._renderRatingStars(work.rating)}</span>
                        </div>
                        ${App._renderTagsHTML(work.tagIds, 4, null, 'list')} 
                    </div>
                    <div class="flex-shrink-0 flex space-x-2">
                        <a ${rocketLink} title="${rocketTitle}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-all ${rocketColor} ${rocketVisibility}">
                            <i class="fas fa-rocket"></i>
                        </a>

                        <button data-action="edit" data-id="${work.id}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-500" ><i class="fas fa-edit"></i></button>
                        <button data-action="delete" data-id="${work.id}" data-name="${safeWorkName}" class="w-9 h-9 text-sm rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700" ><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
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

            setupInputClearButton: (inputEl, buttonEl) => {
                if (!inputEl || !buttonEl) return;

                const updateButtonVisibility = () => {
                    // 入力値が空なら 'hidden' クラスを付与
                    buttonEl.classList.toggle('hidden', inputEl.value.length === 0);
                };

                // 入力イベントでボタンの表示/非表示を切り替え
                inputEl.addEventListener('input', updateButtonVisibility);
                
                // ボタンクリックで入力値を空にし、イベントを発火
                buttonEl.addEventListener('click', (e) => {
                    e.stopPropagation(); // イベントの伝播を停止
                    inputEl.value = '';
                    // 'input'イベントを発火させ、サジェスト更新などをトリガー
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    updateButtonVisibility(); // ボタンを隠す
                    inputEl.focus(); // 入力欄にフォーカスを戻す
                });

                // 初期状態を設定
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
                const { ui } = AppState;

                ui.modalCloseBtn.addEventListener('click', App.closeModal);
                ui.modalBackdrop.addEventListener('click', App.closeModal);
                ui.slidingFabToggle.addEventListener('click', App.toggleFabMenu);
                ui.fabBackdrop.addEventListener('click', App.closeFabMenu);

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
                            'external-search-reg': () => {
                                // 登録モーダル内の検索ボタンは個別に設定されるため、ここは空でも良いか、リスト内のボタン用にする
                            }
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
                        // フィルタ削除ロジック（変更なし）
                        switch(type) {
                            case 'genre': AppState.listFilters.genres.delete(value); break;
                            case 'rating': AppState.listFilters.rating = { type: 'exact', value: 0 }; break;
                            case 'unrated': AppState.listFilters.unratedOrUntaggedOnly = false; break;
                            case 'andTag': AppState.listFilters.andTagIds.delete(value); break;
                            case 'orTag': AppState.listFilters.orTagIds.delete(value); break;
                            case 'notTag': AppState.listFilters.notTagIds.delete(value); break;
                            case 'date': AppState.listFilters.dateFilter = AppState.defaultDateFilter(); break;
                        }
                        const filtersToSave = { ...AppState.listFilters, genres: [...AppState.listFilters.genres], andTagIds: [...AppState.listFilters.andTagIds], orTagIds: [...AppState.listFilters.orTagIds], notTagIds: [...AppState.listFilters.notTagIds] };
                        localStorage.setItem('listFilters', JSON.stringify(filtersToSave));
                        AppState.currentPage = 1;
                        App.renderAll();
                    }
                });
                
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
                     }
                });

                ui.exportBackupBtn.addEventListener('click', App.handleExportBackup);
                ui.importBackupBtn.addEventListener('click', () => { App.showToast("インポート機能は現在未実装です。", "error"); });
                
                App.setupInputClearButton(ui.searchInput, $('#clear-searchInput'));

                // ★★★ 修正箇所: ここを変更しました ★★★
                // 古い ui.addWorkForm のリスナーを削除し、新しい一括登録ボタン用に追加
                const openBatchBtn = $('#open-batch-reg-modal-btn');
                if (openBatchBtn) {
                    openBatchBtn.addEventListener('click', App.openBatchRegistrationModal);
                }
                // ★★★★★★★★★★★★★★★★★★★★★★★

                // ... (以下、検索やページネーションなどの既存リスナーはそのまま維持) ...
                
                $('#toggleDebugModeBtn').addEventListener('click', App.toggleDebugMode);

                ui.searchInput.addEventListener('input', App.debounce(() => {
                    const query = ui.searchInput.value;
                    if (query.length > 0) App.renderSuggestions(query);
                    else App.renderSearchHistory();
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
                        // (サジェスト処理の中身は変更なし)
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
                
                ui.manageTagsFab.addEventListener('click', () => { App.openTagModal({ mode: 'manage', onConfirm: ()=>{} }); App.closeFabMenu(); });
                ui.statsFab.addEventListener('click', () => { App.openStatsDashboardModal(); App.closeFabMenu(); });
                ui.externalSearchFab.addEventListener('click', () => { App.openExternalSearchModal(ui.searchInput.value); App.closeFabMenu(); });
                ui.historyFab.addEventListener('click', () => { App.openHistoryModal(); App.closeFabMenu(); });
                
                ui.openLotterySettingsBtn.addEventListener('click', () => App.openLotterySettingsModal());
                ui.startLotteryBtn.addEventListener('click', App.performLottery);

                const lotteryPanel = $('#lottery-panel');
                if (lotteryPanel && ui.drawerLotteryFab) {
                    ui.drawerLotteryFab.addEventListener('click', () => {
                        lotteryPanel.scrollIntoView({ behavior: 'smooth' });
                        App.closeFabMenu();
                    });
                }
                
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
            },

            // --- Modal Implementations ---
            
            openExternalSearchModal: (prefillQuery = '') => {
                const sites = [
                    { id: 'dlsite', name: 'DLsite', color: 'bg-blue-700', hover: 'hover:bg-blue-800' },
                    { id: 'fanza', name: 'FANZA', color: 'bg-red-600', hover: 'hover:bg-red-700' },
                    { id: 'melonbooks', name: 'Melonbooks', color: 'bg-green-600', hover: 'hover:bg-green-700' },
                    { id: 'booth', name: 'Booth', color: 'bg-rose-500', hover: 'hover:bg-rose-600' }
                ];
                const safeQuery = App.escapeHTML(prefillQuery); // App.escapeHTML を使用
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

                App.openModal("外部サイトで検索", content, () => { // App.openModal を使用
                    const siteButtons = $('#external-site-buttons');
                    const searchInput = $('#externalSearchInput');

                    App.setupInputClearButton(searchInput, $('#clear-externalSearchInput'));

                    // モーダルが開いたときに検索入力欄にフォーカスを当てる
                    if (searchInput) {
                        setTimeout(() => searchInput.focus(), 100);
                    }

                    if (siteButtons) {
                        siteButtons.addEventListener('click', e => {
                            const button = e.target.closest('button[data-site]');
                            if (button) {
                                const site = button.dataset.site;
                                const query = searchInput ? searchInput.value.trim() : '';
                                App.openSearchWindow(site, query); // App.openSearchWindow を使用
                            }
                        });
                    }
                });
            },
            
            openHistoryModal: () => {
                const allHistory = [];
                AppState.works.forEach(work => { // 修正
                    if (work.selectionHistory && work.selectionHistory.length > 0) {
                        work.selectionHistory.forEach(timestamp => {
                            allHistory.push({
                                workId: work.id,
                                workName: work.name,
                                timestamp: timestamp
                            });
                        });
                    }
                });
                // ... (中身のロジックは App. や AppState. を使うように変更) ...
                // 例: formatDate(...) -> App.formatDate(...)
                // 例: closeModal() -> App.closeModal()
                // 例: openEditModal(...) -> App.openEditModal(...)

                allHistory.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
            
                let content;
                if (allHistory.length > 0) {
                    content = `
                        <div class="max-h-[60vh] overflow-y-auto pr-2">
                            <ul id="history-list-ul" class="space-y-2"> ${allHistory.map(entry => `
                                    <li>
                                        <button data-id="${entry.workId}" class="w-full text-left bg-gray-700 p-3 rounded-lg flex justify-between items-center text-sm transition-colors hover:bg-gray-600">
                                            <span class="font-semibold">${App.escapeHTML(entry.workName)}</span>
                                            <span class="text-gray-400">${App.formatDate(entry.timestamp)}</span>
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>`;
                } else {
                    content = `<div class="text-center py-10 text-gray-500"><i class="fas fa-history fa-3x"></i><p class="mt-4">まだ抽選履歴はありません。</p></div>`;
                }

                App.openModal("総合抽選履歴", content, () => {
                    const listEl = $('#history-list-ul');
                    if (!listEl) return; // コンテナがない場合は何もしない
                    listEl.addEventListener('click', e => {
                        const button = e.target.closest('button[data-id]');
                        if (button) {
                            const workId = button.dataset.id;
                            if (workId) {
                                App.closeModal(); 
                                setTimeout(() => {
                                    App.openEditModal(workId);
                                }, 300); 
                            }
                        }
                    });
                }, { size: 'max-w-3xl' });
            },

            openEditModal: (workId, tempState = null) => {
                const work = AppState.works.find(w => w.id === workId);
                if (!work) return;
                
                let currentRating = tempState?.rating ?? (work.rating || 0);
                let currentTagIds = tempState?.tagIds ?? new Set(work.tagIds || []);
                let currentMemo = tempState?.memo ?? (work.memo || '');

                const safeWorkName = App.escapeHTML(work.name);
                const safeWorkUrl = App.escapeHTML(work.sourceUrl || '');
                // ★追加: 保存されているファイル名を取得 (なければ空文字)
                const storedFileName = work.imageFileName ? App.escapeHTML(work.imageFileName) : '';
                const fileNameDisplay = storedFileName || 'ファイルが選択されていません。';

                const pool = App.getLotteryPool();
                const thisWorkInPool = pool.find(w => w.id === workId);
                const totalWeight = pool.reduce((sum, w) => sum + w.weight, 0);
                let probabilityText = thisWorkInPool 
                    ? `<span class="font-bold text-sky-400 text-base">${(totalWeight > 0 ? (thisWorkInPool.weight / totalWeight * 100).toFixed(2) : '0.00')}%</span>`
                    : `<span class="font-bold text-gray-500">対象外</span>`;

                const registeredAtStr = work.registeredAt ? App.formatDate(work.registeredAt, false) : App.formatDateForInput(new Date());
                
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
                                    <div class="flex items-center gap-2">
                                        <div class="relative flex-grow">
                                            <input type="url" id="editWorkUrl" value="${safeWorkUrl}" placeholder="https://..." class="w-full bg-gray-700 p-2 rounded-lg pr-10"> <button type="button" id="clear-editWorkUrl" class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white hidden"> <i class="fas fa-times-circle"></i></button>
                                        </div>
                                        <button type="button" id="openWorkUrlBtn" class="flex-shrink-0 w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-500" title="URLを開く" ${!safeWorkUrl ? 'disabled' : ''}><i class="fas fa-external-link-alt"></i></button>
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

                    App.setupInputClearButton(workNameInput, $('#clear-editWorkName'));
                    App.setupInputClearButton(workUrlInput, $('#clear-editWorkUrl'));

                    AppState.tempNewImageUrl = null;
                    AppState.tempNewImageFileName = null; // ★追加: 新しいファイル名の一時保存
                    AppState.deleteImageFlag = false;

                    if (pcMemoTextarea) pcMemoTextarea.addEventListener('input', () => { currentMemo = pcMemoTextarea.value; });
                    if (smMemoButton) smMemoButton.addEventListener('click', () => { App.openMemoModal(workId, currentMemo, currentRating, currentTagIds, (newMemo) => { if (newMemo !== null) { currentMemo = newMemo; App.openEditModal(workId, { rating: currentRating, tagIds: currentTagIds, memo: currentMemo }); } }); });

                    editImageDeleteBtn.addEventListener('click', () => {
                        if (confirm('本当に画像を削除しますか？')) {
                            editCurrentImagePreview.src = ''; editCurrentImagePreview.classList.add('hidden'); editImageDeleteBtn.classList.add('hidden'); editNoImagePlaceholder.classList.remove('hidden');
                            AppState.deleteImageFlag = true; AppState.tempNewImageUrl = null; AppState.tempNewImageFileName = null; editImageUpload.value = '';
                            if (editImageFilename) editImageFilename.textContent = '削除予定';
                            App.showToast("画像を削除候補にしました。", "info");
                        }
                    });

                    editImageUpload.addEventListener('change', async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        // ★追加: 同じファイル名かどうかのチェック
                        if (storedFileName && file.name === storedFileName) {
                            if (!confirm(`「${file.name}」は現在保存されている画像と同じファイル名です。\n本当にこの画像で更新しますか？`)) {
                                editImageUpload.value = '';
                                return;
                            }
                        }

                        if (editImageFilename) editImageFilename.textContent = file.name;
                        
                        try {
                            const newUrl = await App.processImage(file);
                            App.openImageCompareModal(work.imageUrl || '', newUrl);
                            AppState.tempNewImageUrl = newUrl; 
                            AppState.tempNewImageFileName = file.name; // ★追加: ファイル名保持
                        } catch (error) {
                            App.showToast(error.message, "error");
                            editImageUpload.value = ''; AppState.tempNewImageUrl = null;
                            if (editImageFilename) editImageFilename.textContent = storedFileName || 'ファイルが選択されていません。';
                        }
                    });

                    const openUrlBtn = $('#openWorkUrlBtn');
                    workUrlInput.addEventListener('input', () => { openUrlBtn.disabled = !workUrlInput.value.trim(); });
                    openUrlBtn.addEventListener('click', () => { const url = workUrlInput.value.trim(); if (url) window.open(url, '_blank', 'noopener,noreferrer'); });
                    $('#copy-edit-title-btn').addEventListener('click', () => navigator.clipboard.writeText(workNameInput.value).then(() => App.showToast(`「${workNameInput.value}」をコピーしました。`)));

                    const renderStars = r => { if(!ratingStars)return; ratingStars.innerHTML=''; for(let i=1;i<=5;i++){ const s=document.createElement('i'); s.classList.add('fa-star','cursor-pointer'); s.dataset.value=i; if(r>=i)s.classList.add('fas','text-yellow-400'); else if(r===i-0.5)s.classList.add('fas','fa-star-half-alt','text-yellow-400'); else s.classList.add('far','text-gray-500'); ratingStars.appendChild(s); }};
                    const renderTags = ids => { if(tagsContainer){ const objs=App.getTagObjects(ids); tagsContainer.innerHTML=objs.length>0?objs.map(t=>`<span class="px-2 py-1 rounded font-semibold text-xs" style="background-color:${t.color}; color:${App.getContrastColor(t.color)}">${t.name}</span>`).join(''):`<span class="text-xs text-gray-500">タグなし</span>`; }};
                    renderStars(currentRating); renderTags(currentTagIds);

                    if (ratingStars) ratingStars.addEventListener('click', e => { const s = e.target.closest('.fa-star'); if(s){ const v=parseInt(s.dataset.value,10); const h=(e.clientX-s.getBoundingClientRect().left)>(s.getBoundingClientRect().width/2); let n=h?v:v-0.5; if(currentRating===n)n=0; currentRating=n; renderStars(currentRating); }});
                    $('#editWorkAssignTagsBtn').addEventListener('click', () => App.openTagModal({ mode: 'assign', workId, currentTagIds, workName: work.name, onConfirm: (n) => { if(n)currentTagIds=n; App.openEditModal(workId, { rating: currentRating, tagIds: currentTagIds, memo: currentMemo }); } }));
                    $('#edit-cancel-btn').addEventListener('click', App.closeModal);
                    $('#edit-external-search-header')?.addEventListener('click', () => { AppState.modalStateStack.push(() => App.openEditModal(workId, { rating: currentRating, tagIds: currentTagIds, memo: currentMemo })); App.openExternalSearchModal(workNameInput.value); });

                    $('#editWorkForm').addEventListener('submit', async e => {
                        e.preventDefault();
                        if (!workNameInput.value.trim()) return App.showToast("作品名は必須です。", "error");
                        
                        const updatedData = {
                            name: workNameInput.value.trim(), sourceUrl: workUrlInput.value.trim(), genre: $('#editWorkGenre').value,
                            registeredAt: Timestamp.fromDate(new Date(App.getDateInputValue('editWorkRegisteredAt').replace(/\//g, '-'))),
                            rating: currentRating, tagIds: Array.from(currentTagIds), memo: currentMemo
                        };
                        
                        if (AppState.tempNewImageUrl) {
                            updatedData.imageUrl = AppState.tempNewImageUrl;
                            updatedData.imageFileName = AppState.tempNewImageFileName; // ★追加
                        } else if (AppState.deleteImageFlag) {
                            updatedData.imageUrl = deleteField();
                            updatedData.imageFileName = deleteField(); // ★追加
                        }

                        AppState.checkModalDirtyState = () => false;
                        if (await App.updateWork(workId, updatedData)) { App.showToast("作品情報を更新しました。"); App.closeModal(); }
                    });
                }, { size: 'max-w-5xl', headerActions: headerSearchBtn, autoFocus: false });
            },
            
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

            openTagModal: (options) => {
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
                            ${mode === 'manage' ? `
                                <button id="search-selected-tag-btn" class="w-10 h-10 rounded-lg text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700" title="選択したタグで検索" disabled>
                                    <i class="fas fa-search"></i>
                                </button>
                            ` : ''}
                            ${mode === 'assign' ? `<select id="tagFilterSelect" class="bg-gray-700 p-2 rounded-lg"><option value="all">すべて</option><option value="assigned">設定済</option><option value="unassigned">未設定</option></select>`: ''}
                            <select id="tagSortSelect" class="bg-gray-700 p-2 rounded-lg"><option value="createdAt_desc">追加順 (新しい)</option><option value="createdAt_asc">追加順 (古い)</option><option value="name_asc">名前順 (昇順)</option><option value="useCount_desc">頻度順</option></select>
                        </div>

                        ${!['manage'].includes(mode) ? `<div class="mb-4">
                            <div class="flex justify-between items-center mb-1">
                                <label class="block text-sm text-gray-400">選択中のタグ</label>
                                <button type="button" id="reset-selected-tags-btn" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700">リセット <i class="fas fa-times ml-1"></i></button>
                            </div>
                            <div id="tag-selector-preview" class="flex flex-wrap gap-2 p-2 bg-gray-900 rounded-lg min-h-[40px]"></div>
                        </div>` : ''}
                        
                        <div id="tag-list" class="flex-grow overflow-y-auto pr-2 gap-2 grid grid-cols-1 md:grid-cols-2"></div>
                        
                        ${!['manage'].includes(mode) ? `<div class="pt-4 mt-4 border-t border-gray-700 flex justify-end space-x-3"><button id="tag-modal-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button><button id="tag-modal-confirm" class="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold">決定</button></div>` : ''}
                    </div>`;

                App.openModal(titleMap[mode], content, () => {
                    let tagSearchQuery = '', tagFilter = 'all', tagSort = { by: 'createdAt', order: 'desc' };
                    const tagListEl = $('#tag-list'), tagPreviewEl = $('#tag-selector-preview');

                    // ↓ 修正: 検索ボタン用の変数を追加
                    let selectedTagForSearch = null; // 選択されたタグ名
                    const searchSelectedBtn = $('#search-selected-tag-btn'); // 新しいボタン

                    const renderTagPreview = () => {
                        if(!tagPreviewEl) return;
                        const objects = App.getTagObjects(tempSelectedTagIds);
                        tagPreviewEl.innerHTML = objects.length > 0 ? objects.map(t => `<span class="px-2 py-1 rounded text-xs" style="background-color:${t.color}; color:${App.getContrastColor(t.color)}">${App.escapeHTML(t.name)}</span>`).join('') : `<span class="text-xs text-gray-500">タグ未選択</span>`;
                    };

                    const renderTagList = () => {
                        let tagsToRender = [...AppState.tags.values()]; // 修正済み
                        if(tagSearchQuery) tagsToRender = tagsToRender.filter(t => t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()));
                        if(mode === 'assign') {
                            if (tagFilter === 'assigned') tagsToRender = tagsToRender.filter(t => tempSelectedTagIds.has(t.id));
                            if (tagFilter === 'unassigned') tagsToRender = tagsToRender.filter(t => !tempSelectedTagIds.has(t.id));
                        }
                        tagsToRender.sort((a, b) => { const o = tagSort.order === 'asc' ? 1 : -1; switch (tagSort.by) { case 'name': return a.name.localeCompare(b.name, 'ja') * o; case 'createdAt': return ((a.createdAt?.toMillis()||0) - (b.createdAt?.toMillis()||0)) * o; case 'useCount': return ((a.useCount||0) - (b.useCount||0)) * o; default: return 0; }});
                        tagListEl.innerHTML = tagsToRender.map(t => {
                            const isManageMode = mode === 'manage';
                            const isAssignMode = mode === 'assign';
                            
                            // 「管理」または「割当」モードの時のみ削除ボタンを表示
                            const deleteBtnHtml = (isManageMode || isAssignMode) ? 
                                `<button data-action="delete-tag" data-id="${t.id}" class="ml-auto text-gray-400 hover:text-red-500 px-2 shrink-0" title="タグ削除"><i class="fas fa-trash-alt"></i></button>` : '';

                            // ↓ 修正: 選択状態のクラスを決定
                            let selectedClass = '';
                            // 'manage' モードは保持している「名前」で選択状態を判断
                            if (isManageMode && selectedTagForSearch === t.name) {
                                 selectedClass = 'bg-purple-900 ring-2 ring-purple-500';
                            // 'assign'/'filter' モードは保持している「IDのSet」で判断
                            } else if (!isManageMode && tempSelectedTagIds.has(t.id)) {
                                 selectedClass = 'bg-purple-900 ring-2 ring-purple-500';
                            } else {
                                 selectedClass = 'bg-gray-700';
                            }

                            // ↓ 修正: data-name の追加 と 'truncate' の追加
                            return `<div class="tag-item flex items-center p-2 rounded-lg ${isManageMode ? 'hover:bg-gray-600' : 'cursor-pointer hover:bg-gray-600'} ${selectedClass}" data-id="${t.id}" data-name="${App.escapeHTML(t.name)}">
                                        <div class="w-4 h-4 rounded-full mr-3 shrink-0" style="background-color: ${t.color};"></div>
                                        <span class="grow font-semibold truncate">${App.escapeHTML(t.name)}</span>
                                        ${deleteBtnHtml}
                                    </div>`;
                        }).join('');
                    };

                    renderTagList();
                    if (tagPreviewEl) renderTagPreview(); // 修正: 存在確認

                    tagListEl.addEventListener('refresh-tags', renderTagList); // リフレッシュイベントをリッスン

                    $('#tagSearchInput')?.addEventListener('input', App.debounce(e => { tagSearchQuery = e.target.value; renderTagList(); }, 200));
                    $('#tagFilterSelect')?.addEventListener('change', e => { tagFilter = e.target.value; renderTagList(); });
                    $('#tagSortSelect')?.addEventListener('change', e => { const [by, order] = e.target.value.split('_'); tagSort = { by, order }; renderTagList(); });

                    $('#addTagBtn')?.addEventListener('click', async () => {
                        const nameInput = $('#newTagName');
                        if (nameInput.value) {
                            const newTag = await App.addTag(nameInput.value, $('#newTagColor').value);
                            if (newTag && mode === 'assign') { tempSelectedTagIds.add(newTag.id); renderTagList(); renderTagPreview(); }
                            nameInput.value = '';
                        }
                    });

                    // ↓ 修正: tagListEl のクリックイベントを 'manage' と 'assign'/'filter' で分岐
                    tagListEl.addEventListener('click', e => {
                        const tagItem = e.target.closest('.tag-item');
                        const deleteBtn = e.target.closest('button[data-action="delete-tag"]');

                        if (deleteBtn) { 
                            e.stopPropagation(); 
                            App.deleteTag(deleteBtn.dataset.id); 
                            // ↓ 修正: タグ削除時に選択状態をリセット
                            if (mode === 'manage') {
                                selectedTagForSearch = null;
                                if (searchSelectedBtn) searchSelectedBtn.disabled = true;
                            }
                            return; 
                        }
                        
                        if (tagItem) {
                            e.stopPropagation(); 
                            const tagId = tagItem.dataset.id;
                            const tagName = tagItem.dataset.name; // ← 修正: data-name からタグ名を取得

                            if (mode === 'manage') {
                                // (管理モード): 選択のトグルと検索ボタンの制御
                                if (selectedTagForSearch === tagName) {
                                    // 同じものをクリックしたら選択解除
                                    selectedTagForSearch = null;
                                    if (searchSelectedBtn) searchSelectedBtn.disabled = true;
                                    tagItem.classList.remove('bg-purple-900', 'ring-2', 'ring-purple-500');
                                    tagItem.classList.add('bg-gray-700');
                                } else {
                                    // 違うものをクリックしたら、他を解除してこれを選択
                                    $$('.tag-item', tagListEl).forEach(el => {
                                        el.classList.remove('bg-purple-900', 'ring-2', 'ring-purple-500');
                                        el.classList.add('bg-gray-700');
                                    });
                                    tagItem.classList.add('bg-purple-900', 'ring-2', 'ring-purple-500');
                                    tagItem.classList.remove('bg-gray-700');
                                    
                                    selectedTagForSearch = tagName;
                                    if (searchSelectedBtn) searchSelectedBtn.disabled = false;
                                }

                            } else { // 'assign' または 'filter'
                                // (割当/絞込モード): tempSelectedTagIds の Set をトグル
                                if (tempSelectedTagIds.has(tagId)) {
                                    tempSelectedTagIds.delete(tagId);
                                    tagItem.classList.remove('bg-purple-900', 'ring-2', 'ring-purple-500');
                                    tagItem.classList.add('bg-gray-700');
                                } else {
                                    tempSelectedTagIds.add(tagId);
                                    tagItem.classList.add('bg-purple-900', 'ring-2', 'ring-purple-500');
                                    tagItem.classList.remove('bg-gray-700');
                                }
                                if (tagPreviewEl) renderTagPreview(); // プレビューを更新
                            }
                        }
                    });

                    // ↓ 修正: 新しい検索ボタンのロジック
                    if (searchSelectedBtn) {
                        searchSelectedBtn.addEventListener('click', () => {
                            if (selectedTagForSearch) {
                                // 1. メインの検索ボックスに選択したタグ名を入力
                                AppState.ui.searchInput.value = selectedTagForSearch;
                                // 2. メインの検索を実行
                                App.performSearch(selectedTagForSearch);
                                // 3. モーダルを閉じる
                                App.closeModal();
                                // 4. (おまけ) メインの検索ボックスにフォーカス
                                setTimeout(() => AppState.ui.searchInput.focus(), 300); 
                                App.showToast(`タグ「${selectedTagForSearch}」で検索しました。`);
                            }
                        });
                    }

                    const resetBtn = $('#reset-selected-tags-btn');
                    if (resetBtn) {
                        resetBtn.addEventListener('click', () => {
                            tempSelectedTagIds.clear();
                            renderTagPreview();
                            renderTagList(); // リストの選択状態もリセット
                        });
                    }

                    // ↓ 修正: 'filter' モードを削除し、'assign' モードのみを想定
                    $('#tag-modal-confirm')?.addEventListener('click', () => { onConfirm(tempSelectedTagIds); }); // 決定時
                    $('#tag-modal-cancel')?.addEventListener('click', () => { onConfirm(null); }); // キャンセル時
                }, { autoFocus: false });
            }, // ← App.openTagModal の終わりカンマ
            
            openTagFilterModal: (options) => {
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
                        let tagsToRender = [...AppState.tags.values()]; // 修正済み
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
                                        <span class="grow font-semibold truncate">${App.escapeHTML(t.name)}</span>
                                    </div>`;
                        }).join('');
                    };

                    renderTagList();
                    tagListEl.addEventListener('refresh-tags', renderTagList); // リフレッシュイベントをリッスン

                    $('#tagSearchInput')?.addEventListener('input', App.debounce(e => { tagSearchQuery = e.target.value; renderTagList(); }, 200));
                    $('#tagSortSelect')?.addEventListener('change', e => { const [by, order] = e.target.value.split('_'); tagSort = { by, order }; renderTagList(); });

                    tagListEl.addEventListener('click', e => {
                        const tagItem = e.target.closest('.tag-item');
                        if (tagItem) {
                            const tagId = tagItem.dataset.id;
                            if (tempAnd.has(tagId)) {
                                tempAnd.delete(tagId);
                                tempOr.add(tagId);
                            } else if (tempOr.has(tagId)) {
                                tempOr.delete(tagId);
                                tempNot.add(tagId);
                            } else if (tempNot.has(tagId)) {
                                tempNot.delete(tagId);
                            } else {
                                tempAnd.add(tagId);
                            }
                            renderTagList(); // クリックで即時反映
                        }
                    });

                    $('#reset-tag-filters-btn').addEventListener('click', () => {
                        tempAnd.clear(); tempOr.clear(); tempNot.clear();
                        renderTagList(); // リストの選択状態もリセット
                    });

                    $('#tag-modal-confirm')?.addEventListener('click', () => { onConfirm({and: tempAnd, or: tempOr, not: tempNot}); }); // 修正: App.closeModal() を削除
                    $('#tag-modal-cancel')?.addEventListener('click', () => { onConfirm(null); }); // 修正: App.closeModal() を削除
                }, { autoFocus: false });
            },

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

            // --- Lottery Logic ---
            getLotteryPool: () => {
                const poolFilters = { ...AppState.lotterySettings }; // 修正
                let pool = App.getFilteredWorks(poolFilters); // 修正
                
                const { priority, method, mood, unratedOrUntaggedOnly } = AppState.lotterySettings; // 修正
                const now = Date.now();
                const oneDay = 1000 * 60 * 60 * 24;

                // 未選択優先の場合、まず未選択の作品をプールする
                if (method === 'decrease_unselected') {
                    const unselectedPool = pool.filter(w => (w.selectionCount || 0) === 0);
                    if (unselectedPool.length > 0) {
                        pool = unselectedPool; // プールを未選択作品のみに絞る
                    }
                    // 未選択が0件なら、全員が対象の通常のロジックに進む
                }

                return pool.map(work => {
                    let weight = 100.0;
                    
                    // 1. 登録日 (Priority)
                    if (work.registeredAt) {
                        const daysAgo = (now - work.registeredAt.toMillis()) / oneDay;
                        if (priority === 'new') {
                            weight *= Math.max(0.1, 100 / (daysAgo + 10)); // 新しいほど重い
                        } else if (priority === 'old') {
                            weight *= Math.log10(daysAgo + 10) * 50; // 古いほど重い
                        }
                    }

                    const selectionCount = work.selectionCount || 0;
                    if (method === 'normal') {
                        weight /= (selectionCount + 1); // 選ばれた回数が多いほど選ばれにくい
                    }
                    // 'decrease_unselected' は上記でプール絞り込み済み

                    // 3. 気分 (Mood) - unratedOrUntaggedOnly が false の時のみ
                    if (!unratedOrUntaggedOnly) {
                        const rating = work.rating || 0;
                        if (mood === 'favorite') {
                            const ratingWeight = [0.1, 0.2, 0.5, 1.0, 1.5, 2.0]; // 評価0～5
                            weight *= ratingWeight[rating];
                        }
                        // 'best' と 'hidden_gem' は getFilteredWorks で絞り込み済み
                    }

                    return { ...work, weight: Math.max(1, weight) }; // 最低でも重み1を保証
                });
            },

            openLotterySettingsModal: (tempState = null) => {
                const source = tempState || AppState.lotterySettings;
                const state = {
                    ...source,
                    genres: new Set(source.genres),
                    sites: new Set(source.sites), // ★追加
                    andTagIds: new Set(source.andTagIds),
                    orTagIds: new Set(source.orTagIds),
                    notTagIds: new Set(source.notTagIds),
                    dateFilter: { ...(source.dateFilter || AppState.defaultDateFilter()) }
                };
                if (!state.dateFilter.date) state.dateFilter.date = App.formatDateForInput(new Date());
                if (!state.dateFilter.startDate) state.dateFilter.startDate = App.formatDateForInput(new Date());
                if (!state.dateFilter.endDate) state.dateFilter.endDate = App.formatDateForInput(new Date());

                const genreOptions = [{value:'漫画', label:'漫画'}, {value:'ゲーム', label:'ゲーム'}, {value:'動画', label:'動画'}];
                const siteOptions = [{value:'dlsite', label:'DLsite'}, {value:'fanza', label:'FANZA'}, {value:'other', label:'その他'}];

                const content = `
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                         <h4 class="font-semibold">抽選設定</h4>
                         <div class="flex items-center gap-2">
                             <button id="lottery-apply-to-list" class="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-700 rounded-full transition-colors">リストに適用</button>
                             <button id="lottery-help-btn" class="text-gray-400 hover:text-white"><i class="fas fa-question-circle fa-lg"></i></button>
                         </div>
                    </div>
                    
                    <div class="bg-gray-900 p-3 rounded-lg">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-semibold text-sm text-gray-400">プリセット</h4>
                            <button id="save-preset-btn" class="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white"><i class="fas fa-save mr-1"></i>現在の設定を保存</button>
                        </div>
                        <div class="flex flex-wrap gap-2" id="preset-list-container">
                            </div>
                    </div>

                    <div>
                        <div class="flex items-center mb-2">
                             <input type="checkbox" id="lottery-unrated" class="h-4 w-4 rounded bg-gray-600 text-sky-500 border-gray-500 focus:ring-sky-600" ${state.unratedOrUntaggedOnly ? 'checked' : ''}>
                             <label for="lottery-unrated" class="ml-2 text-sm font-medium">未評価またはタグ未設定の作品のみ</label>
                        </div>
                    </div>
                    <div><label for="lottery-mood" class="block text-sm text-gray-400 mb-1">気分</label><select id="lottery-mood" class="w-full bg-gray-700 p-2 rounded-lg disabled:opacity-50" ${state.unratedOrUntaggedOnly ? 'disabled' : ''}><option value="default" ${state.mood==='default'?'selected':''}>問わない</option><option value="favorite" ${state.mood==='favorite'?'selected':''}>お気に入り</option><option value="best" ${state.mood==='best'?'selected':''}>最高評価</option><option value="hidden_gem" ${state.mood==='hidden_gem'?'selected':''}>隠れた名作</option></select></div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">ジャンル (選択なし=すべて)</label>
                            ${App.createCheckboxGroupHTML('lottery-genre', genreOptions, state.genres)}
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">サイト (選択なし=すべて)</label>
                            ${App.createCheckboxGroupHTML('lottery-site', siteOptions, state.sites)}
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-sm text-gray-400 mb-1">登録日優先度</label><select id="lottery-priority" class="w-full bg-gray-700 p-2 rounded-lg"><option value="new" ${state.priority==='new'?'selected':''}>新しい順</option><option value="old" ${state.priority==='old'?'selected':''}>古い順</option><option value="random" ${state.priority==='random'?'selected':''}>ランダム</option></select></div>
                        <div><label class="block text-sm text-gray-400 mb-1">抽選方法</label><select id="lottery-method" class="w-full bg-gray-700 p-2 rounded-lg"><option value="normal" ${state.method==='normal'?'selected':''}>通常</option><option value="decrease_unselected" ${state.method==='decrease_unselected'?'selected':''}>未選択優先</option></select></div>
                    </div>
                    <div><h4 class="text-sm text-gray-400 mb-1">登録日で絞り込む</h4>${App.createDateFilterHTML('lottery', state.dateFilter, true)}</div>
                    <div>
                        <h4 class="font-semibold mb-1">タグ絞り込み</h4>
                        <div id="lottery-tags-display" class="flex flex-wrap gap-2 p-2 bg-gray-900 rounded-lg min-h-[40px] mb-2"></div>
                        <button type="button" id="lottery-select-tags" class="w-full text-sm p-2 bg-gray-600 hover:bg-gray-700 rounded-lg">タグの条件を選択</button>
                    </div>
                    <div class="pt-4 flex justify-between gap-3 flex-wrap sm:flex-nowrap">
                        <button type="button" id="lottery-settings-reset" class="w-full sm:w-auto px-4 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-gray-600 hover:bg-gray-700 text-gray-100">リセット</button>
                        <div class="flex space-x-3 w-full sm:w-auto">
                            <button type="button" id="lottery-settings-cancel" class="flex-1 sm:flex-none px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button>
                            <button type="button" id="lottery-settings-save" class="flex-1 sm:flex-none px-6 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-700 text-white">保存</button>
                        </div>
                    </div>
                </div>`;

                App.openModal("抽選設定", content, () => {
                    let tempAndTags = new Set(state.andTagIds);
                    let tempOrTags = new Set(state.orTagIds);
                    let tempNotTags = new Set(state.notTagIds);

                    const getSelectedSet = (name) => {
                        const checked = [];
                        $$(`input[name="${name}"]:checked`).forEach(cb => checked.push(cb.value));
                        return new Set(checked);
                    };

                    const renderPresets = () => {
                        const container = $('#preset-list-container');
                        if (!container) return;
                        
                        const presets = [
                            { id: 'relax', name: '気分転換', type: 'default', settings: { priority: 'old', method: 'decrease_unselected', unratedOrUntaggedOnly: false, mood: 'default' } },
                            { id: 'new', name: '積みを崩す', type: 'default', settings: { priority: 'new', unratedOrUntaggedOnly: true } },
                            { id: 'masterpiece', name: '傑作', type: 'default', settings: { priority: 'random', method: 'normal', unratedOrUntaggedOnly: false, mood: 'best' } },
                            ...AppState.customPresets
                        ];

                        container.innerHTML = presets.map(p => `
                            <div class="inline-flex items-center bg-gray-700 rounded-full pl-3 pr-2 py-1 border border-gray-600">
                                <button data-preset-id="${p.id}" class="text-xs hover:text-sky-400 mr-2">${App.escapeHTML(p.name)}</button>
                                ${p.type !== 'default' ? `<button data-delete-preset="${p.id}" class="text-gray-400 hover:text-red-500 text-xs px-1"><i class="fas fa-times"></i></button>` : ''}
                            </div>
                        `).join('');
                    };
                    renderPresets();

                    const updatePreview = () => {
                        const countEl = $('#date-filter-preview-count-lottery'), gridEl = $('#date-filter-preview-grid-lottery');
                        if (!countEl || !gridEl) return;

                        const filters = {
                            unratedOrUntaggedOnly: $('#lottery-unrated').checked,
                            mood: $('#lottery-mood').value,
                            genres: getSelectedSet('lottery-genre'),
                            sites: getSelectedSet('lottery-site'),
                            andTagIds: tempAndTags, orTagIds: tempOrTags, notTagIds: tempNotTags,
                            dateFilter: {
                                mode: $(`input[name="date-filter-mode-lottery"]:checked`).value,
                                date: App.getDateInputValue('date-filter-specific-date-lottery'),
                                startDate: App.getDateInputValue('date-filter-start-date-lottery'),
                                endDate: App.getDateInputValue('date-filter-end-date-lottery')
                            }
                        };
                        const filtered = App.getFilteredWorks(filters);
                        countEl.textContent = `対象: ${filtered.length} 作品`;
                        gridEl.innerHTML = filtered.slice(0, 50).map(w => `<div class="text-center"><img src="${w.imageUrl||'https://placehold.co/100x100/1f2937/4b5563?text=?'}" alt="${App.escapeHTML(w.name)}" class="w-full h-16 object-cover rounded-md"><p class="text-xs truncate mt-1">${App.escapeHTML(w.name)}</p></div>`).join('');
                    };

                    App.setupDateFilterEventListeners('lottery', updatePreview);
                    $$('input[name="lottery-genre"], input[name="lottery-site"]').forEach(cb => cb.addEventListener('change', updatePreview));

                    const moodSelect = $('#lottery-mood');
                    const unratedToggle = $('#lottery-unrated');
                    unratedToggle.addEventListener('change', () => {
                        moodSelect.disabled = unratedToggle.checked;
                        updatePreview();
                    });
                    $('#lottery-mood').addEventListener('change', updatePreview);

                    const renderCombinedTags = () => {
                        const container = $('#lottery-tags-display');
                        if (!container) return;
                        let html = '';
                        const renderSet = (ids, className, prefix) => { [...ids].map(id => AppState.tags.get(id)).filter(Boolean).forEach(tag => { html += `<span class="px-2 py-1 rounded text-xs font-semibold ${className}">${prefix}: ${App.escapeHTML(tag.name)}</span>`; }); };
                        renderSet(tempAndTags, 'tag-item-and text-white', 'AND');
                        renderSet(tempOrTags, 'tag-item-or text-white', 'OR');
                        renderSet(tempNotTags, 'tag-item-not text-white', 'NOT');
                        container.innerHTML = html || `<span class="text-xs text-gray-500">タグ未選択</span>`;
                    };
                    renderCombinedTags();

                    // プリセット操作: 適用
                    $('#preset-list-container').addEventListener('click', async (e) => {
                        const applyBtn = e.target.closest('button[data-preset-id]');
                        const deleteBtn = e.target.closest('button[data-delete-preset]');

                        if (applyBtn) {
                            const id = applyBtn.dataset.presetId;
                            let preset = AppState.customPresets.find(p => p.id === id);
                            if (!preset) { // デフォルトプリセットの処理
                                if (id === 'relax') preset = { settings: { priority: 'old', method: 'decrease_unselected', unratedOrUntaggedOnly: false, mood: 'default' } };
                                if (id === 'new') preset = { settings: { priority: 'new', unratedOrUntaggedOnly: true } };
                                if (id === 'masterpiece') preset = { settings: { priority: 'random', method: 'normal', unratedOrUntaggedOnly: false, mood: 'best' } };
                            }
                            if (preset) {
                                // settingsにある項目だけ上書きし、他はデフォルト(空Set)にする
                                const s = preset.settings;
                                const newState = {
                                    ...AppState.lotterySettings,
                                    genres: new Set(s.genres || []), sites: new Set(s.sites || []),
                                    andTagIds: new Set(s.andTagIds || []), orTagIds: new Set(s.orTagIds || []), notTagIds: new Set(s.notTagIds || []),
                                    ...s 
                                };
                                // モーダルを開き直して適用
                                App.openLotterySettingsModal(newState);
                                App.showToast(`プリセット「${preset.name || '指定'}」を適用しました。`);
                            }
                        } else if (deleteBtn) {
                            const id = deleteBtn.dataset.deletePreset;
                            const target = AppState.customPresets.find(p => p.id === id);
                            if (target && await App.showConfirm("プリセット削除", `プリセット「${target.name}」を削除しますか？`)) {
                                AppState.customPresets = AppState.customPresets.filter(p => p.id !== id);
                                const encrypted = App.encryptData(AppState.customPresets);
                                if (encrypted) localStorage.setItem('customPresets_encrypted', encrypted);
                                renderPresets();
                                App.showToast("プリセットを削除しました。");
                            }
                        }
                    });

                    // プリセット保存
                    $('#save-preset-btn').addEventListener('click', () => {
                        const name = prompt("新しいプリセット名を入力してください:");
                        if (name) {
                            const newPreset = {
                                id: 'custom_' + Date.now(),
                                name: name,
                                settings: {
                                    unratedOrUntaggedOnly: $('#lottery-unrated').checked,
                                    mood: $('#lottery-mood').value,
                                    priority: $('#lottery-priority').value,
                                    method: $('#lottery-method').value,
                                    genres: [...getSelectedSet('lottery-genre')], // 配列で保存
                                    sites: [...getSelectedSet('lottery-site')],   // 配列で保存
                                    andTagIds: [...tempAndTags], orTagIds: [...tempOrTags], notTagIds: [...tempNotTags],
                                    // 日付フィルタは固定値以外（相対など）が難しいので今回は簡易的に保存しないか、現在値を保存
                                }
                            };
                            AppState.customPresets.push(newPreset);
                            const encrypted = App.encryptData(AppState.customPresets);
                            if (encrypted) localStorage.setItem('customPresets_encrypted', encrypted);
                            renderPresets();
                            App.showToast(`プリセット「${name}」を保存しました。`);
                        }
                    });

                    // (タグ選択、リセット、保存などの既存処理は概ね同じですが、sitesの保存を追加)
                    $('#lottery-select-tags').addEventListener('click', () => {
                        const capturedState = {
                            mood: $('#lottery-mood').value, 
                            genres: getSelectedSet('lottery-genre'), sites: getSelectedSet('lottery-site'),
                            priority: $('#lottery-priority').value, method: $('#lottery-method').value,
                            andTagIds: tempAndTags, orTagIds: tempOrTags, notTagIds: tempNotTags,
                            unratedOrUntaggedOnly: $('#lottery-unrated').checked,
                            dateFilter: { mode: $(`input[name="date-filter-mode-lottery"]:checked`).value, date: App.getDateInputValue(`date-filter-specific-date-lottery`), startDate: App.getDateInputValue(`date-filter-start-date-lottery`), endDate: App.getDateInputValue(`date-filter-end-date-lottery`) }
                        };
                        App.openTagFilterModal({
                            and: tempAndTags, or: tempOrTags, not: tempNotTags,
                            onConfirm: (newTags) => {
                                if(newTags) {
                                    capturedState.andTagIds = newTags.and;
                                    capturedState.orTagIds = newTags.or;
                                    capturedState.notTagIds = newTags.not;
                                }
                                App.openLotterySettingsModal(capturedState);
                            }
                        });
                    });

                    $('#lottery-settings-reset').addEventListener('click', () => {
                        AppState.lotterySettings = { mood: 'default', genres: new Set(), sites: new Set(), andTagIds: new Set(), orTagIds: new Set(), notTagIds: new Set(), dateFilter: AppState.defaultDateFilter(), priority: 'new', method: 'normal', unratedOrUntaggedOnly: false };
                        
                        const settingsToSave = {
                            ...AppState.lotterySettings,
                            genres: [], sites: [], andTagIds: [], orTagIds: [], notTagIds: []
                        };
                        const encryptedSettings = App.encryptData(settingsToSave);
                        if (encryptedSettings) localStorage.setItem('lotterySettings_encrypted', encryptedSettings);
                        App.renderLotterySummary();
                        App.openLotterySettingsModal();
                    });

                    const saveSettings = () => {
                        AppState.lotterySettings.unratedOrUntaggedOnly = $('#lottery-unrated').checked;
                        AppState.lotterySettings.mood = $('#lottery-mood').value;
                        AppState.lotterySettings.genres = getSelectedSet('lottery-genre');
                        AppState.lotterySettings.sites = getSelectedSet('lottery-site');
                        AppState.lotterySettings.priority = $('#lottery-priority').value;
                        AppState.lotterySettings.method = $('#lottery-method').value;
                        AppState.lotterySettings.andTagIds = tempAndTags;
                        AppState.lotterySettings.orTagIds = tempOrTags;
                        AppState.lotterySettings.notTagIds = tempNotTags;
                        const mode = $(`input[name="date-filter-mode-lottery"]:checked`).value;
                        AppState.lotterySettings.dateFilter.mode = mode;
                        if (mode === 'specific') AppState.lotterySettings.dateFilter.date = App.getDateInputValue('date-filter-specific-date-lottery');
                        else if (mode === 'range') { AppState.lotterySettings.dateFilter.startDate = App.getDateInputValue('date-filter-start-date-lottery'); AppState.lotterySettings.dateFilter.endDate = App.getDateInputValue('date-filter-end-date-lottery'); }
                        else { AppState.lotterySettings.dateFilter = AppState.defaultDateFilter(); }
                    };

                    $('#lottery-apply-to-list').addEventListener('click', () => {
                        saveSettings();
                        AppState.listFilters.genres = new Set(AppState.lotterySettings.genres);
                        AppState.listFilters.sites = new Set(AppState.lotterySettings.sites);
                        AppState.listFilters.andTagIds = new Set(AppState.lotterySettings.andTagIds);
                        AppState.listFilters.orTagIds = new Set(AppState.lotterySettings.orTagIds);
                        AppState.listFilters.notTagIds = new Set(AppState.lotterySettings.notTagIds);
                        AppState.listFilters.dateFilter = { ...AppState.lotterySettings.dateFilter };
                        AppState.listFilters.unratedOrUntaggedOnly = AppState.lotterySettings.unratedOrUntaggedOnly;

                        AppState.listFilters.rating = { type: 'exact', value: 0 };
                        if (!AppState.lotterySettings.unratedOrUntaggedOnly) {
                             if (AppState.lotterySettings.mood === 'best') AppState.listFilters.rating = { type: 'above', value: 4 };
                        }
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

                        App.renderAll();
                        App.closeModal();
                        App.showToast("抽選設定を作品リストの絞り込みに適用しました。");
                    });

                    $('#lottery-settings-save').addEventListener('click', () => {
                        saveSettings();
                        App.renderLotterySummary();
                        const settingsToSave = {
                            ...AppState.lotterySettings,
                            genres: [...AppState.lotterySettings.genres],
                            sites: [...AppState.lotterySettings.sites],
                            andTagIds: [...AppState.lotterySettings.andTagIds],
                            orTagIds: [...AppState.lotterySettings.orTagIds],
                            notTagIds: [...AppState.lotterySettings.notTagIds]
                        };
                        const encryptedSettings = App.encryptData(settingsToSave);
                        if (encryptedSettings) localStorage.setItem('lotterySettings_encrypted', encryptedSettings);
                        App.closeModal();
                    });
                    $('#lottery-settings-cancel').addEventListener('click', App.closeModal);

                    $('#lottery-help-btn').addEventListener('click', () => {
                        // ヘルプを開くときに状態を保存して開き直すロジック（省略せず記述）
                        const capturedState = {
                            mood: $('#lottery-mood').value, 
                            genres: getSelectedSet('lottery-genre'), sites: getSelectedSet('lottery-site'),
                            priority: $('#lottery-priority').value, method: $('#lottery-method').value,
                            andTagIds: tempAndTags, orTagIds: tempOrTags, notTagIds: tempNotTags,
                            unratedOrUntaggedOnly: $('#lottery-unrated').checked,
                            dateFilter: { mode: $(`input[name="date-filter-mode-lottery"]:checked`).value, date: App.getDateInputValue(`date-filter-specific-date-lottery`), startDate: App.getDateInputValue(`date-filter-start-date-lottery`), endDate: App.getDateInputValue(`date-filter-end-date-lottery`) }
                        };
                        AppState.modalStateStack.push(() => App.openLotterySettingsModal(capturedState));
                        App.openHelpModal();
                    });
                    updatePreview();
                });
            },
            
            openHelpModal: () => {
                const content = `
                    <div class="space-y-6 text-gray-300">
                        <div>
                            <h4 class="font-bold text-lg text-sky-400 mb-2">未評価またはタグ未設定の作品のみ</h4>
                            <p>このオプションを有効にすると、まだ評価がされていない(★が0個)、またはタグが1つも設定されていない作品のみが抽選対象になります。作品の整理をしたい場合に便利です。</p>
                            <p class="text-sm text-yellow-400 mt-2">※このオプションが有効な間、「気分」による絞り込みは無効になります。</p>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg text-sky-400 mb-2">気分</h4>
                            <p>特定の評価を持つ作品に絞り込んで抽選します。</p>
                            <ul class="list-disc list-inside mt-2 pl-4 space-y-1 text-sm">
                                <li><strong>問わない:</strong> 全ての作品を対象にします。</li>
                                <li><strong>お気に入り:</strong> 評価が高い作品ほど選ばれやすくなります。(★3以上推奨)</li>
                                <li><strong>最高評価:</strong> 評価が★4以上の作品のみを対象にします。</li>
                                <li><strong>隠れた名作:</strong> 評価が★2以下の作品のみを対象にします。まだ評価していない名作を探すのに役立ちます。</li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg text-sky-400 mb-2">登録日優先度</h4>
                            <p>作品の登録日に基づいて、選ばれやすさを調整します。</p>
                            <ul class="list-disc list-inside mt-2 pl-4 space-y-1 text-sm">
                                <li><strong>新しい順:</strong> 最近登録した作品ほど選ばれやすくなります。</li>
                                <li><strong>古い順:</strong> 昔に登録した作品ほど選ばれやすくなります。</li>
                                <li><strong>ランダム:</strong> 登録日は考慮されません。</li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg text-sky-400 mb-2">抽選方法</h4>
                            <p>抽選回数に基づいて、選ばれやすさを調整します。</p>
                            <ul class="list-disc list-inside mt-2 pl-4 space-y-1 text-sm">
                                <li><strong>通常:</strong> 既に選ばれたことがある作品は、選ばれた回数に応じて少しずつ選ばれにくくなります。</li>
                                <li><strong>未選択優先:</strong> まだ一度も選ばれていない作品を最優先で抽選します。全ての作品が一度は選ばれるまで、既に選ばれた作品はほとんど選ばれません。</li>
                            </ul>
                        </div>
                    </div>
                `;
                App.openModal("ヘルプ：抽選設定", content); // App.openModal を使用
            },

            // --- Batch Registration Logic ---

            openBatchRegistrationModal: () => {
                // 状態のリセット
                AppState.tempWorks = [];
                AppState.editingTempIndex = -1;
                AppState.isRegFormDirty = false;

                const content = `
                    <div class="flex flex-col lg:flex-row h-[75vh] gap-4">
                        <div class="w-full lg:w-7/12 flex flex-col overflow-y-auto pr-2">
                            <h4 class="text-lg font-bold text-lime-400 mb-3"><i class="fas fa-pen mr-2"></i>作品情報を入力</h4>
                            <form id="batchRegForm" class="space-y-4 flex-grow">
                                <div class="relative">
                                    <label class="block text-sm font-medium text-gray-400 mb-1">作品名 <span class="text-red-500">*</span></label>
                                    <div class="flex items-center gap-2">
                                        <div class="relative flex-grow">
                                            <input type="text" id="batchWorkName" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-lime-500 pr-8" placeholder="作品名を入力..." autocomplete="off">
                                            <button type="button" id="clear-batchWorkName" class="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-white hidden"><i class="fas fa-times-circle"></i></button>
                                        </div>
                                        <button type="button" id="batch-external-search-btn" class="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white flex items-center justify-center" title="外部検索"><i class="fas fa-globe-asia"></i></button>
                                    </div>
                                    <div id="batch-suggest-container" class="relative"></div>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-400 mb-1">作品URL (任意)</label>
                                    <div class="relative">
                                        <input type="url" id="batchWorkUrl" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-lime-500 pr-8" placeholder="https://..." autocomplete="off">
                                        <button type="button" id="clear-batchWorkUrl" class="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-white hidden"><i class="fas fa-times-circle"></i></button>
                                    </div>
                                    <div id="batch-url-preview-box" class="hidden mt-2"></div>
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-400 mb-1">ジャンル <span class="text-red-500">*</span></label>
                                        <select id="batchWorkGenre" class="w-full bg-gray-700 border border-gray-600 rounded-lg p-2">
                                            <option value="漫画">漫画</option>
                                            <option value="ゲーム">ゲーム</option>
                                            <option value="動画">動画</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-400 mb-1">登録日 <span class="text-red-500">*</span></label>
                                        ${App.createDateInputHTML('batchWorkRegisteredAt', App.formatDateForInput(new Date()))}
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-400 mb-1">画像 (任意)</label>
                                    <div class="flex items-center gap-3">
                                        <label class="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm">
                                            <i class="fas fa-image mr-1"></i> 選択
                                            <input type="file" id="batchWorkImage" accept="image/jpeg,image/png,image/webp" class="hidden">
                                        </label>
                                        <span id="batch-image-filename" class="text-xs text-gray-400 truncate flex-1">未選択</span>
                                        <button type="button" id="batch-image-clear-btn" class="text-gray-400 hover:text-red-400 hidden"><i class="fas fa-trash"></i></button>
                                    </div>
                                    <div id="batch-image-preview-container" class="mt-2 hidden">
                                        <img id="batch-image-preview" src="" class="max-h-32 rounded-lg border border-gray-600">
                                    </div>
                                </div>
                                
                                <div class="mt-auto pt-4 flex gap-3">
                                    <button type="button" id="batch-clear-form-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm">クリア</button>
                                    <button type="submit" id="batch-add-list-btn" class="flex-grow px-4 py-3 bg-lime-600 hover:bg-lime-700 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95">
                                        <i class="fas fa-cart-plus mr-2"></i>リストに追加
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div class="w-full lg:w-5/12 bg-gray-900 rounded-xl p-3 flex flex-col h-full border border-gray-700">
                            <div class="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                                <h4 class="font-bold text-sky-400"><i class="fas fa-list-ul mr-2"></i>登録予定リスト</h4>
                                <span id="batch-list-count" class="bg-gray-700 text-xs px-2 py-1 rounded-full">0件</span>
                            </div>
                            <div id="batch-temp-list" class="flex-grow overflow-y-auto space-y-2 pr-1 mb-3 custom-scrollbar">
                                <div class="text-center py-10 text-gray-500 text-sm">
                                    リストは空です。<br>左側で入力して追加してください。
                                </div>
                            </div>
                            <button id="batch-finalize-btn" class="w-full py-3 bg-sky-600 hover:bg-sky-700 rounded-lg font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                確定画面へ進む <i class="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>
                    </div>
                `;

                App.openModal("作品の一括登録", content, () => {
                    // 初期化
                    App.initializeDateInputs($('#batchRegForm'));
                    App.renderTempWorkList();

                    const form = $('#batchRegForm');
                    const nameInput = $('#batchWorkName');
                    const urlInput = $('#batchWorkUrl');
                    const imageInput = $('#batchWorkImage');
                    const addBtn = $('#batch-add-list-btn');
                    
                    // --- 1. Event Listeners ---

                    // ダーティフラグ管理 (入力したら「未保存」状態にする)
                    const setDirty = () => { AppState.isRegFormDirty = true; };
                    nameInput.addEventListener('input', setDirty);
                    urlInput.addEventListener('input', setDirty);
                    $('#batchWorkGenre').addEventListener('change', setDirty);
                    imageInput.addEventListener('change', setDirty);
                    
                    // Input Clear Buttons
                    App.setupInputClearButton(nameInput, $('#clear-batchWorkName'));
                    App.setupInputClearButton(urlInput, $('#clear-batchWorkUrl'));

                    // URL Preview Listener
                    const previewBox = $('#batch-url-preview-box');
                    urlInput.addEventListener('blur', () => {
                        const url = urlInput.value.trim();
                        if (url) App.fetchLinkPreview(url, previewBox); // 既存のプレビュー関数を流用
                        else { previewBox.innerHTML = ''; previewBox.classList.add('hidden'); }
                    });

                    // Image Handling
                    let tempImageData = null; // { base64, file, fileName }
                    imageInput.addEventListener('change', async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            try {
                                const base64 = await App.processImage(file);
                                tempImageData = { base64, file, fileName: file.name };
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
                        tempImageData = null;
                        $('#batch-image-filename').textContent = "未選択";
                        $('#batch-image-preview-container').classList.add('hidden');
                        $('#batch-image-clear-btn').classList.add('hidden');
                        setDirty();
                    });

                    // 外部検索ボタン
                    $('#batch-external-search-btn').addEventListener('click', () => {
                        App.openExternalSearchModal(nameInput.value);
                        // モーダルスタック処理が必要ならここに追加
                    });

                    // リストに追加 (Add / Update)
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        const name = nameInput.value.trim();
                        const dateStr = App.getDateInputValue('batchWorkRegisteredAt');

                        if (!name) return App.showToast("作品名は必須です。", "error");
                        if (!App.isValidDate(dateStr)) return App.showToast("日付形式が不正です。", "error");

                        const newItem = {
                            name: name,
                            url: urlInput.value.trim(),
                            genre: $('#batchWorkGenre').value,
                            registeredAtStr: dateStr, // 文字列で保持し、確定時にTimestamp化
                            imageData: tempImageData, // 画像データ一式
                            site: App.getWorkSite(urlInput.value.trim()) // サイト判定
                        };

                        if (AppState.editingTempIndex >= 0) {
                            // 更新モード
                            AppState.tempWorks[AppState.editingTempIndex] = newItem;
                            App.showToast("リストの内容を更新しました。");
                        } else {
                            // 新規追加モード
                            // 重複チェック (リスト内)
                            if (AppState.tempWorks.some(w => w.name === newItem.name)) {
                                return App.showToast("その作品名は既にリストにあります。", "error");
                            }
                            AppState.tempWorks.push(newItem);
                            App.showToast("リストに追加しました。続けて入力できます。");
                        }

                        // フォームリセット & 状態更新
                        App.resetBatchRegForm(); 
                        App.renderTempWorkList();
                    });

                    // フォームクリアボタン
                    $('#batch-clear-form-btn').addEventListener('click', () => {
                         App.resetBatchRegForm();
                         App.showToast("フォームをクリアしました（新規入力モード）");
                    });

                    // 確定画面へ
                    $('#batch-finalize-btn').addEventListener('click', () => {
                        if (AppState.tempWorks.length === 0) return;
                        if (AppState.isRegFormDirty) {
                             if (!confirm("フォームに入力中の内容があります（未追加）。\n破棄して確定画面に進みますか？\n（追加する場合は「キャンセル」して「リストに追加」を押してください）")) {
                                 return;
                             }
                        }
                        App.openBatchConfirmModal();
                    });

                }, { size: 'max-w-7xl' }); // Wide modal
            },

            // リストの描画
            renderTempWorkList: () => {
                const listEl = $('#batch-temp-list');
                const countEl = $('#batch-list-count');
                const finalizeBtn = $('#batch-finalize-btn');
                const addBtn = $('#batch-add-list-btn');

                if (!listEl) return;

                countEl.textContent = `${AppState.tempWorks.length}件`;
                finalizeBtn.disabled = AppState.tempWorks.length === 0;

                // ボタンのラベル更新
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
                    const activeClass = isEditing ? 'border-amber-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700';
                    const imgUrl = work.imageData ? work.imageData.base64 : 'https://placehold.co/100x100/374151/9ca3af?text=No+Img';
                    const siteBadge = App.getSiteBadgeHTML(work.url); // 既存のバッジロジック

                    return `
                    <div class="flex items-center gap-3 p-2 rounded-lg border ${activeClass} transition-colors group relative">
                        <img src="${imgUrl}" class="w-12 h-12 rounded object-cover flex-shrink-0 bg-gray-900">
                        <div class="flex-grow min-w-0 cursor-pointer" onclick="App.loadTempWorkToForm(${index})">
                            <div class="flex items-center gap-2">
                                <p class="font-bold text-sm truncate ${isEditing ? 'text-amber-400' : 'text-gray-200'}">${App.escapeHTML(work.name)}</p>
                                ${siteBadge}
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
            },

            // リスト項目の削除
            removeTempWork: (index) => {
                // 削除時に確認は不要（UX向上のためサクサク消せるようにする、もしくは confirm 入れても良い）
                // if (!confirm("削除しますか？")) return;
                
                AppState.tempWorks.splice(index, 1);
                
                // 編集中のものを削除した場合、編集モードを解除
                if (AppState.editingTempIndex === index) {
                    App.resetBatchRegForm();
                } else if (AppState.editingTempIndex > index) {
                    // 削除した分インデックスをずらす
                    AppState.editingTempIndex--;
                }
                
                App.renderTempWorkList();
            },

            // リスト項目の読み込み (編集モードへ)
            loadTempWorkToForm: async (index) => {
                // ダーティチェック
                if (AppState.isRegFormDirty && AppState.editingTempIndex !== index) {
                    if (!await App.showConfirm("未保存の変更", "フォームに入力中の内容があります。\n破棄してこの作品を読み込みますか？")) {
                        return;
                    }
                }

                const work = AppState.tempWorks[index];
                AppState.editingTempIndex = index;
                AppState.isRegFormDirty = false; // 読み込んだ直後はClean

                $('#batchWorkName').value = work.name;
                $('#batchWorkUrl').value = work.url;
                $('#batchWorkGenre').value = work.genre;
                $('#batchWorkRegisteredAt').value = work.registeredAtStr;
                
                // 画像復元
                if (work.imageData) {
                    $('#batch-image-filename').textContent = work.imageData.fileName;
                    $('#batch-image-preview').src = work.imageData.base64;
                    $('#batch-image-preview-container').classList.remove('hidden');
                    $('#batch-image-clear-btn').classList.remove('hidden');
                    // file input 自体には値を設定できないので、内部状態 (tempImageData) は submit 時に work.imageData から再利用するロジックが必要
                    // 簡易的にUI上で「画像設定済み」とわかるようにする
                } else {
                    $('#batch-image-filename').textContent = "未選択";
                    $('#batch-image-preview-container').classList.add('hidden');
                    $('#batch-image-clear-btn').classList.add('hidden');
                }
                
                // URLプレビューのリセット
                $('#batch-url-preview-box').innerHTML = '';
                $('#batch-url-preview-box').classList.add('hidden');
                
                App.renderTempWorkList(); // アクティブ表示更新
                App.showToast(`「${work.name}」を編集します。`);
            },

            // フォームリセット
            resetBatchRegForm: () => {
                AppState.editingTempIndex = -1;
                AppState.isRegFormDirty = false;
                
                $('#batchWorkName').value = '';
                $('#batchWorkUrl').value = '';
                // ジャンルと日付は利便性のため残す（連続登録しやすくする）
                // $('#batchWorkGenre').value = '漫画'; 
                // $('#batchWorkRegisteredAt').value = ...;
                
                $('#batchWorkImage').value = '';
                $('#batch-image-filename').textContent = "未選択";
                $('#batch-image-preview-container').classList.add('hidden');
                $('#batch-image-clear-btn').classList.add('hidden');
                $('#batch-url-preview-box').innerHTML = '';
                $('#batch-url-preview-box').classList.add('hidden');

                App.renderTempWorkList();
            },

            // 最終確認モーダル
            openBatchConfirmModal: () => {
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
                                        const siteBadge = App.getSiteBadgeHTML(work.url);
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

                // 現在のモーダルを一時的に隠すのではなく、スタックに積んで新しいモーダルを開く
                // (App.openModalは既存の内容を上書きするため、ここではスタック管理が面倒。
                //  シンプルに「戻る」ボタンで openBatchRegistrationModal を再呼び出し（状態は AppState.tempWorks にあるので復元可）する方式にします)
                
                App.openModal("一括登録の確認", content, () => {
                    $('#batch-confirm-back').addEventListener('click', () => {
                        // 編集画面に戻る (状態はメモリにあるのでそのまま再描画)
                        App.openBatchRegistrationModal();
                        // リストは維持されているが、フォーム入力中だった内容は消えるため、再描画後にリセット
                        // (UX的には入力中のものを復元するのがベストだが、複雑化回避のためフォームはクリア状態とする)
                    });

                    $('#batch-confirm-save').addEventListener('click', App.executeBatchSave);
                }, { size: 'max-w-4xl' });
            },

            // 一括保存実行
            executeBatchSave: async () => {
                const btn = $('#batch-confirm-save');
                btn.disabled = true;
                btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>保存中...`;

                const total = AppState.tempWorks.length;
                let successCount = 0;
                let failCount = 0;

                try {
                    const batch = writeBatch(AppState.db);
                    const worksCollectionRef = collection(AppState.db, `/artifacts/${AppState.appId}/public/data/r18_works_sync/${AppState.syncId}/items`);

                    // 1. 各作品の処理 (画像アップロードは非同期、Firestore書き込みはバッチ)
                    // Storageアップロードは並列で行う
                    const promises = AppState.tempWorks.map(async (work) => {
                        const newDocRef = doc(worksCollectionRef);
                        let imageUrl = null;
                        let imageFileName = null;

                        // 画像がある場合、アップロード
                        if (work.imageData) {
                            try {
                                imageUrl = await App.uploadImageToStorage(work.imageData.base64, newDocRef.id);
                                imageFileName = work.imageData.fileName;
                            } catch (e) {
                                console.error(`Image upload failed for ${work.name}:`, e);
                                // 画像失敗しても作品自体は登録する方針
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
                    
                    // 状態クリア
                    AppState.tempWorks = [];
                    AppState.editingTempIndex = -1;
                    AppState.isRegFormDirty = false;
                    
                    // モーダルを閉じてリスト更新
                    App.closeModal();
                    
                    // Firestoreリスナーが自動更新するはずだが、念のため
                    // (onSnapshotが発火する)

                } catch (error) {
                    console.error("Batch save error:", error);
                    App.showToast("保存中にエラーが発生しました。", "error");
                    btn.disabled = false;
                    btn.innerHTML = `<i class="fas fa-check-circle mr-2"></i>確定して保存`;
                }
            },

            openMemoModal: (workId, currentMemo, currentRating, currentTagIds, onConfirm) => { 
                // ★ 修正: modalStateStack を使わない (openTagModal と同じ方式にする)
                // const capturedState = { ... };
                // AppState.modalStateStack.push(...); // ★ この3行を削除

                const content = `
                    <div class="flex flex-col h-[60vh]">
                        <textarea id="memo-editor-textarea" class="w-full h-full bg-gray-700 p-3 rounded-lg text-sm flex-grow" placeholder="感想やメモ...">${currentMemo}</textarea>
                        <div class="pt-4 mt-4 border-t border-gray-700 flex justify-end">
                            <button id="memo-modal-save" class="px-6 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold">決定</button>
                        </div>
                    </div>
                `;
                
                App.openModal("メモを編集", content, () => {
                    const textarea = $('#memo-editor-textarea');
                    setTimeout(() => textarea.focus(), 100); 

                    $('#memo-modal-save').addEventListener('click', () => {
                        onConfirm(textarea.value); // 1. コールバックを呼ぶ
                    });
                });
            },

            performLottery: async () => {
                const weightedPool = App.getLotteryPool(); // 修正
                if (weightedPool.length === 0) return App.showToast("抽選対象の作品がありません。"); // 修正
                
                const totalWeight = weightedPool.reduce((sum, work) => sum + work.weight, 0);
                if (totalWeight <= 0) return App.showToast("抽選対象の作品がありません (重み合計が0以下)。"); // 修正

                let random = Math.random() * totalWeight;
                let selectedWork = weightedPool.find(work => (random -= work.weight) <= 0) || weightedPool[weightedPool.length - 1];
                
                localStorage.setItem('lastSelectedWorkId', selectedWork.id);
                if (!AppState.isDebugMode) { // 修正
                    const newHistoryEntry = Timestamp.now();
                    await App.updateWork(selectedWork.id, {  // 修正
                        selectionCount: (selectedWork.selectionCount || 0) + 1, 
                        lastSelectedAt: newHistoryEntry,
                        selectionHistory: arrayUnion(newHistoryEntry)
                    });
                } else {
                     const workIndex = AppState.works.findIndex(w => w.id === selectedWork.id);
                     if (workIndex !== -1) {
                        AppState.works[workIndex].selectionCount = (AppState.works[workIndex].selectionCount || 0) + 1;
                        const now = Timestamp.now(); // Use Firestore Timestamp for consistency
                        AppState.works[workIndex].lastSelectedAt = now;
                        if (!AppState.works[workIndex].selectionHistory) {
                            AppState.works[workIndex].selectionHistory = [];
                        }
                        // Ensure selectionHistory is an array before pushing
                        if (Array.isArray(AppState.works[workIndex].selectionHistory)) {
                           AppState.works[workIndex].selectionHistory.push(now);
                        } else {
                           // Handle case where selectionHistory might not be an array (though unlikely)
                           console.warn(`selectionHistory for work ${selectedWork.id} was not an array. Resetting.`);
                           AppState.works[workIndex].selectionHistory = [now];
                        }
                     }
                }
                App.openLotteryResultModal(selectedWork); // 修正
            },
            
            openLotteryResultModal: (work, tempState = null) => {
                let currentRating = tempState?.rating ?? (work.rating || 0);
                let currentTagIds = tempState?.tagIds ?? new Set(work.tagIds || []);

                const siteBadge = App.getSiteBadgeHTML(work.sourceUrl);

                const getFormState = () => ({
                    rating: currentRating,
                    tagIds: JSON.stringify([...currentTagIds].sort())
                });
                const initialState = getFormState();
                AppState.checkModalDirtyState = () => JSON.stringify(initialState) !== JSON.stringify(getFormState()); 

                const content = `
                    <div class="text-center">
                        <div class="relative inline-block">
                            <img src="${work.imageUrl || 'https://placehold.co/600x400/1f2937/4b5563?text=No+Image'}" alt="${work.name}" class="max-w-full max-h-48 object-contain mx-auto rounded-lg shadow-lg mb-4">
                            ${siteBadge}
                        </div>
                        <p class="text-lg font-bold text-sky-300">${work.genre}</p>
                        <div class="flex items-center justify-center gap-2 my-2">
                            <h3 class="text-3xl font-bold text-white">${App.escapeHTML(work.name)}</h3>
                            <button id="copy-result-title-btn" class="p-2 text-gray-400 hover:text-white transition-colors" title="タイトルをコピー">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="mt-6 space-y-4">
                        <div><label class="block text-center text-sm text-gray-400 mb-2">評価</label><div class="flex items-center justify-center space-x-2 text-3xl" id="result-rating"></div></div>
                        <div><label class="block text-center text-sm text-gray-400 mb-1">タグ</label><div id="result-tags" class="flex flex-wrap justify-center gap-2 p-2 bg-gray-900 rounded-lg min-h-[40px] mb-2"></div><button type="button" id="result-assign-tags-btn" class="w-full text-sm p-2 bg-gray-600 hover:bg-gray-700 rounded-lg">タグを割り当て/編集</button></div>
                    </div>
                    
                    <div class="pt-6 mt-6 border-t border-gray-700 flex justify-between gap-3 flex-wrap sm:flex-nowrap">
                        <div class="flex gap-2 w-full sm:w-auto">
                            <button id="lottery-reroll" class="flex-1 sm:flex-none px-6 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg font-semibold">もう一度抽選</button>
                            
                            ${(work.isLocallyLinked && !App.isMobile()) ? `
                            <a href="nightowl://play?id=${work.id}" class="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold text-white flex items-center justify-center no-underline shadow-lg shadow-indigo-500/30" title="PCランチャーで起動">
                                <i class="fas fa-rocket mr-2"></i>起動
                            </a>
                            ` : ''}
                            
                        </div>

                        <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                            <button id="result-edit-details-btn" class="w-full sm:w-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">詳細編集</button>
                            
                            <button id="result-close-btn" class="w-full sm:w-auto px-4 py-2 rounded-lg transition-colors font-semibold bg-gray-600 hover:bg-gray-700 text-gray-100">閉じる</button>
                            
                            <button id="result-save-btn" class="w-full sm:w-auto px-4 py-2 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-700 text-white">保存</button>
                        </div>
                    </div>`;

                const onModalOpen = () => {
                    const ratingStars = $('#result-rating');
                    const tagsContainer = $('#result-tags'); 

                    const renderStars = r => {
                        if (!ratingStars) return;
                        ratingStars.innerHTML = ''; 
                        for (let i = 1; i <= 5; i++) {
                            const starIcon = document.createElement('i');
                            starIcon.classList.add('fa-star', 'cursor-pointer');
                            starIcon.dataset.value = i;
                            
                            if (r >= i) {
                                starIcon.classList.add('fas', 'text-yellow-400'); 
                            } else if (r === (i - 0.5)) {
                                starIcon.classList.add('fas', 'fa-star-half-alt', 'text-yellow-400'); 
                            } else {
                                starIcon.classList.add('far', 'text-gray-500'); 
                            }
                            ratingStars.appendChild(starIcon);
                        }
                    };
                    renderStars(currentRating);
                    if (ratingStars) { 
                        ratingStars.addEventListener('click', e => {
                            const star = e.target.closest('.fa-star');
                            if (star) {
                                const value = parseInt(star.dataset.value, 10);
                                const rect = star.getBoundingClientRect();
                                const isRightHalf = (e.clientX - rect.left) > (rect.width / 2);
                                let newRating = isRightHalf ? value : value - 0.5;
                                if (currentRating === newRating) { newRating = 0; }
                                currentRating = newRating;
                                renderStars(currentRating);
                            }
                        });
                    }

                    const renderTags = ids => {
                        if (tagsContainer) { 
                            const objects = App.getTagObjects(ids); 
                            tagsContainer.innerHTML = objects.length > 0 ? objects.map(t => `<span class="px-2 py-1 rounded text-xs" style="background-color:${t.color};color:${App.getContrastColor(t.color)}">${App.escapeHTML(t.name)}</span>`).join('') : `<span class="text-xs text-gray-500">タグなし</span>`; 
                        }
                    };
                    renderTags(currentTagIds);

                    $('#result-assign-tags-btn').addEventListener('click', () => {
                        App.openTagModal({ 
                            mode: 'assign', workId: work.id, currentTagIds, workName: work.name,
                            onConfirm: (newIds) => {
                                if(newIds !== null) { currentTagIds = newIds; }
                                App.openLotteryResultModal(work, { rating: currentRating, tagIds: currentTagIds }); 
                            }
                        });
                    });

                    $('#copy-result-title-btn').addEventListener('click', () => {
                        navigator.clipboard.writeText(work.name).then(() => { App.showToast(`「${work.name}」をコピーしました。`); })
                        .catch(err => { console.error('Copy failed: ', err); App.showToast('コピーに失敗しました。', 'error'); });
                    });

                    $('#lottery-reroll').addEventListener('click', () => {
                        AppState.checkModalDirtyState = () => false; 
                        App.updateWork(work.id, { rating: currentRating, tagIds: Array.from(currentTagIds) })
                            .then(() => App.performLottery()); 
                    });

                    $('#result-edit-details-btn').addEventListener('click', async () => {
                        if (!AppState.checkModalDirtyState()) {
                            App.closeModal(); setTimeout(() => App.openEditModal(work.id), 300); return;
                        }
                        const confirmed = await App.showConfirm("評価の保存", "評価/タグが変更されています。保存して詳細編集に進みますか？<br>（「キャンセル」を選ぶと、変更を破棄して詳細編集に進みます）");
                        if (confirmed) {
                            await App.updateWork(work.id, { rating: currentRating, tagIds: Array.from(currentTagIds) });
                            App.closeModal(); setTimeout(() => App.openEditModal(work.id), 300);
                        }
                    });

                    $('#result-close-btn').addEventListener('click', App.closeModal); 
                    $('#result-save-btn').addEventListener('click', async () => {
                        AppState.checkModalDirtyState = () => false; 
                        if (await App.updateWork(work.id, { rating: currentRating, tagIds: Array.from(currentTagIds) })) { 
                            App.showToast(`「${work.name}」の情報を更新しました。`); App.closeModal(); 
                        }
                    });
                };

                if (!AppState.ui.modalWrapper.classList.contains('hidden') && AppState.ui.modalTitle.textContent === "抽選結果") { 
                    AppState.ui.modalContentHost.innerHTML = content; 
                    App.initializeDateInputs(AppState.ui.modalContentHost); 
                    onModalOpen();
                } else {
                    App.openModal("抽選結果", content, onModalOpen); 
                }
            },

            openFeedbackModal: (work, tempState = null) => {
                let currentRating = tempState?.rating ?? (work.rating || 0);
                let currentTagIds = tempState?.tagIds ?? new Set(work.tagIds || []);

                const getFormState = () => ({
                    rating: currentRating,
                    tagIds: JSON.stringify([...currentTagIds].sort())
                });
                const initialState = getFormState();
                AppState.checkModalDirtyState = () => JSON.stringify(initialState) !== JSON.stringify(getFormState()); // AppState を使用

                const content = `
                    <div class="text-center">
                        <img src="${work.imageUrl || 'https://placehold.co/600x400/1f2937/4b5563?text=No+Image'}" alt="${App.escapeHTML(work.name)}" class="max-w-xs max-h-48 object-contain mx-auto rounded-lg mb-4">
                        <h4 class="text-lg font-bold">${App.escapeHTML(work.name)}</h4><p class="text-gray-400 mb-4">前回の抽選作品の評価をお願いします！</p>
                        <div class="my-6"><label class="block text-sm text-gray-400 mb-2">評価</label><div class="flex items-center justify-center space-x-2 text-3xl" id="feedback-rating"></div></div>
                        <div class="my-6"><label class="block text-sm text-gray-400 mb-1">タグ</label><div id="feedback-tags" class="flex flex-wrap justify-center gap-2 p-2 bg-gray-700 rounded-lg min-h-[40px] mb-2"></div><button type="button" id="feedback-assign-tags-btn" class="w-full text-sm p-2 bg-gray-600 hover:bg-gray-700 rounded-lg">タグを割り当て/編集</button></div>
                        <div class="pt-4 flex justify-end space-x-3">
                            <button type="button" id="feedback-later-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">また今度</button>
                            <button type="button" id="feedback-save-btn" class="px-6 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold btn-disabled" disabled>保存</button>
                        </div>
                    </div>`;

                App.openModal("前回の作品の評価", content, () => { // App.openModal を使用
                    const ratingStars = $('#feedback-rating');
                    const saveBtn = $('#feedback-save-btn');
                    const tagsContainer = $('#feedback-tags'); // tagsContainer をここで定義

                    const checkSaveButton = () => {
                        // 修正: work.tagIds が undefined の場合の考慮
                        const originalTagIdsString = JSON.stringify((work.tagIds || []).sort());
                        const currentTagIdsString = JSON.stringify([...currentTagIds].sort());
                        saveBtn.disabled = currentRating === (work.rating || 0) && currentTagIdsString === originalTagIdsString;
                        saveBtn.classList.toggle('btn-disabled', saveBtn.disabled);
                    };

                    const renderStars = r => {
                        if (!ratingStars) return;
                        ratingStars.innerHTML = '';
                        for (let i = 1; i <= 5; i++) {
                            const starIcon = document.createElement('i');
                            starIcon.classList.add('fa-star', 'cursor-pointer');
                            starIcon.dataset.value = i;
                            
                            if (r >= i) {
                                starIcon.classList.add('fas', 'text-yellow-400'); // Full star
                            } else if (r === (i - 0.5)) {
                                starIcon.classList.add('fas', 'fa-star-half-alt', 'text-yellow-400'); // Half star
                            } else {
                                starIcon.classList.add('far', 'text-gray-500'); // Empty star
                            }
                            ratingStars.appendChild(starIcon);
                        }
                    };
                    renderStars(currentRating);
                    if (ratingStars) { // 要素が存在するか確認
                        ratingStars.addEventListener('click', e => {
                            const star = e.target.closest('.fa-star');
                            if (star) {
                                const value = parseInt(star.dataset.value, 10);
                                const rect = star.getBoundingClientRect();
                                const isRightHalf = (e.clientX - rect.left) > (rect.width / 2);
                                
                                let newRating = isRightHalf ? value : value - 0.5;
                                
                                if (currentRating === newRating) {
                                    newRating = 0;
                                }
                                
                                currentRating = newRating;
                                renderStars(currentRating);
                                checkSaveButton();
                            }
                        });
                    }

                    const renderTags = ids => {
                        if (tagsContainer) { // 要素が存在するか確認
                            const objects = App.getTagObjects(ids); // App.getTagObjects を使用
                            tagsContainer.innerHTML = objects.length > 0 ? objects.map(t => `<span class="px-2 py-1 rounded text-xs" style="background-color:${t.color};color:${App.getContrastColor(t.color)}">${App.escapeHTML(t.name)}</span>`).join('') : `<span class="text-xs text-gray-500">タグなし</span>`; // App.getContrastColor を使用
                        }
                    };
                    renderTags(currentTagIds);

                    $('#feedback-assign-tags-btn').addEventListener('click', () => {
                        App.openTagModal({ // App.openTagModal を使用
                            mode: 'assign', workId: work.id, currentTagIds, workName: work.name,
                            onConfirm: (newIds) => {
                                if(newIds !== null) {
                                    currentTagIds = newIds;
                                }
                                App.openFeedbackModal(work, { rating: currentRating, tagIds: currentTagIds }); // App.openFeedbackModal を使用
                            }
                        });
                    });

                    $('#feedback-later-btn').addEventListener('click', App.closeModal); // App.closeModal を使用
                    saveBtn.addEventListener('click', async () => {
                        AppState.checkModalDirtyState = () => false; // AppState を使用
                        if (await App.updateWork(work.id, { rating: currentRating, tagIds: Array.from(currentTagIds) })) { // App.updateWork を使用
                            App.showToast(`「${work.name}」の情報を更新しました。`); App.closeModal(); // App.showToast, App.closeModal を使用
                        }
                    });
                    checkSaveButton(); // 初期状態のボタン有効/無効をチェック
                });
            }, // ← App.openFeedbackModal の終わりカンマ

            // --- Stats Dashboard Logic ---
            // --- Stats Dashboard Logic ---
            openStatsDashboardModal: () => {
                if (AppState.works.length === 0) { // AppState.works を使用
                    return App.openModal("統計ダッシュボード", `<div class="text-center py-16 text-gray-500"><i class="fas fa-chart-pie fa-3x"></i><p class="mt-4">分析できる作品データがありません。</p></div>`); // App.openModal を使用
                }

                const content = `
                    <div class="space-y-4">
                        <div class="flex flex-col sm:flex-row justify-between gap-2 items-center mb-4">
                            <div class="bg-gray-900 p-1 rounded-lg flex space-x-1">
                                <button id="stats-tab-overview" class="stats-tab flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors stats-tab-active whitespace-nowrap">コレクション概要</button>
                                <button id="stats-tab-trends" class="stats-tab flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap">登録日分析</button>
                            </div>
                            <div class="flex items-center space-x-2">
                                <label for="stats-genre-filter" class="text-sm text-gray-400">ジャンル:</label>
                                <select id="stats-genre-filter" class="bg-gray-700 border border-gray-600 rounded-md p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                                    <option value="all">すべて</option>
                                    <option value="漫画">漫画</option>
                                    <option value="ゲーム">ゲーム</option>
                                    <option value="動画">動画</option>
                                </select>
                            </div>
                        </div>

                        <div id="stats-content-overview">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="bg-gray-900 p-4 rounded-lg">
                                    <h4 id="genre-stats-title" class="font-bold text-amber-400 mb-3">ジャンル別統計</h4>
                                    <div id="genre-stats-container" class="space-y-4"></div>
                                </div>
                                <div class="bg-gray-900 p-4 rounded-lg flex flex-col">
                                    <h4 class="font-bold text-amber-400 mb-2 text-center">販売サイト別 割合</h4>
                                    <div class="flex-grow flex items-center justify-center relative min-h-0" style="height: 250px;">
                                        <canvas id="site-distribution-chart"></canvas>
                                    </div>
                                </div>
                                <div class="bg-gray-900 p-4 rounded-lg flex flex-col md:col-span-2">
                                    <h4 class="font-bold text-amber-400 mb-2 text-center">評価別 作品数</h4>
                                    <div class="flex-grow flex items-center justify-center relative min-h-0" style="height: 250px;">
                                        <canvas id="rating-chart"></canvas>
                                    </div>
                                </div>
                                <div class="bg-gray-900 p-4 rounded-lg flex flex-col md:col-span-2">
                                    <h4 class="font-bold text-amber-400 mb-2 text-center">タグ使用頻度 Top 10</h4>
                                    <div class="flex-grow flex items-center justify-center relative min-h-0" style="height: 300px;">
                                        <canvas id="tag-usage-chart"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="stats-content-trends" class="hidden">
                            <div class="bg-gray-900 p-4 rounded-lg">
                                <div class="flex justify-between items-center mb-3">
                                    <h4 class="font-bold text-amber-400">登録数の推移</h4>
                                    <div class="flex space-x-1 bg-gray-800 p-1 rounded-lg">
                                        <button id="trends-view-monthly" class="px-3 py-1 text-xs rounded stats-tab-active">月別</button>
                                        <button id="trends-view-yearly" class="px-3 py-1 text-xs rounded">年別</button>
                                    </div>
                                </div>
                                <div class="h-48 relative mb-4"><canvas id="trends-chart"></canvas></div>
                            </div>
                            <div id="trends-detail-panel" class="mt-4 bg-gray-900 p-4 rounded-lg min-h-[200px] hidden">
                                <h4 id="trends-detail-title" class="font-bold text-amber-400 mb-3 text-center"></h4>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div class="md:col-span-1 flex flex-col items-center">
                                        <h5 class="text-sm text-gray-400 mb-2">ジャンル内訳</h5>
                                        <div class="w-32 h-32 relative"><canvas id="trends-detail-genre-chart"></canvas></div>
                                    </div>
                                    <div class="md:col-span-2">
                                        <h5 class="text-sm text-gray-400 mb-2">登録作品リスト</h5>
                                        <ul id="trends-detail-list" class="text-sm space-y-1 overflow-y-auto max-h-40 pr-2"></ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                App.openModal("統計ダッシュボード", content, () => { // App.openModal を使用
                    App.setupChartDefaults(); // App.setupChartDefaults を使用
                    App.renderStatsOverview(); // App.renderStatsOverview を使用

                    // Tab switching logic
                    const overviewTab = $('#stats-tab-overview'), trendsTab = $('#stats-tab-trends');
                    const overviewContent = $('#stats-content-overview'), trendsContent = $('#stats-content-trends');

                    overviewTab.addEventListener('click', () => {
                        overviewTab.classList.add('stats-tab-active');
                        trendsTab.classList.remove('stats-tab-active');
                        overviewContent.classList.remove('hidden');
                        trendsContent.classList.add('hidden');
                        App.renderStatsOverview(); // Re-render in case data changed // App.renderStatsOverview を使用
                    });

                    trendsTab.addEventListener('click', () => {
                        trendsTab.classList.add('stats-tab-active');
                        overviewTab.classList.remove('stats-tab-active');
                        trendsContent.classList.remove('hidden');
                        overviewContent.classList.add('hidden');
                        App.renderTrendsChart('monthly'); // App.renderTrendsChart を使用
                    });

                    $('#trends-view-monthly').addEventListener('click', (e) => {
                        e.target.classList.add('stats-tab-active');
                        $('#trends-view-yearly').classList.remove('stats-tab-active');
                        App.renderTrendsChart('monthly'); // App.renderTrendsChart を使用
                    });
                    $('#trends-view-yearly').addEventListener('click', (e) => {
                        e.target.classList.add('stats-tab-active');
                        $('#trends-view-monthly').classList.remove('stats-tab-active');
                        App.renderTrendsChart('yearly'); // App.renderTrendsChart を使用
                    });

                    const genreFilterSelect = $('#stats-genre-filter');
                    if (genreFilterSelect) {
                        genreFilterSelect.addEventListener('change', () => {
                            // 現在表示中のタブに応じて再描画
                            if (trendsContent.classList.contains('hidden')) { // overviewContent の hidden ではなく、trendsContent が hidden かで判定
                                // Overviewタブが表示中
                                App.renderStatsOverview();
                            } else {
                                // Trendsタブが表示中
                                const currentMode = $('#trends-view-monthly').classList.contains('stats-tab-active') ? 'monthly' : 'yearly';
                                App.renderTrendsChart(currentMode);
                                $('#trends-detail-panel').classList.add('hidden'); // 詳細パネルは隠す
                            }
                        });
                    }

                }, { size: 'max-w-5xl' });
            }, // ← App.openStatsDashboardModal の終わりカンマ
            
            setupChartDefaults: () => {
                Chart.defaults.color = '#9ca3af'; // gray-400
                Chart.defaults.font.family = 'sans-serif';
                Chart.defaults.plugins.legend.position = 'bottom';
                Chart.defaults.plugins.tooltip.backgroundColor = '#1f2937'; // gray-800
                Chart.defaults.plugins.tooltip.titleColor = '#e5e7eb'; // gray-200
                Chart.defaults.plugins.tooltip.bodyColor = '#d1d5db'; // gray-300
                Chart.defaults.plugins.tooltip.borderColor = '#374151'; // gray-700
                Chart.defaults.plugins.tooltip.borderWidth = 1;
            }, // ← App.setupChartDefaults の終わりカンマ

            renderStatsOverview: () => {
                // Genre Stats (Progress Bars)
                const genreFilterSelect = $('#stats-genre-filter'); // セレクトボックスを取得
                const genreFilter = genreFilterSelect ? genreFilterSelect.value : 'all'; // 値を取得 (要素がなければ 'all')
                const filteredWorks = genreFilter === 'all'
                    ? AppState.works // 「すべて」なら全作品
                    : AppState.works.filter(w => w.genre === genreFilter); // それ以外ならジャンルで絞り込み

                const genreContainer = $('#genre-stats-container');
                const genreTitle = $('#genre-stats-title');
                if (!genreContainer || !genreTitle) return;

                const totalWorks = filteredWorks.length; // ← 変更
                genreTitle.textContent = `ジャンル別統計 (${genreFilter === 'all' ? `全${AppState.works.length}` : genreFilter} / ${totalWorks}件)`; // ← タイトルも変更

                const genreCounts = filteredWorks.reduce((acc, work) => ({ ...acc, [work.genre]: (acc[work.genre] || 0) + 1 }), {});
                const genreColors = { '漫画': '#3b82f6', 'ゲーム': '#10b981', '動画': '#8b5cf6' };
                genreContainer.innerHTML = Object.entries(genreCounts).sort((a,b) => b[1] - a[1]).map(([genre, count]) => {
                const percentage = totalWorks > 0 ? ((count / totalWorks) * 100).toFixed(1) : 0;
                return `<div><div class="flex justify-between mb-1 text-sm"><span class="font-bold" style="color:${genreColors[genre] || '#9ca3af'}">${genre}</span><span>${count}件 (${percentage}%)</span></div><div class="w-full bg-gray-700 rounded-full h-2.5"><div class="h-2.5 rounded-full" style="width: ${percentage}%; background-color:${genreColors[genre] || '#9ca3af'}"></div></div></div>`;
                }).join('') || '<p class="text-sm text-gray-500">データがありません</p>';

                // Site Distribution Chart (Doughnut)
                const siteChartCanvas = $('#site-distribution-chart');
                if (siteChartCanvas) {
                    const siteCounts = filteredWorks.reduce((acc, work) => { // AppState.works を使用
                        const url = work.sourceUrl || '';
                        if (url.includes('dlsite.com')) acc.DLsite++;
                        else if (url.includes('dmm.co.jp')) acc.FANZA++;
                        else acc.Other++;
                        return acc;
                    }, { DLsite: 0, FANZA: 0, Other: 0 });

                    if (AppState.activeCharts.site) AppState.activeCharts.site.destroy(); // AppState.activeCharts を使用
                    AppState.activeCharts.site = new Chart(siteChartCanvas.getContext('2d'), { // AppState.activeCharts を使用
                        type: 'doughnut',
                        data: {
                            labels: ['DLsite', 'FANZA', 'その他'],
                            datasets: [{
                                data: [siteCounts.DLsite, siteCounts.FANZA, siteCounts.Other],
                                backgroundColor: ['#0ea5e9', '#ef4444', '#6b7280'],
                                borderColor: '#1f2937',
                                borderWidth: 4,
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'bottom', labels: { padding: 20, boxWidth: 12 } },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => {
                                            const total = context.chart.getDatasetMeta(0).total;
                                            const percentage = total > 0 ? (context.raw / total * 100).toFixed(1) : 0;
                                            return `${context.label}: ${context.raw}件 (${percentage}%)`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }

                // Rating Chart (Bar)
                const ratingCounts = filteredWorks.reduce((acc, work) => {
                    // ★ 変更点: Math.round() を使って四捨五入
                    const r = Math.round(work.rating || 0); 
                    acc[r] = (acc[r] || 0) + 1; 
                    return acc;
                }, {});
                const ratingLabels = ['未評価', '★1', '★2', '★3', '★4', '★5'];
                const ratingDataPoints = [ratingCounts[0] || 0, ratingCounts[1] || 0, ratingCounts[2] || 0, ratingCounts[3] || 0, ratingCounts[4] || 0, ratingCounts[5] || 0];
                const ratingData = {
                    labels: ratingLabels,
                    datasets: [{
                        label: '作品数',
                        data: ratingDataPoints,
                        backgroundColor: 'rgba(251, 191, 36, 0.6)',
                        borderColor: 'rgba(251, 191, 36, 1)',
                        borderWidth: 1
                    }]
                };
                const ratingChartCanvas = $('#rating-chart'); // 要素を取得
                if (ratingChartCanvas) { // 要素が存在するか確認
                    if(AppState.activeCharts.rating) AppState.activeCharts.rating.destroy(); // AppState.activeCharts を使用
                    AppState.activeCharts.rating = new Chart(ratingChartCanvas.getContext('2d'), { // AppState.activeCharts を使用
                        type: 'bar', data: ratingData,
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { stepSize: 1 } },
                                x: { grid: { color: '#374151' } }
                            }
                        }
                    });
                }
                const tagUsageChartCanvas = $('#tag-usage-chart');
                if (tagUsageChartCanvas) {
                    // filteredWorks からタグの出現回数を集計
                    const tagCounts = filteredWorks.reduce((acc, work) => {
                        (work.tagIds || []).forEach(tagId => {
                            acc[tagId] = (acc[tagId] || 0) + 1;
                        });
                        return acc;
                    }, {});

                    // 回数が多い順にソートして上位10件を取得
                    const sortedTags = Object.entries(tagCounts)
                        .sort(([, countA], [, countB]) => countB - countA)
                        .slice(0, 10);

                    // Chart.js 用のデータを作成
                    const tagLabels = sortedTags.map(([tagId]) => AppState.tags.get(tagId)?.name || '不明'); // Mapからタグ名を取得
                    const tagDataPoints = sortedTags.map(([, count]) => count);
                    const tagColors = sortedTags.map(([tagId]) => AppState.tags.get(tagId)?.color || '#6b7280'); // Mapから色を取得

                    // グラフを描画 (既存のグラフがあれば破棄)
                    if (AppState.activeCharts.tagUsage) AppState.activeCharts.tagUsage.destroy();
                    AppState.activeCharts.tagUsage = new Chart(tagUsageChartCanvas.getContext('2d'), {
                        type: 'bar', // 棒グラフ
                        data: {
                            labels: tagLabels,
                            datasets: [{
                                label: '使用回数',
                                data: tagDataPoints,
                                backgroundColor: tagColors.map(color => `${color}B3`), // 色を少し透過させる
                                borderColor: tagColors,
                                borderWidth: 1
                            }]
                        },
                        options: {
                            indexAxis: 'y', // 横棒グラフにする
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false } }, // 凡例は非表示
                            scales: {
                                x: { beginAtZero: true, grid: { color: '#374151' }, ticks: { stepSize: 1 } }, // X軸設定
                                y: { grid: { display: false } } // Y軸のグリッド線は非表示
                            }
                        }
                    });
                }
            }, // ← App.renderStatsOverview の終わりカンマ
            
            renderTrendsChart: (mode) => {
                const trendsChartCanvas = $('#trends-chart'); // 要素を取得
                if (!trendsChartCanvas) return; // 要素がなければ何もしない

                if(AppState.activeCharts.trends) AppState.activeCharts.trends.destroy(); // AppState.activeCharts を使用
                $('#trends-detail-panel').classList.add('hidden');

                const genreFilterSelect = $('#stats-genre-filter');
                const genreFilter = genreFilterSelect ? genreFilterSelect.value : 'all';
                const filteredWorks = genreFilter === 'all'
                    ? AppState.works
                    : AppState.works.filter(w => w.genre === genreFilter);

                const trendData = filteredWorks.reduce((acc, work) => { // AppState.works を使用
                    if (!work.registeredAt) return acc;
                    const date = work.registeredAt.toDate();
                    const key = mode === 'monthly' ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}` : `${date.getFullYear()}`;
                    if (!acc[key]) acc[key] = { count: 0, works: [] };
                    acc[key].count++;
                    acc[key].works.push(work);
                    return acc;
                }, {});

                const sortedKeys = Object.keys(trendData).sort();
                const labels = sortedKeys;
                const dataPoints = sortedKeys.map(key => trendData[key].count);

                AppState.activeCharts.trends = new Chart(trendsChartCanvas.getContext('2d'), { // AppState.activeCharts を使用
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: '登録作品数',
                            data: dataPoints,
                            fill: true,
                            backgroundColor: 'rgba(14, 165, 233, 0.2)',
                            borderColor: 'rgba(14, 165, 233, 1)',
                            tension: 0.2,
                            pointBackgroundColor: 'rgba(14, 165, 233, 1)',
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { stepSize: 1 } },
                            x: { grid: { display: false } }
                        },
                        onClick: (e, elements) => {
                            if (elements.length > 0) {
                                const index = elements[0].index;
                                const key = labels[index];
                                App.renderTrendsDetail(key, trendData[key]); // App.renderTrendsDetail を使用
                            }
                        }
                    }
                });
            }, // ← App.renderTrendsChart の終わりカンマ
            
            renderTrendsDetail: (key, detailData) => { // 引数名を data から detailData に変更 (可読性のため)
                const panel = $('#trends-detail-panel');
                if (!panel) return;
                panel.classList.remove('hidden');
                $('#trends-detail-title').textContent = `${key} の詳細`;

                // Render genre doughnut chart for the period
                const genreCounts = detailData.works.reduce((acc, work) => ({ ...acc, [work.genre]: (acc[work.genre] || 0) + 1 }), {}); // ← detailData.works を使用
                const genreChartCanvas = $('#trends-detail-genre-chart');
                if (genreChartCanvas) {
                    if(AppState.activeCharts.trendsDetailGenre) AppState.activeCharts.trendsDetailGenre.destroy();
                    AppState.activeCharts.trendsDetailGenre = new Chart(genreChartCanvas.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(genreCounts),
                            datasets: [{ data: Object.values(genreCounts), backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6'], borderColor: '#1f2937', borderWidth: 2 }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                    });
                }

                // Render list of works
                const detailList = $('#trends-detail-list');
                if (detailList) {
                    detailList.innerHTML = detailData.works.map(w => `<li>- ${App.escapeHTML(w.name)}</li>`).join(''); // ← detailData.works を使用
                }

                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            },
            
            // --- Debug Mode ---
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
            }
        }; // --- End of App Object ---
        

        // --- 4. App Initialization ---
        // 起動処理を App.init() の呼び出しに変更
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // 1. sw.js をテキストとして取得 (キャッシュを回避)
                const response = await fetch('sw.js?t=' + Date.now());
                if (!response.ok) {
                    throw new Error('sw.jsの読み込みに失敗');
                }
                const swText = await response.text();
                
                // 2. 正規表現でバージョン番号を抽出
                const match = swText.match(/const APP_VERSION = '([^']+)';/);
                if (!match || !match[1]) {
                    throw new Error('sw.jsからバージョンを抽出できません');
                }
                const version = match[1];
                
                // 3. AppStateにバージョンを設定
                console.log('Detected App Version:', version);
                AppState.appVersion = version;
                
                // 4. アプリを初期化
                App.init();

            } catch (error) {
                console.error("アプリの初期化に失敗:", error);
                document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
                    <b>アプリの起動に失敗しました:</b><br>
                    ${error.message}<br><br>
                    sw.jsファイルが正しくアップロードされているか、またはバージョン番号が
                    <pre style="background: #333; padding: 5px; border-radius: 4px; margin-top: 5px;">const APP_VERSION = 'vX.X.X';</pre>
                    の形式でsw.jsの先頭に書かれているか確認してください。
                </div>`;
            }
        });