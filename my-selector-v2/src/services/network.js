// src/services/network.js
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
        // ※初期ロード時の遅延検知ロジック(suggestLiteModeの呼び出し)を削除しました
    },

    updateConnectionStatus() {
        const type = this.connection ? this.connection.effectiveType : 'unknown';
        const downlink = this.connection ? this.connection.downlink : 10; // Mbps
        
        // 4g未満、または下り速度が1Mbps未満なら遅いと判断
        this.isSlow = (type === '2g' || type === '3g' || downlink < 1.0);

        this.renderStatusIcon(type, downlink);
        
        // ※通信速度低下時の suggestLiteMode() 呼び出しを削除しました
    },

    renderStatusIcon(type, downlink) {
        let iconEl = document.getElementById('network-status-icon');
        if (!iconEl) {
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
    }
    // ※ suggestLiteMode() 関数自体を完全に削除しました
};