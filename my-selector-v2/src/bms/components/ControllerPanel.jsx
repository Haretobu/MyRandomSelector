// src/bms/components/ControllerPanel.jsx
import React, { forwardRef, useImperativeHandle, useRef, memo } from 'react';
import { Gamepad2, Keyboard } from 'lucide-react';
import { LANE_LAYOUTS, PMS_LANE_COLORS } from '../constants';
import DensityGraph from './DensityGraph';

const SP_KEY_LABEL = { 0: 'Sft', 1: 'Z', 2: 'S', 3: 'X', 4: 'D', 5: 'C', 6: 'F', 7: 'V' };

function laneColor(lane, pms) {
    if (pms) return PMS_LANE_COLORS[lane.index] || '#f1f5f9';
    if (lane.kind === 'scratch') return '#ef4444';
    const k = lane.side === 0 ? lane.index : lane.index - 8;
    return (k % 2 === 0) ? '#3b82f6' : '#e2e8f0';
}
function laneLabel(lane, mode) {
    if (lane.kind === 'scratch') return 'SC';
    if (mode === 'SP7' || mode === 'SP5') return SP_KEY_LABEL[lane.index] || '';
    if (mode === 'PMS9') return String(lane.index + 1);
    return String(lane.side === 0 ? lane.index : lane.index - 8); // DP: 1-7
}

const ControllerPanel = forwardRef(({ controllerRefs, keyboardRefs, parsedSong, difficultyInfo, currentMeasure }, ref) => {
    const countRefs = useRef([]);

    useImperativeHandle(ref, () => ({
        updateCounts: (arr) => {
            for (let i = 0; i < 16; i++) {
                const el = countRefs.current[i];
                const v = String(arr[i] || 0);
                if (el && el.textContent !== v) el.textContent = v;
            }
        },
    }));

    const mode = parsedSong?.mode || 'SP7';
    const lanes = parsedSong?.lanes || LANE_LAYOUTS.SP7;
    const isPms = mode === 'PMS9';

    return (
        <div className="w-64 flex flex-col border-r border-blue-900/30 bg-[#080808] p-2 gap-2 shrink-0 overflow-y-auto scrollbar-hide text-blue-100">
            {/* CONTROLLER: 板と同じレーン並び */}
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1"><Gamepad2 size={10}/> CONTROLLER</span>
                    <span className="text-[9px] text-blue-500/60">{parsedSong?.keyMode || '—'}</span>
                </div>
                <div className="flex items-end justify-center gap-[2px] h-36 bg-black/60 rounded border border-blue-900/30 px-1 py-2 overflow-hidden">
                    {lanes.map((lane, i) => {
                        const col = laneColor(lane, isPms);
                        const gap = i > 0 && lanes[i - 1].side !== lane.side;
                        const scr = lane.kind === 'scratch';
                        return (
                            <React.Fragment key={lane.index}>
                                {gap && <div className="w-1.5 shrink-0" />}
                                <div className="flex flex-col items-center gap-0.5 shrink-0" style={{ marginBottom: i % 2 === 0 ? 0 : 8 }}>
                                    <div ref={el => (countRefs.current[lane.index] = el)} className="text-[7px] text-blue-400/70 font-mono leading-none">0</div>
                                    <div
                                        ref={el => { controllerRefs.current[lane.index] = el; }}
                                        className="rounded-sm transition-all duration-75"
                                        style={{ width: scr ? 15 : 10, height: scr ? 84 : 96, background: '#0b0f1a', border: `1px solid ${col}66` }}
                                    />
                                    <div className="text-[7px] font-bold leading-none" style={{ color: col }}>{laneLabel(lane, mode)}</div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* KEY MAPPING: レーンごとのキーチップ (点灯表示) */}
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center gap-1"><Keyboard size={10}/> KEY MAPPING</div>
                <div className="flex flex-wrap gap-1 justify-center">
                    {lanes.map((lane, i) => {
                        const gap = i > 0 && lanes[i - 1].side !== lane.side;
                        return (
                            <React.Fragment key={lane.index}>
                                {gap && <div className="basis-full h-0" />}
                                <div
                                    ref={el => { keyboardRefs.current[lane.index] = el; }}
                                    className="w-7 h-7 rounded text-[9px] font-bold flex items-center justify-center border border-blue-900/40 transition-all duration-75"
                                    style={{ background: '#0f172a', color: lane.kind === 'scratch' ? '#fca5a5' : '#93a0be' }}
                                >
                                    {laneLabel(lane, mode)}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
                {(mode === 'DP14' || mode === 'DP10' || mode === 'PMS9') && (
                    <div className="text-[9px] text-blue-500/50 mt-1.5 text-center">キー割り当ての変更は今後対応</div>
                )}
            </div>

            <DensityGraph parsedSong={parsedSong} currentMeasure={currentMeasure} />

            {/* 曲情報パネル */}
            <div className="bg-[#0f172a] p-4 rounded mt-auto border border-blue-900/30 min-h-[120px] flex flex-col justify-center items-center text-center shadow-lg relative overflow-hidden group">
                 <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
                 {parsedSong ? (
                      <>
                        <div className="text-sm font-bold text-white break-words w-full leading-tight mb-1 drop-shadow-md">{parsedSong.header.title}</div>
                        <div className="text-xs text-blue-300 truncate w-full mb-3 opacity-80">{parsedSong.header.artist}</div>
                        <div className="flex justify-center gap-2 text-[10px] font-bold w-full">
                            <div className="bg-black/40 px-2 py-1 rounded border border-blue-500/20 flex-1 min-w-[50px]"><span className="text-blue-400 block text-[8px] leading-none mb-0.5">KEY</span><span className="text-white">{parsedSong.keyMode || '—'}</span></div>
                            <div className="bg-black/40 px-2 py-1 rounded border border-blue-500/20 flex-1 min-w-[50px]"><span className="text-blue-400 block text-[8px] leading-none mb-0.5">LEVEL</span><span className="text-white">{parsedSong.header.playlevel || '—'}</span></div>
                         </div>
                        <div className="bg-black/40 px-2 py-1 rounded border border-blue-500/20 w-full mt-1 text-[10px] font-bold">
                            <span className="text-blue-400 block text-[8px] leading-none mb-0.5">BPM</span>
                            <span className="text-white font-mono">{(() => {
                                const r = parsedSong.bpmRange;
                                if (!r) return parsedSong.header.bpm;
                                if (r.min === r.max || r.count <= 1) return `${r.main}`;
                                if (r.count === 2 || r.main === r.min || r.main === r.max) return `${r.min}～${r.max}`;
                                return `${r.min}～${r.main}～${r.max}`;
                            })()}</span>
                        </div>
                        <div className={`mt-2 w-full text-center text-[10px] font-bold text-white py-0.5 rounded shadow-sm ${difficultyInfo.color}`}>{difficultyInfo.label}</div>
                      </>
                 ) : <span className="text-blue-500/50 text-xs">NO DATA LOADED</span>}
            </div>
         </div>
    );
});

export default memo(ControllerPanel);
