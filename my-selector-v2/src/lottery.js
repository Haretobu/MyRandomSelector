import { store as AppState } from './store/store.js';
import { Timestamp, arrayUnion } from "firebase/firestore";

// ヘルパー関数
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// --- 以下、main.jsから移動した抽選ロジック ---

export const getLotteryPool = (App) => {
    const poolFilters = { ...AppState.lotterySettings };
    // main.js の getFilteredWorks を利用
    let pool = App.getFilteredWorks(poolFilters); 
    
    const { priority, method, mood, unratedOrUntaggedOnly } = AppState.lotterySettings;
    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;

    // 未選択優先の場合、まず未選択の作品をプールする
    if (method === 'decrease_unselected') {
        const unselectedPool = pool.filter(w => (w.selectionCount || 0) === 0);
        if (unselectedPool.length > 0) {
            pool = unselectedPool; // プールを未選択作品のみに絞る
        }
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

        // 3. 気分 (Mood) - unratedOrUntaggedOnly が false の時のみ
        if (!unratedOrUntaggedOnly) {
            const rating = work.rating || 0;
            if (mood === 'favorite') {
                const ratingWeight = [0.1, 0.2, 0.5, 1.0, 1.5, 2.0]; // 評価0～5
                weight *= ratingWeight[rating];
            }
        }

        return { ...work, weight: Math.max(1, weight) }; // 最低でも重み1を保証
    });
};

export const openLotterySettingsModal = (App, tempState = null) => {
    const source = tempState || AppState.lotterySettings;
    const state = {
        ...source,
        genres: new Set(source.genres),
        sites: new Set(source.sites),
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
            
            // 修正: クラスに max-h-40 overflow-y-auto を追加して高さ制限
            gridEl.className = "grid grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar";
            
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
                if (!preset) {
                    if (id === 'relax') preset = { settings: { priority: 'old', method: 'decrease_unselected', unratedOrUntaggedOnly: false, mood: 'default' } };
                    if (id === 'new') preset = { settings: { priority: 'new', unratedOrUntaggedOnly: true } };
                    if (id === 'masterpiece') preset = { settings: { priority: 'random', method: 'normal', unratedOrUntaggedOnly: false, mood: 'best' } };
                }
                if (preset) {
                    const s = preset.settings;
                    const newState = {
                        ...AppState.lotterySettings,
                        genres: new Set(s.genres || []), sites: new Set(s.sites || []),
                        andTagIds: new Set(s.andTagIds || []), orTagIds: new Set(s.orTagIds || []), notTagIds: new Set(s.notTagIds || []),
                        ...s 
                    };
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
                        genres: [...getSelectedSet('lottery-genre')],
                        sites: [...getSelectedSet('lottery-site')],
                        andTagIds: [...tempAndTags], orTagIds: [...tempOrTags], notTagIds: [...tempNotTags],
                    }
                };
                AppState.customPresets.push(newPreset);
                const encrypted = App.encryptData(AppState.customPresets);
                if (encrypted) localStorage.setItem('customPresets_encrypted', encrypted);
                renderPresets();
                App.showToast(`プリセット「${name}」を保存しました。`);
            }
        });

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
            App.openHelpModal();
        });
        updatePreview();
    }, { size: 'max-w-4xl' });
};

export const openHelpModal = (App) => {
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
    App.openModal("ヘルプ：抽選設定", content);
};

export const performLottery = async (App) => {
    const weightedPool = App.getLotteryPool();
    if (weightedPool.length === 0) return App.showToast("抽選対象の作品がありません。");
    
    const totalWeight = weightedPool.reduce((sum, work) => sum + work.weight, 0);
    if (totalWeight <= 0) return App.showToast("抽選対象の作品がありません (重み合計が0以下)。");

    let random = Math.random() * totalWeight;
    let selectedWork = weightedPool.find(work => (random -= work.weight) <= 0) || weightedPool[weightedPool.length - 1];
    
    localStorage.setItem('lastSelectedWorkId', selectedWork.id);
    
    // ▼▼▼ 追加: リロード対策として、評価待ちの作品IDを保存 ▼▼▼
    localStorage.setItem('r18_pending_feedback_work_id', selectedWork.id);
    // ▲▲▲ 追加終了 ▲▲▲

    if (!AppState.isDebugMode) {
        const newHistoryEntry = Timestamp.now();
        await App.updateWork(selectedWork.id, {
            selectionCount: (selectedWork.selectionCount || 0) + 1, 
            lastSelectedAt: newHistoryEntry,
            selectionHistory: arrayUnion(newHistoryEntry)
        });
    } else {
            const workIndex = AppState.works.findIndex(w => w.id === selectedWork.id);
            if (workIndex !== -1) {
            AppState.works[workIndex].selectionCount = (AppState.works[workIndex].selectionCount || 0) + 1;
            const now = Timestamp.now();
            AppState.works[workIndex].lastSelectedAt = now;
            if (!AppState.works[workIndex].selectionHistory) {
                AppState.works[workIndex].selectionHistory = [];
            }
            if (Array.isArray(AppState.works[workIndex].selectionHistory)) {
                AppState.works[workIndex].selectionHistory.push(now);
            } else {
                console.warn(`selectionHistory for work ${selectedWork.id} was not an array. Resetting.`);
                AppState.works[workIndex].selectionHistory = [now];
            }
            }
    }
    App.openLotteryResultModal(selectedWork);
};

export const openLotteryResultModal = (work, App, tempState = null) => {
    let currentRating = tempState?.rating ?? (work.rating || 0);
    let currentTagIds = tempState?.tagIds ?? new Set(work.tagIds || []);

    // ★修正: ここで文字列としてバッジを作成するように変更
    const getBadgeStr = (url) => {
        if (!url) return '';
        const lower = url.toLowerCase();
        const cls = "absolute top-1.5 left-1.5 h-4 flex items-center justify-center px-1 text-[10px] font-extrabold rounded shadow-md pointer-events-none z-50 text-white";
        if (lower.includes('dlsite.com')) return `<span class="${cls} bg-sky-600">DL</span>`;
        if (lower.includes('dmm.co.jp') || lower.includes('dmm.com')) return `<span class="${cls} bg-red-600">FZ</span>`;
        return '';
    };
    const siteBadge = getBadgeStr(work.sourceUrl);

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
};

export const openFeedbackModal = (work, App, tempState = null) => {
    let currentRating = tempState?.rating ?? (work.rating || 0);
    let currentTagIds = tempState?.tagIds ?? new Set(work.tagIds || []);

    const getFormState = () => ({
        rating: currentRating,
        tagIds: JSON.stringify([...currentTagIds].sort())
    });
    const initialState = getFormState();
    AppState.checkModalDirtyState = () => JSON.stringify(initialState) !== JSON.stringify(getFormState());

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

    App.openModal("前回の作品の評価", content, () => {
        const ratingStars = $('#feedback-rating');
        const saveBtn = $('#feedback-save-btn');
        const tagsContainer = $('#feedback-tags');

        const checkSaveButton = () => {
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
                    checkSaveButton();
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

        $('#feedback-assign-tags-btn').addEventListener('click', () => {
            App.openTagModal({
                mode: 'assign', workId: work.id, currentTagIds, workName: work.name,
                onConfirm: (newIds) => {
                    if(newIds !== null) { currentTagIds = newIds; }
                    App.openFeedbackModal(work, { rating: currentRating, tagIds: currentTagIds });
                }
            });
        });

        // ▼▼▼ 修正: 「また今度」ボタンで保留状態を解除 ▼▼▼
        $('#feedback-later-btn').addEventListener('click', () => {
            localStorage.removeItem('r18_pending_feedback_work_id');
            App.closeModal();
        });
        // ▲▲▲ 修正終了 ▲▲▲

        // ▼▼▼ 修正: 保存成功時に保留状態を解除 ▼▼▼
        saveBtn.addEventListener('click', async () => {
            AppState.checkModalDirtyState = () => false;
            if (await App.updateWork(work.id, { rating: currentRating, tagIds: Array.from(currentTagIds) })) {
                localStorage.removeItem('r18_pending_feedback_work_id');
                App.showToast(`「${work.name}」の情報を更新しました。`); 
                App.closeModal();
            }
        });
        checkSaveButton();
    });
};