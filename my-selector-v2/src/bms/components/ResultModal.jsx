// src/bms/components/ResultModal.jsx
import React, { memo } from 'react';
import { X, RotateCcw, Trophy } from 'lucide-react';

const JUDGE_ROWS = [
    ['PGREAT', 'pg', '#22d3ee'],
    ['GREAT', 'gr', '#fde047'],
    ['GOOD', 'gd', '#4ade80'],
    ['BAD', 'bd', '#fb923c'],
    ['POOR', 'poor', '#f87171'],
    ['空POOR', 'epoor', '#94a3b8'],
];

function ResultModal({ data, onClose, onRetry }) {
    if (!data) return null;
    const pct = (data.rate * 100).toFixed(2);
    const clearPct = data.total ? ((data.judged / data.total) * 100).toFixed(1) : '0.0';

    return (
        <div className="fixed inset-0 z-[110] bg-black/85 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#080808] w-full max-w-[460px] border-2 border-blue-900/50 shadow-2xl rounded-xl p-6 relative text-blue-100 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-blue-400 hover:text-white p-1.5 bg-white/10 rounded-full transition"><X size={18} /></button>

                <div className="text-center">
                    <div className="text-[11px] font-bold tracking-widest text-blue-400/80">{data.finished ? 'STAGE CLEAR' : 'RESULT (中断)'}</div>
                    <div className="text-sm font-bold text-white truncate mt-1">{data.title}</div>
                    <div className="text-[11px] text-blue-300/70">{data.keyMode}{data.level && data.level !== '—' ? ` ・ LEVEL ${data.level}` : ''}</div>
                </div>

                <div className="flex items-center justify-center gap-4 py-2 border-y border-blue-900/40">
                    <Trophy size={28} className="text-yellow-400" />
                    <div className="text-5xl font-black text-white tracking-tight">{data.djLevel}</div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white font-mono leading-none">{data.exScore}<span className="text-blue-500/60 text-sm"> / {data.maxEx}</span></div>
                        <div className="text-[11px] text-blue-300/80 font-mono">EX SCORE ・ {pct}%</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm font-mono">
                    {JUDGE_ROWS.map(([label, key, col]) => (
                        <div key={key} className="flex justify-between items-baseline">
                            <span style={{ color: col }} className="text-[12px] font-bold">{label}</span>
                            <span className="text-white">{data[key]}</span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] bg-black/30 rounded p-2 border border-blue-900/40">
                    <div><div className="text-blue-400/70">MAX COMBO</div><div className="text-white font-bold text-base font-mono">{data.maxCombo}</div></div>
                    <div><div className="text-blue-400/70">FAST / SLOW</div><div className="font-bold text-base font-mono"><span className="text-blue-400">{data.fast}</span> / <span className="text-red-400">{data.slow}</span></div></div>
                    <div><div className="text-blue-400/70">判定率</div><div className="text-white font-bold text-base font-mono">{clearPct}%</div></div>
                </div>

                {data.offset ? <div className="text-[10px] text-blue-500/60 text-center font-mono">判定オフセット {data.offset > 0 ? '+' : ''}{data.offset}ms</div> : null}

                <div className="flex gap-2 pt-1">
                    <button onClick={onRetry} className="flex-1 bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600/50 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition"><RotateCcw size={15} /> もう一度</button>
                    <button onClick={onClose} className="flex-1 bg-white/5 border border-blue-900/50 hover:bg-white/10 text-blue-200 font-bold py-2 rounded transition">閉じる</button>
                </div>
            </div>
        </div>
    );
}

export default memo(ResultModal);
