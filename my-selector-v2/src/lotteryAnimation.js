// src/lotteryAnimation.js
// 抽選演出（ルーレット）の管理・再生

const ANIM_SETTINGS_KEY = 'lotteryAnimationSettings_v1';

const DEFAULT_ANIM_SETTINGS = {
    enabled: true, // 演出は初期状態でON
};

export const loadAnimationSettings = () => {
    try {
        const raw = localStorage.getItem(ANIM_SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_ANIM_SETTINGS };
        return { ...DEFAULT_ANIM_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
        return { ...DEFAULT_ANIM_SETTINGS };
    }
};

export const saveAnimationSettings = (settings) => {
    localStorage.setItem(ANIM_SETTINGS_KEY, JSON.stringify(settings));
};

const CELL_WIDTH = 140; // 1コマの幅(px)
const LEAD_CELLS = 26;  // 当選コマより手前に並べるコマ数
const TAIL_CELLS = 6;   // 当選コマより後ろに並べるコマ数
const NO_IMG = 'https://placehold.co/160x160/1f2937/4b5563?text=No+Image';

const buildCellHTML = (work, escapeHTML) => `
    <div class="reel-cell flex-shrink-0 flex flex-col items-center justify-center px-2" style="width:${CELL_WIDTH}px;">
        <div class="w-24 h-24 rounded-lg overflow-hidden bg-gray-900 border-2 border-gray-700 shadow-md">
            <img src="${work.imageUrl || NO_IMG}" class="w-full h-full object-cover">
        </div>
        <p class="mt-2 text-xs text-center text-gray-300 truncate w-full">${escapeHTML(work.name)}</p>
    </div>
`;

// 抽選ルーレットのアニメーションを再生し、終わったら onComplete を呼び出す
export const playLotteryAnimation = (App, pool, selectedWork, onComplete) => {
    const others = pool.filter(w => w.id !== selectedWork.id);
    const sample = () => others.length > 0 ? others[Math.floor(Math.random() * others.length)] : selectedWork;

    const cells = [];
    for (let i = 0; i < LEAD_CELLS; i++) cells.push(sample());
    const winIndex = cells.length; // 当選コマのインデックスを記録
    cells.push(selectedWork);
    for (let i = 0; i < TAIL_CELLS; i++) cells.push(sample());

    const reelHTML = cells.map(w => buildCellHTML(w, App.escapeHTML)).join('');

    const content = `
        <div class="py-6">
            <p class="text-center text-gray-400 mb-4">抽選中…</p>
            <div class="relative bg-gray-900 rounded-xl overflow-hidden border border-gray-700" style="height:180px;">
                <div id="lottery-reel-track" class="flex items-center h-full" style="width:max-content; transform: translateX(0px);">
                    ${reelHTML}
                </div>
                <div class="absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none border-x-2 border-sky-400" style="width:${CELL_WIDTH}px;"></div>
                <div class="absolute top-0 left-1/2 -translate-x-1/2 text-sky-400 text-xl leading-none">▼</div>
                <div class="absolute bottom-0 left-1/2 -translate-x-1/2 text-sky-400 text-xl leading-none">▲</div>
            </div>
        </div>
    `;

    App.openModal("抽選中…", content, () => {
        const track = document.getElementById('lottery-reel-track');
        if (!track) { onComplete(); return; }

        const windowWidth = track.parentElement.clientWidth;
        const targetOffset = (winIndex * CELL_WIDTH) + (CELL_WIDTH / 2) - (windowWidth / 2);

        void track.offsetWidth; // 初期状態(0px)を確実に描画確定させる

        requestAnimationFrame(() => {
            track.style.transition = 'transform 4200ms cubic-bezier(0.08, 0.7, 0.1, 1)';
            track.style.transform = `translateX(-${targetOffset}px)`;
        });

        track.addEventListener('transitionend', function handler() {
            track.removeEventListener('transitionend', handler);
            const winCell = track.children[winIndex];
            if (winCell) winCell.classList.add('reel-cell-winner');
            setTimeout(() => onComplete(), 800);
        });
    }, { size: 'max-w-2xl', autoFocus: false });
};

// 演出のON/OFF設定モーダル
export const openAnimationSettingsModal = (App) => {
    const s = loadAnimationSettings();
    const content = `
        <div class="space-y-6">
            <div class="flex items-center">
                <input type="checkbox" id="anim-enabled" class="h-4 w-4 rounded bg-gray-600 text-sky-500 border-gray-500 focus:ring-sky-600" ${s.enabled ? 'checked' : ''}>
                <label for="anim-enabled" class="ml-2 text-sm font-medium">抽選時にルーレット演出を再生する</label>
            </div>
            <p class="text-xs text-gray-500">演出の内容（パターン）はここでは選べません。今後パターンが増えた場合、この設定が有効な間は毎回ランダムに選ばれて再生されます。</p>
            <div class="pt-4 flex justify-end space-x-3 border-t border-gray-700">
                <button type="button" id="anim-cancel" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">キャンセル</button>
                <button type="button" id="anim-save" class="px-6 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold text-white">保存</button>
            </div>
        </div>
    `;
    App.openModal("抽選演出の設定", content, () => {
        document.getElementById('anim-cancel').addEventListener('click', App.closeModal);
        document.getElementById('anim-save').addEventListener('click', () => {
            saveAnimationSettings({ enabled: document.getElementById('anim-enabled').checked });
            App.showToast("演出設定を保存しました。");
            App.closeModal();
        });
    }, { size: 'max-w-md' });
};