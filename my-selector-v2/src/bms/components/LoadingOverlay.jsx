// src/bms/components/LoadingOverlay.jsx
// 読み込み中の表示(ZIP 解凍 / BMS 解析 / 音声デコードの進捗)。クリックは下の画面に通す。
// progress: 0〜100(%)。null のときは進捗バーを出さない(数値で分かるのは音声デコード中だけ)。
import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';

function LoadingOverlay({ message, progress }) {
    const showBar = progress !== null && progress !== undefined;
    return (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none" role="status" aria-live="polite">
            <div className="bg-[#0f172a]/90 border border-blue-900/50 rounded-lg shadow-2xl px-6 py-4 min-w-[260px] max-w-[80%] backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-100">
                    <Loader2 size={16} className="animate-spin text-blue-400 shrink-0" />
                    <span className="truncate">{message || '読み込み中...'}</span>
                </div>
                {showBar && (
                    <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-[width] duration-150" style={{ width: `${Math.min(100, progress)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-blue-300 w-8 text-right">{Math.round(progress)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default memo(LoadingOverlay);
