// src/adWidget.js
// DLsiteのおすすめ情報パーツの設定管理・表示処理

const STORAGE_KEY = 'dlsiteAdWidgetSettings_v1';

const DEFAULT_SETTINGS = {
    enabled: false,      // 初期状態は非表示（設定で有効化する）
    type: 'ranking',     // 'ranking' | 'new'
    period: '24h',       // 'ranking'の時のみ使用: 24h/week/month/year/total
    display: 'vertical', // 'vertical'(タテ) | 'horizontal'(ヨコ)
    column: 'v',         // 'v'(タテ並び) | 'h'(ヨコ並び)
    image: 'medium',     // 'small' | 'medium' | 'large'
    count: 3,            // 1 | 3 | 5 | 10
    detail: true,        // true: 画像・作品名・サークル名 / false: 画像のみ
    wrapper: true,       // パーツタイトルの表示/非表示
    autorotate: true,    // 自動スクロール
};

export const loadAdWidgetSettings = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
};

export const saveAdWidgetSettings = (settings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const buildBlogPartsConfig = (settings) => {
    return {
        base: 'https://www.dlsite.com/',
        type: settings.type,
        site: 'maniax', // 同人 R18 固定
        query: settings.type === 'ranking' ? { period: settings.period } : { days: '7' },
        title: settings.type === 'ranking' ? 'ランキング' : '新着作品',
        display: settings.display,
        detail: settings.detail ? '1' : '0',
        column: settings.column,
        image: settings.image,
        count: String(settings.count),
        wrapper: settings.wrapper ? '1' : '0',
        autorotate: !!settings.autorotate,
        aid: '' // アフィリエイトIDは使用しない
    };
};

// パネルの表示内容を最新の設定で描き直す
export const renderAdWidget = (App) => {
    const panel = document.getElementById('ad-widget-panel');
    const container = document.getElementById('ad-widget-frame-container');
    if (!panel || !container) return;

    const settings = loadAdWidgetSettings();

    if (!settings.enabled) {
        panel.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    panel.classList.remove('hidden');

    const config = buildBlogPartsConfig(settings);
    const encoded = encodeURIComponent(JSON.stringify(config));
    const src = `/dlsite-widget.html?c=${encoded}&t=${Date.now()}`; // t=でキャッシュを回避し、確実に再読み込みさせる

    container.innerHTML = `<iframe src="${src}" title="DLsiteおすすめ情報" style="width:100%;height:380px;border:0;background:transparent;" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>`;
};

// 設定モーダル
export const openAdWidgetSettingsModal = (App) => {
    const s = loadAdWidgetSettings();

    const content = `
    <div class="space-y-6">
        <div class="flex items-center">
            <input type="checkbox" id="adw-enabled" class="h-4 w-4 rounded bg-gray-600 text-orange-500 border-gray-500 focus:ring-orange-600" ${s.enabled ? 'checked' : ''}>
            <label for="adw-enabled" class="ml-2 text-sm font-medium">おすすめ情報を表示する</label>
        </div>

        <div>
            <label class="block text-sm text-gray-400 mb-1">ジャンル系</label>
            <select id="adw-type" class="w-full bg-gray-700 p-2 rounded-lg">
                <option value="ranking" ${s.type === 'ranking' ? 'selected' : ''}>ランキング</option>
                <option value="new" ${s.type === 'new' ? 'selected' : ''}>新着作品</option>
            </select>
        </div>

        <div>
            <label class="block text-sm text-gray-400 mb-1">ランキングの種類（ジャンル系がランキングの時のみ）</label>
            <select id="adw-period" class="w-full bg-gray-700 p-2 rounded-lg" ${s.type !== 'ranking' ? 'disabled' : ''}>
                <option value="24h" ${s.period === '24h' ? 'selected' : ''}>24時間</option>
                <option value="week" ${s.period === 'week' ? 'selected' : ''}>7日間</option>
                <option value="month" ${s.period === 'month' ? 'selected' : ''}>1カ月間</option>
                <option value="year" ${s.period === 'year' ? 'selected' : ''}>当年</option>
                <option value="total" ${s.period === 'total' ? 'selected' : ''}>累計</option>
            </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm text-gray-400 mb-1">タイプ</label>
                <select id="adw-display" class="w-full bg-gray-700 p-2 rounded-lg">
                    <option value="vertical" ${s.display === 'vertical' ? 'selected' : ''}>タテ</option>
                    <option value="horizontal" ${s.display === 'horizontal' ? 'selected' : ''}>ヨコ</option>
                </select>
            </div>
            <div>
                <label class="block text-sm text-gray-400 mb-1">段組み</label>
                <select id="adw-column" class="w-full bg-gray-700 p-2 rounded-lg">
                    <option value="v" ${s.column === 'v' ? 'selected' : ''}>タテ並び</option>
                    <option value="h" ${s.column === 'h' ? 'selected' : ''}>ヨコ並び</option>
                </select>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm text-gray-400 mb-1">画像サイズ</label>
                <select id="adw-image" class="w-full bg-gray-700 p-2 rounded-lg">
                    <option value="small" ${s.image === 'small' ? 'selected' : ''}>小</option>
                    <option value="medium" ${s.image === 'medium' ? 'selected' : ''}>中</option>
                    <option value="large" ${s.image === 'large' ? 'selected' : ''}>大</option>
                </select>
            </div>
            <div>
                <label class="block text-sm text-gray-400 mb-1">表示件数</label>
                <select id="adw-count" class="w-full bg-gray-700 p-2 rounded-lg">
                    <option value="1" ${s.count === 1 ? 'selected' : ''}>1件</option>
                    <option value="3" ${s.count === 3 ? 'selected' : ''}>3件</option>
                    <option value="5" ${s.count === 5 ? 'selected' : ''}>5件</option>
                    <option value="10" ${s.count === 10 ? 'selected' : ''}>10件</option>
                </select>
            </div>
        </div>

        <div class="flex items-center">
            <input type="checkbox" id="adw-detail" class="h-4 w-4 rounded bg-gray-600 text-orange-500 border-gray-500 focus:ring-orange-600" ${s.detail ? 'checked' : ''}>
            <label for="adw-detail" class="ml-2 text-sm font-medium">画像・作品名・サークル名を表示する（オフで画像のみ）</label>
        </div>
        <div class="flex items-center">
            <input type="checkbox" id="adw-wrapper" class="h-4 w-4 rounded bg-gray-600 text-orange-500 border-gray-500 focus:ring-orange-600" ${s.wrapper ? 'checked' : ''}>
            <label for="adw-wrapper" class="ml-2 text-sm font-medium">パーツのタイトルを表示する</label>
        </div>
        <div class="flex items-center">
            <input type="checkbox" id="adw-autorotate" class="h-4 w-4 rounded bg-gray-600 text-orange-500 border-gray-500 focus:ring-orange-600" ${s.autorotate ? 'checked' : ''}>
            <label for="adw-autorotate" class="ml-2 text-sm font-medium">自動スクロールする</label>
        </div>

        <p class="text-xs text-gray-500">※ 対象サイトは同人 R18(DLsite maniax)のみです。アフィリエイトIDは使用していません。</p>

        <div class="pt-4 flex justify-end space-x-3 border-t border-gray-700">
            <button type="button" id="adw-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button>
            <button type="button" id="adw-save" class="px-6 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold text-white">保存</button>
        </div>
    </div>`;

    App.openModal("おすすめ情報の表示設定", content, () => {
        const typeSelect = document.getElementById('adw-type');
        const periodSelect = document.getElementById('adw-period');

        typeSelect.addEventListener('change', () => {
            periodSelect.disabled = typeSelect.value !== 'ranking';
        });

        document.getElementById('adw-cancel').addEventListener('click', App.closeModal);

        document.getElementById('adw-save').addEventListener('click', () => {
            const newSettings = {
                enabled: document.getElementById('adw-enabled').checked,
                type: typeSelect.value,
                period: periodSelect.value,
                display: document.getElementById('adw-display').value,
                column: document.getElementById('adw-column').value,
                image: document.getElementById('adw-image').value,
                count: parseInt(document.getElementById('adw-count').value, 10),
                detail: document.getElementById('adw-detail').checked,
                wrapper: document.getElementById('adw-wrapper').checked,
                autorotate: document.getElementById('adw-autorotate').checked,
            };
            saveAdWidgetSettings(newSettings);
            renderAdWidget(App);
            App.showToast("表示設定を保存しました。");
            App.closeModal();
        });
    }, { size: 'max-w-md' });
};