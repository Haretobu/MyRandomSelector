// src/bms/components/ControllerPanel.jsx
import React, { forwardRef, useImperativeHandle, useRef, memo } from 'react';
import { Gamepad2, Keyboard } from 'lucide-react';
import { LANE_LAYOUTS, PMS_LANE_COLORS, keyCodeLabel } from '../constants';
import DensityGraph from './DensityGraph';

const SP_KEY_LABEL = { 1: 'Z', 2: 'S', 3: 'X', 4: 'D', 5: 'C', 6: 'F', 7: 'V' };
const keyNum = (lane) => (lane.side === 0 ? lane.index : lane.index - 8); // 1..7

function keyLabel(lane, mode, keyMap) {
    if (keyMap && keyMap[lane.index]) return keyCodeLabel(keyMap[lane.index]);
    if (lane.kind === 'scratch') return lane.side === 1 ? '2SC' : 'SC';
    if (mode === 'SP7' || mode === 'SP5') return SP_KEY_LABEL[lane.index] || String(lane.index);
    if (mode === 'PMS9') return String(lane.index + 1);
    return String(keyNum(lane));
}

// IIDX 片側: 皿(外側) + 鍵(上段=2,4,6 / 下段=1,3,5,7)。size='s'(DP) / 'l'(SP)。
function IIDXSide({ lanes, mirror, size, refFn, countRefs, showLabel, showCount, mode, keyMap, scratchShape = 'disc' }) {
    const scr = lanes.find(l => l.kind === 'scratch');
    const keys = lanes.filter(l => l.kind === 'key').sort((a, b) => keyNum(a) - keyNum(b));
    const top = keys.filter(k => keyNum(k) % 2 === 0);   // 2,4,6
    const bot = keys.filter(k => keyNum(k) % 2 === 1);    // 1,3,5,7,(9)
    const tt = size === 's' ? 40 : 64;
    const kw = size === 's' ? 12 : 21;
    const kh = size === 's' ? 17 : 27;
    const gap = size === 's' ? 2 : 4;

    const wrap = (lane, node) => (
        <div key={lane.index} className="flex flex-col items-center">
            {showCount && <div ref={el => (countRefs.current[lane.index] = el)} className="text-[7px] text-blue-400/60 font-mono leading-none mb-px">0</div>}
            {node}
            {showLabel && (
                <div className="text-[7px] font-bold leading-none mt-px whitespace-nowrap"
                    style={{ color: lane.kind === 'scratch' ? '#f87171' : keyNum(lane) % 2 === 0 ? '#60a5fa' : '#cbd5e1' }}>
                    {keyLabel(lane, mode, keyMap)}
                </div>
            )}
        </div>
    );

    const Btn = (lane) => wrap(lane, (
        <div ref={el => refFn(lane.index, el)}
            style={{ width: kw, height: kh, background: '#0b0f1a', borderRadius: 3, border: `1px solid ${(keyNum(lane) % 2 === 0 ? '#3b82f6' : '#e2e8f0')}66` }} />
    ));

    const Scratch = scr && wrap(scr, scratchShape === 'bar'
        ? (
            <div ref={el => refFn(scr.index, el)}
                style={{ width: kw * 2 + gap, height: kh, background: '#0b0f1a', borderRadius: 3, border: '1px solid #f8717188' }} />
        )
        : (
            <div ref={el => refFn(scr.index, el)}
                className="rounded-full border-[3px] border-[#1e293b] bg-neutral-900 relative overflow-hidden shrink-0"
                style={{ width: tt, height: tt, willChange: 'transform' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute w-full h-px bg-gray-600/40" />
                    <div className="absolute w-full h-px bg-gray-600/40 rotate-45" />
                    <div className="absolute w-full h-px bg-gray-600/40 rotate-90" />
                    <div className="absolute w-full h-px bg-gray-600/40 -rotate-45" />
                </div>
            </div>
        ));

    const Keys = (
        <div className="flex flex-col items-center" style={{ gap }}>
            <div className="flex" style={{ gap, paddingLeft: (kw + gap) / 2 }}>{top.map(Btn)}</div>
            <div className="flex" style={{ gap }}>{bot.map(Btn)}</div>
        </div>
    );

    return (
        <div className="flex items-center" style={{ gap: gap + 2 }}>
            {!mirror && Scratch}{Keys}{mirror && Scratch}
        </div>
    );
}

// pop'n 9K: 白青黄緑赤の5色ミラー配置、偶数番(2,4,6,8)を少し上げる。
function PopnBoard({ lanes, refFn, countRefs, showLabel, showCount, keyMap }) {
    return (
        <div className="flex items-end justify-center" style={{ gap: 4 }}>
            {lanes.map(lane => {
                const raised = lane.index % 2 === 1;
                return (
                    <div key={lane.index} className="flex flex-col items-center" style={{ gap: 1, marginBottom: raised ? 12 : 0 }}>
                        {showCount && <div ref={el => (countRefs.current[lane.index] = el)} className="text-[7px] text-blue-400/60 font-mono leading-none">0</div>}
                        <div ref={el => refFn(lane.index, el)} className="rounded-full"
                            style={{ width: 20, height: 20, background: '#0b0f1a', border: `2px solid ${PMS_LANE_COLORS[lane.index]}99` }} />
                        {showLabel && <div className="text-[7px] font-bold leading-none whitespace-nowrap" style={{ color: PMS_LANE_COLORS[lane.index] }}>{keyLabel(lane, 'PMS9', keyMap)}</div>}
                    </div>
                );
            })}
        </div>
    );
}

const ControllerPanel = forwardRef(({ controllerRefs, keyboardRefs, parsedSong, difficultyInfo, currentMeasure, is2P, keyMap }, ref) => {
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
    const isDP = mode === 'DP14' || mode === 'DP10';
    const isPms = mode === 'PMS9';
    const s1 = lanes.filter(l => l.side === 0);
    const s2 = lanes.filter(l => l.side === 1);
    const setCtrl = (i, el) => { controllerRefs.current[i] = el; };
    const setKb = (i, el) => { keyboardRefs.current[i] = el; };

    // showCount=true は CONTROLLER のみ(countRefs が指す要素を一意にするため)
    const board = (refFn, { showLabel = false, showCount = false, scratchShape = 'disc' } = {}) => {
        const common = { refFn, countRefs, showLabel, showCount, scratchShape, mode, keyMap };
        return isPms
            ? <PopnBoard lanes={lanes} refFn={refFn} countRefs={countRefs} showLabel={showLabel} showCount={showCount} keyMap={keyMap} />
            : isDP
                ? (
                    <div className="flex items-center justify-center gap-1">
                        <IIDXSide lanes={s1} mirror={false} size="s" {...common} />
                        <div className="w-px self-stretch bg-blue-900/40 mx-0.5" />
                        <IIDXSide lanes={s2} mirror size="s" {...common} />
                    </div>
                )
                : <div className="flex justify-center"><IIDXSide lanes={s1} mirror={!!is2P} size="l" {...common} /></div>;
    };

    return (
        <div className="w-64 flex flex-col border-r border-blue-900/30 bg-[#080808] p-2 gap-2 shrink-0 overflow-y-auto scrollbar-hide text-blue-100">
            {/* CONTROLLER */}
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-1.5 flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1"><Gamepad2 size={10} /> CONTROLLER</span>
                    <span className="text-[9px] text-blue-500/60">{parsedSong?.keyMode || '—'}</span>
                </div>
                <div className="bg-black/60 rounded border border-blue-900/30 py-2 px-1 flex items-center justify-center">
                    {board(setCtrl, { showCount: true })}
                </div>
            </div>

            {/* KEY MAPPING (同じ配置でラベル表示) */}
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-1.5 flex items-center gap-1"><Keyboard size={10} /> KEY MAPPING</div>
                <div className="bg-black/40 rounded py-2 px-1 flex items-center justify-center">
                    {board(setKb, { showLabel: true, scratchShape: 'bar' })}
                </div>
                {(isDP || isPms) && <div className="text-[9px] text-blue-500/50 mt-1 text-center">キー割り当ての変更は今後対応</div>}
            </div>

            <DensityGraph parsedSong={parsedSong} currentMeasure={currentMeasure} />

            {/* 曲情報パネル */}
            <div className="bg-[#0f172a] p-4 rounded mt-auto border border-blue-900/30 min-h-[120px] flex flex-col justify-center items-center text-center shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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
