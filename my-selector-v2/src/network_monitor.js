import { store as AppState } from './store/store.js';

export const NetworkMonitor = {
    checkConnection: (App) => {
        // Navigator Connection API (Chrome/Android等)
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const speedEl = document.getElementById('network-speed-indicator');
        
        if (connection) {
            const updateNetworkInfo = () => {
                const type = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
                const downlink = connection.downlink; // Mb/s
                
                let colorClass = 'text-green-400';
                let icon = 'fa-wifi';
                
                if (type === '4g' && downlink > 5) {
                    // Good
                } else if (type === '3g' || downlink < 1.5) {
                    colorClass = 'text-yellow-400';
                    if (!AppState.isLiteMode && !AppState.hasSuggestedLiteMode) {
                        NetworkMonitor.suggestLiteMode(App);
                    }
                } else {
                    colorClass = 'text-red-400';
                    icon = 'fa-exclamation-triangle';
                }

                if (speedEl) {
                    speedEl.innerHTML = `<i class="fas ${icon} ${colorClass} mr-1"></i><span class="text-xs text-gray-400">${downlink}Mbps (${type})</span>`;
                    speedEl.classList.remove('hidden');
                }
            };

            connection.addEventListener('change', updateNetworkInfo);
            updateNetworkInfo();
        }
    },

    suggestLiteMode: async (App) => {
        AppState.hasSuggestedLiteMode = true; // 一度だけ提案
        const confirmed = await App.showConfirm(
            "通信速度の低下を検知",
            "ネットワーク速度が低下している可能性があります。<br>画像を制限し、動作を軽くする「Liteモード」に切り替えますか？"
        );
        
        if (confirmed) {
            AppState.isLiteMode = true;
            localStorage.setItem('isLiteMode', 'true');
            location.reload();
        }
    }
};