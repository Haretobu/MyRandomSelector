// src/store.js

// アプリ全体で共有するデータ（状態）をここで管理します
export const store = {
    // --- 基本情報 ---
    appVersion: 'v5.0.0 (Vite)',
    appId: 'r18-random-selector',
    
    // --- ユーザー & 同期情報 ---
    currentUser: null,
    syncId: '',
    
    // --- データ本体 ---
    works: [],        // 作品リスト
    tags: new Map(),  // タグリスト (Map形式)
    
    // --- 読み込み状態 ---
    isLoadComplete: false,
    loadingStatus: { auth: false, works: false, tags: false },
    loadingTimeout: null,
    stallTimeout: null,
    
    // --- 画面設定 ---
    listViewMode: localStorage.getItem('listViewMode') || 'grid',
    itemsPerPage: parseInt(localStorage.getItem('itemsPerPage') || '20', 10),
    showSiteIcon: localStorage.getItem('showSiteIcon') === 'false' ? false : true,
    isLiteMode: false,
    isDebugMode: false,
    
    // --- UI要素 & モーダル管理 ---
    ui: {},                 // HTML要素の参照キャッシュ
    activeCharts: {},       // 描画中のグラフインスタンス (★これがエラーの原因でした)
    modalStateStack: [],    // モーダルの履歴
    
    // --- 画像編集用 ---
    tempNewImageUrl: null,
    deleteImageFlag: false,
    
    // --- フィルタ & ソート設定 ---
    listFilters: {
        genres: new Set(),
        sites: new Set(),
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
    
    // --- 検索 & ページネーション ---
    searchQuery: '',
    searchDebounceTimer: null,
    searchHistory: [],
    maxSearchHistory: 10,
    suggestions: [],
    isSuggestBoxOpen: false,
    currentPage: 1,
    
    // --- その他 (一時データなど) ---
    expandedTagsWorkIds: new Set(),
    tempWorks: [],         // 一括登録用の一時リスト
    editingTempIndex: -1,  // 一括登録での編集対象
    isRegFormDirty: false, // 編集中の未保存フラグ
    customPresets: [],     // 抽選設定のプリセット
    
    // --- 抽選設定 ---
    lotterySettings: {
        mood: 'default',
        genres: new Set(),
        sites: new Set(),
        andTagIds: new Set(),
        orTagIds: new Set(),
        notTagIds: new Set(),
        dateFilter: { mode: 'none', date: '', startDate: '', endDate: '' },
        priority: 'new',
        method: 'normal',
        unratedOrUntaggedOnly: false,
    }
};