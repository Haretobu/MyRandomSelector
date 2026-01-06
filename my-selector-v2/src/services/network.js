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
        
        // 何度も出ないようにセッションストレージ等で制御しても良いが、今回はシンプルにトースト通知
        // ユーザーが意図的に通常モードを選んでいる可能性もあるため、強制はしない
        UI.showToast(
            `回線速度が低下しています。<br>動作が重い場合は<button id="toast-switch-lite" class="underline font-bold ml-1">Liteモード</button>へ切り替えてください。`,
            'warning',
            8000
        );
        
        setTimeout(() => {
            const btn = document.getElementById('toast-switch-lite');
            if (btn) {
                btn.addEventListener('click', () => {
                    localStorage.setItem('isLiteMode', 'true');
                    location.reload();
                });
            }
        }, 100);
    }
};