import * as UI from '../components/ui.js';

export const NetworkService = {
    connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection,
    isSlow: false,
    
    init(App) {
        this.App = App;
        this.updateConnectionStatus();
        
        if (this.connection) {
            this.connection.addEventListener('change', () => this.updateConnectionStatus());
        }

        // 初期ロード時に極端に遅い場合も検知（簡易的）
        window.addEventListener('load', () => {
            // Navigation Timing APIでロード時間をチェック
            const perf = performance.getEntriesByType("navigation")[0];
            if (perf && perf.duration > 5000) { // 5秒以上かかったら遅いとみなす
                this.suggestLiteMode();
            }
        });
    },

    updateConnectionStatus() {
        const type = this.connection ? this.connection.effectiveType : 'unknown';
        const downlink = this.connection ? this.connection.downlink : 10; // Mbps
        
        // 4g未満、または下り速度が1Mbps未満なら遅いと判断
        this.isSlow = (type === '2g' || type === '3g' || downlink < 1.0);

        this.renderStatusIcon(type, downlink);
        
        if (this.isSlow) {
            this.suggestLiteMode();
        }
    },

    renderStatusIcon(type, downlink) {
        let iconEl = document.getElementById('network-status-icon');
        if (!iconEl) {
            // バージョン表示の隣あたりに追加
            const versionEl = document.getElementById('version-display');
            if (versionEl) {
                iconEl = document.createElement('div');
                iconEl.id = 'network-status-icon';
                iconEl.className = 'fixed top-2 right-20 z-[60] text-xs font-mono px-2 py-0.5 rounded bg-gray-800/80 border border-gray-600 flex items-center gap-1 transition-colors';
                document.body.appendChild(iconEl);
            }
        }

        if (iconEl) {
            let color = 'text-green-400';
            let icon = 'fa-signal';
            
            if (this.isSlow) {
                color = 'text-red-400';
                icon = 'fa-exclamation-circle';
            } else if (downlink < 5) {
                color = 'text-yellow-400';
            }

            iconEl.innerHTML = `<i class="fas ${icon} ${color}"></i> <span class="text-gray-300">${type.toUpperCase()}</span>`;
            iconEl.title = `Downlink: ~${downlink}Mbps`;
        }
    },

    suggestLiteMode() {
        // 既にLiteモードなら何もしない
        if (this.App.AppState.isLiteMode) return;
        
        // スヌーズ（再確認しない）期間のチェック（例: 30分 = 30 * 60 * 1000 ミリ秒）
        const SNOOZE_DURATION_MS = 30 * 60 * 1000;
        const snoozeUntil = localStorage.getItem('liteModePromptSnoozeUntil');
        
        // スヌーズ期間中であれば、ダイアログを出さずに処理を終了
        if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
            return; 
        }

        // 既に他のモーダル（評価や編集画面など）が開いている場合は作業の邪魔をしないよう表示しない
        if (this.App.AppState.ui && !this.App.AppState.ui.modalWrapper.classList.contains('hidden')) {
            return;
        }

        // モーダルに表示するHTML（チェックボックス付き）
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

        // main.js で定義されている openModal を呼び出す
        this.App.openModal("Liteモードへの移行確認", contentHtml, () => {
            const snoozeCheckbox = document.getElementById('snooze-lite-prompt');
            
            // 「そのまま待機」を選んだ場合の処理
            document.getElementById('btn-lite-no').addEventListener('click', () => {
                if (snoozeCheckbox && snoozeCheckbox.checked) {
                    localStorage.setItem('liteModePromptSnoozeUntil', Date.now() + SNOOZE_DURATION_MS);
                }
                this.App.closeModal(); // モーダルを閉じる
            });

            // 「Liteモードへ移行」を選んだ場合の処理
            document.getElementById('btn-lite-yes').addEventListener('click', () => {
                if (snoozeCheckbox && snoozeCheckbox.checked) {
                    localStorage.setItem('liteModePromptSnoozeUntil', Date.now() + SNOOZE_DURATION_MS);
                }
                localStorage.setItem('isLiteMode', 'true');
                location.reload(); // Liteモードを有効にしてリロード
            });
        }, { size: 'max-w-md' });
    }
};