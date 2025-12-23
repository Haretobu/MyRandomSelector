import { store as AppState } from './store/store.js';

// ヘルパー関数
const $ = (selector) => document.querySelector(selector);

// --- 以下、main.jsから移動した統計ロジック ---

export const openStatsDashboardModal = (App) => {
    if (AppState.works.length === 0) {
        return App.openModal("統計ダッシュボード", `<div class="text-center py-16 text-gray-500"><i class="fas fa-chart-pie fa-3x"></i><p class="mt-4">分析できる作品データがありません。</p></div>`);
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

    App.openModal("統計ダッシュボード", content, () => {
        App.setupChartDefaults();
        App.renderStatsOverview();

        const overviewTab = $('#stats-tab-overview');
        const trendsTab = $('#stats-tab-trends');
        const overviewContent = $('#stats-content-overview');
        const trendsContent = $('#stats-content-trends');

        if(overviewTab && trendsTab) {
            overviewTab.addEventListener('click', () => {
                overviewTab.classList.add('stats-tab-active');
                trendsTab.classList.remove('stats-tab-active');
                overviewContent.classList.remove('hidden');
                trendsContent.classList.add('hidden');
                App.renderStatsOverview(); 
            });

            trendsTab.addEventListener('click', () => {
                trendsTab.classList.add('stats-tab-active');
                overviewTab.classList.remove('stats-tab-active');
                trendsContent.classList.remove('hidden');
                overviewContent.classList.add('hidden');
                App.renderTrendsChart('monthly'); 
            });
        }

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

        const genreFilterSelect = $('#stats-genre-filter');
        if (genreFilterSelect) {
            genreFilterSelect.addEventListener('change', () => {
                if (trendsContent.classList.contains('hidden')) {
                    App.renderStatsOverview();
                } else {
                    const currentMode = $('#trends-view-monthly').classList.contains('stats-tab-active') ? 'monthly' : 'yearly';
                    App.renderTrendsChart(currentMode);
                    $('#trends-detail-panel').classList.add('hidden');
                }
            });
        }

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

export const renderTrendsChart = (mode, App) => {
    const trendsChartCanvas = $('#trends-chart');
    if (!trendsChartCanvas || typeof Chart === 'undefined') return;

    if(AppState.activeCharts.trends) AppState.activeCharts.trends.destroy();
    $('#trends-detail-panel').classList.add('hidden');

    const genreFilterSelect = $('#stats-genre-filter');
    const genreFilter = genreFilterSelect ? genreFilterSelect.value : 'all';
    const filteredWorks = genreFilter === 'all'
        ? AppState.works
        : AppState.works.filter(w => w.genre === genreFilter);

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