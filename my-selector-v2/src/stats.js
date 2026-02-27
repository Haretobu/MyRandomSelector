import { store as AppState } from './store/store.js';

// ヘルパー関数
const $ = (selector) => document.querySelector(selector);


// --- 統計ロジック ---

export const openStatsDashboardModal = (App) => {
    if (AppState.works.length === 0) {
        return App.openModal("統計ダッシュボード", `<div class="text-center py-16 text-gray-500"><i class="fas fa-chart-pie fa-3x"></i><p class="mt-4">分析できる作品データがありません。</p></div>`);
    }

    const content = `
        <div class="space-y-4">
            <div class="flex flex-col sm:flex-row justify-between gap-2 items-center mb-4">
                <div class="bg-gray-900 p-1 rounded-lg flex space-x-1 w-full sm:w-auto overflow-x-auto">
                    <button id="stats-tab-overview" class="stats-tab flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors stats-tab-active whitespace-nowrap">コレクション概要</button>
                    <button id="stats-tab-trends" class="stats-tab flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap">登録日分析</button>
                    <button id="stats-tab-backlog" class="stats-tab flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap text-amber-400"><i class="fas fa-box-open mr-1"></i>積み消化状況</button>
                </div>
                
                <div id="stats-filter-container" class="flex items-center space-x-2">
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

            <div id="stats-content-backlog" class="hidden">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-gray-900 p-6 rounded-lg flex flex-col items-center justify-center relative">
                        <h4 class="font-bold text-amber-400 mb-4 text-center w-full">全体の消化状況</h4>
                        <div class="relative w-48 h-48">
                            <canvas id="backlog-ratio-chart"></canvas>
                            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span class="text-xs text-gray-400">消化率</span>
                                <span id="backlog-ratio-text" class="text-3xl font-bold text-white">0%</span>
                            </div>
                        </div>
                        <div class="mt-4 text-sm text-gray-300 text-center">
                            <p>登録済み: <span id="backlog-total-count" class="font-mono text-white">0</span> 件</p>
                            <p class="text-gray-500 mt-1 text-xs">※未評価(★0)かつタグ未設定を「未着手」として計算</p>
                        </div>
                    </div>

                    <div class="bg-gray-900 p-4 rounded-lg flex flex-col">
                        <h4 class="font-bold text-amber-400 mb-2 text-center">ジャンル別 積み内訳</h4>
                        <div class="flex-grow flex items-center justify-center relative min-h-0" style="height: 250px;">
                            <canvas id="backlog-genre-chart"></canvas>
                        </div>
                    </div>

                    <div class="bg-gray-800 p-4 rounded-lg md:col-span-2 flex justify-between items-center">
                        <div>
                            <p class="font-bold text-white">未着手の作品を整理しますか？</p>
                            <p class="text-xs text-gray-400">「未着手」の作品だけを絞り込んでリストに表示します。</p>
                        </div>
                        <button id="btn-filter-backlog" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold transition-colors">
                            未着手をリストアップ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    App.openModal("統計ダッシュボード", content, () => {
        App.setupChartDefaults();
        App.renderStatsOverview();

        // UI要素の取得
        const tabs = {
            overview: $('#stats-tab-overview'),
            trends: $('#stats-tab-trends'),
            backlog: $('#stats-tab-backlog')
        };
        const contents = {
            overview: $('#stats-content-overview'),
            trends: $('#stats-content-trends'),
            backlog: $('#stats-content-backlog')
        };
        const filterContainer = $('#stats-filter-container');

        // タブ切り替え処理
        const switchTab = (target) => {
            Object.values(tabs).forEach(t => t.classList.remove('stats-tab-active', 'text-amber-400'));
            Object.values(contents).forEach(c => c.classList.add('hidden'));

            tabs[target].classList.add('stats-tab-active');
            if(target === 'backlog') tabs[target].classList.add('text-amber-400');
            contents[target].classList.remove('hidden');

            // フィルタの表示制御 (概要とトレンドのみ表示)
            if (filterContainer) {
                if (target === 'backlog') filterContainer.classList.add('invisible');
                else filterContainer.classList.remove('invisible');
            }

            // レンダリング実行
            if (target === 'overview') App.renderStatsOverview();
            else if (target === 'trends') App.renderTrendsChart('monthly');
            else if (target === 'backlog') App.renderBacklogStats();
        };

        // イベントリスナー設定
        if(tabs.overview) tabs.overview.addEventListener('click', () => switchTab('overview'));
        if(tabs.trends) tabs.trends.addEventListener('click', () => switchTab('trends'));
        if(tabs.backlog) tabs.backlog.addEventListener('click', () => switchTab('backlog'));

        // トレンドグラフの月/年切り替え
        $('#trends-view-monthly')?.addEventListener('click', (e) => {
            e.target.classList.add('stats-tab-active');
            $('#trends-view-yearly').classList.remove('stats-tab-active');
            App.renderTrendsChart('monthly');
        });
        $('#trends-view-yearly')?.addEventListener('click', (e) => {
            e.target.classList.add('stats-tab-active');
            $('#trends-view-monthly').classList.remove('stats-tab-active');
            App.renderTrendsChart('yearly');
        });

        // ジャンルフィルタ変更時
        const genreFilterSelect = $('#stats-genre-filter');
        if (genreFilterSelect) {
            genreFilterSelect.addEventListener('change', () => {
                if (!contents.overview.classList.contains('hidden')) {
                    App.renderStatsOverview();
                } else if (!contents.trends.classList.contains('hidden')) {
                    const currentMode = $('#trends-view-monthly').classList.contains('stats-tab-active') ? 'monthly' : 'yearly';
                    App.renderTrendsChart(currentMode);
                    $('#trends-detail-panel').classList.add('hidden');
                }
            });
        }

        // 未着手リストアップボタン
        $('#btn-filter-backlog')?.addEventListener('click', () => {
            // 絞り込み設定を上書き
            AppState.listFilters = {
                ...AppState.listFilters,
                unratedOrUntaggedOnly: true, // これを有効にする
                rating: { type: 'exact', value: 0 }
            };
            App.closeModal();
            App.showToast("未着手の作品を絞り込みました");
            App.renderAll();
        });

    }, { size: 'max-w-5xl' });
};

export const setupChartDefaults = (App) => {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#9ca3af'; 
    Chart.defaults.font.family = 'sans-serif';
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.tooltip.backgroundColor = '#1f2937';
    Chart.defaults.plugins.tooltip.titleColor = '#e5e7eb';
    Chart.defaults.plugins.tooltip.bodyColor = '#d1d5db';
    Chart.defaults.plugins.tooltip.borderColor = '#374151';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
};

// --- 1. コレクション概要レンダリング ---
export const renderStatsOverview = (App) => {
    const genreFilterSelect = $('#stats-genre-filter');
    const genreFilter = genreFilterSelect ? genreFilterSelect.value : 'all';
    const filteredWorks = genreFilter === 'all'
        ? AppState.works
        : AppState.works.filter(w => w.genre === genreFilter);

    const genreContainer = $('#genre-stats-container');
    const genreTitle = $('#genre-stats-title');
    if (!genreContainer || !genreTitle) return;

    const totalWorks = filteredWorks.length;
    genreTitle.textContent = `ジャンル別統計 (${genreFilter === 'all' ? `全${AppState.works.length}` : genreFilter} / ${totalWorks}件)`;

    const genreCounts = filteredWorks.reduce((acc, work) => ({ ...acc, [work.genre]: (acc[work.genre] || 0) + 1 }), {});
    const genreColors = { '漫画': '#3b82f6', 'ゲーム': '#10b981', '動画': '#8b5cf6' };
    genreContainer.innerHTML = Object.entries(genreCounts).sort((a,b) => b[1] - a[1]).map(([genre, count]) => {
    const percentage = totalWorks > 0 ? ((count / totalWorks) * 100).toFixed(1) : 0;
    return `<div><div class="flex justify-between mb-1 text-sm"><span class="font-bold" style="color:${genreColors[genre] || '#9ca3af'}">${genre}</span><span>${count}件 (${percentage}%)</span></div><div class="w-full bg-gray-700 rounded-full h-2.5"><div class="h-2.5 rounded-full" style="width: ${percentage}%; background-color:${genreColors[genre] || '#9ca3af'}"></div></div></div>`;
    }).join('') || '<p class="text-sm text-gray-500">データがありません</p>';

    // Site Distribution Chart
    const siteChartCanvas = $('#site-distribution-chart');
    if (siteChartCanvas && typeof Chart !== 'undefined') {
        const siteCounts = filteredWorks.reduce((acc, work) => {
            const url = work.sourceUrl || '';
            if (url.includes('dlsite.com')) acc.DLsite++;
            else if (url.includes('dmm.co.jp')) acc.FANZA++;
            else acc.Other++;
            return acc;
        }, { DLsite: 0, FANZA: 0, Other: 0 });

        if (AppState.activeCharts.site) AppState.activeCharts.site.destroy();
        AppState.activeCharts.site = new Chart(siteChartCanvas.getContext('2d'), {
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

    // Rating Chart
    const ratingCounts = filteredWorks.reduce((acc, work) => {
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
    const ratingChartCanvas = $('#rating-chart');
    if (ratingChartCanvas && typeof Chart !== 'undefined') {
        if(AppState.activeCharts.rating) AppState.activeCharts.rating.destroy();
        AppState.activeCharts.rating = new Chart(ratingChartCanvas.getContext('2d'), {
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
    if (tagUsageChartCanvas && typeof Chart !== 'undefined') {
        const tagCounts = filteredWorks.reduce((acc, work) => {
            (work.tagIds || []).forEach(tagId => {
                acc[tagId] = (acc[tagId] || 0) + 1;
            });
            return acc;
        }, {});

        const sortedTags = Object.entries(tagCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 10);

        const tagLabels = sortedTags.map(([tagId]) => AppState.tags.get(tagId)?.name || '不明');
        const tagDataPoints = sortedTags.map(([, count]) => count);
        const tagColors = sortedTags.map(([tagId]) => AppState.tags.get(tagId)?.color || '#6b7280');

        if (AppState.activeCharts.tagUsage) AppState.activeCharts.tagUsage.destroy();
        AppState.activeCharts.tagUsage = new Chart(tagUsageChartCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: tagLabels,
                datasets: [{
                    label: '使用回数',
                    data: tagDataPoints,
                    backgroundColor: tagColors.map(color => `${color}B3`),
                    borderColor: tagColors,
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: '#374151' }, ticks: { stepSize: 1 } },
                    y: { grid: { display: false } }
                }
            }
        });
    }
};

// --- 2. 登録日トレンドレンダリング ---
export const renderTrendsChart = (mode, App) => {
    const trendsChartCanvas = $('#trends-chart');
    if (!trendsChartCanvas || typeof Chart === 'undefined') return;

    if(AppState.activeCharts.trends) AppState.activeCharts.trends.destroy();
    $('#trends-detail-panel').classList.add('hidden');

    const filteredWorks = AppState.works; // トレンドはフィルタ無視（または必要に応じて適用）

    const trendData = filteredWorks.reduce((acc, work) => {
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

    AppState.activeCharts.trends = new Chart(trendsChartCanvas.getContext('2d'), {
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
                    App.renderTrendsDetail(key, trendData[key]);
                }
            }
        }
    });
};

export const renderTrendsDetail = (key, detailData, App) => {
    const panel = $('#trends-detail-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    $('#trends-detail-title').textContent = `${key} の詳細`;

    const genreCounts = detailData.works.reduce((acc, work) => ({ ...acc, [work.genre]: (acc[work.genre] || 0) + 1 }), {});
    const genreChartCanvas = $('#trends-detail-genre-chart');
    if (genreChartCanvas && typeof Chart !== 'undefined') {
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

    const detailList = $('#trends-detail-list');
    if (detailList) {
        detailList.innerHTML = detailData.works.map(w => `<li>- ${App.escapeHTML(w.name)}</li>`).join('');
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// --- 3. 積み消化状況レンダリング (New) ---
export const renderBacklogStats = (App) => {
    if (typeof Chart === 'undefined') return;
    
    // 定義: 未評価(★0) かつ タグ未設定
    const isUndigested = (w) => (!w.rating || w.rating === 0) && (!w.tagIds || w.tagIds.length === 0);

    const allWorks = AppState.works;
    const totalCount = allWorks.length;
    const undigestedCount = allWorks.filter(isUndigested).length;
    const digestedCount = totalCount - undigestedCount;
    
    const progressRate = totalCount > 0 ? ((digestedCount / totalCount) * 100).toFixed(1) : 0;

    // 数値更新
    const totalCountEl = $('#backlog-total-count');
    const ratioTextEl = $('#backlog-ratio-text');
    if(totalCountEl) totalCountEl.textContent = totalCount;
    if(ratioTextEl) ratioTextEl.textContent = `${Math.floor(progressRate)}%`;

    // 1. 全体消化率チャート (Doughnut)
    const ratioCanvas = $('#backlog-ratio-chart');
    if (ratioCanvas) {
        if (AppState.activeCharts.backlogRatio) AppState.activeCharts.backlogRatio.destroy();
        AppState.activeCharts.backlogRatio = new Chart(ratioCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['消化済み', '未着手'],
                datasets: [{
                    data: [digestedCount, undigestedCount],
                    backgroundColor: ['#0d9488', '#374151'], // Teal vs Dark Gray
                    borderColor: '#1f2937',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                cutout: '75%', // ドーナツの太さ
                // リング部分に触れたときだけツールチップを出す設定
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        // ★修正1: グラフとツールチップの距離を20px空ける（これで中央の文字から離す）
                        caretPadding: 20,
                        
                        // ★修正2: 上下の位置判定ロジック
                        yAlign: (context) => {
                            const chart = context.chart;
                            const center = chart.chartArea.height / 2;
                            // 中心より上にあるときはツールチップを上に、下にあるときは下に強制配置
                            return context.tooltip.caretY < center ? 'bottom' : 'top';
                        },
                        callbacks: {
                            label: (context) => {
                                const val = context.raw;
                                const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : 0;
                                return `${context.label}: ${val}件 (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. ジャンル別 積み上げ棒グラフ
    const genreCanvas = $('#backlog-genre-chart');
    if (genreCanvas) {
        // ジャンルごとの集計
        const genreStats = allWorks.reduce((acc, w) => {
            const g = w.genre || 'その他';
            if(!acc[g]) acc[g] = { total: 0, undigested: 0 };
            acc[g].total++;
            if(isUndigested(w)) acc[g].undigested++;
            return acc;
        }, {});

        const genres = Object.keys(genreStats);
        const digestedData = genres.map(g => genreStats[g].total - genreStats[g].undigested);
        const undigestedData = genres.map(g => genreStats[g].undigested);

        if (AppState.activeCharts.backlogGenre) AppState.activeCharts.backlogGenre.destroy();
        AppState.activeCharts.backlogGenre = new Chart(genreCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: genres,
                datasets: [
                    {
                        label: '消化済み',
                        data: digestedData,
                        backgroundColor: '#0d9488',
                        stack: 'Stack 0',
                    },
                    {
                        label: '未着手',
                        data: undigestedData,
                        backgroundColor: '#4b5563', // Gray 600
                        stack: 'Stack 0',
                    }
                ]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                indexAxis: 'y', // 横棒グラフにする
                // 横棒グラフ用の当たり判定に修正
                interaction: {
                    mode: 'nearest', // カーソルに一番近い要素を取得
                    axis: 'y',       // Y軸（ジャンル）方向で距離を測る
                    intersect: true  // 棒の上にカーソルがある時だけ反応（空白地帯を無視）
                },
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            footer: (tooltipItems) => {
                                // 同じY軸インデックスのデータセットを集計
                                const dataIndex = tooltipItems[0].dataIndex;
                                
                                // データセット全体から計算し直す
                                const totalVal = digestedData[dataIndex] + undigestedData[dataIndex];
                                const undigestedVal = undigestedData[dataIndex];
                                
                                const rate = totalVal > 0 ? (( (totalVal - undigestedVal) / totalVal) * 100).toFixed(0) : 0;
                                return `ジャンル消化率: ${rate}% (残${undigestedVal}件)`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        stacked: true,
                        grid: { color: '#374151' }
                    },
                    y: { 
                        stacked: true,
                        grid: { display: false }
                    }
                }
            }
        });
    }
};