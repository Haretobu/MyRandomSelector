// src/bms/components/ControllerPanel.jsx
import React, { forwardRef, useImperativeHandle, useRef, memo } from 'react';
import { Gamepad2, Keyboard } from 'lucide-react';
import { LANE_LAYOUTS, PMS_LANE_COLORS } from '../constants';
import DensityGraph from './DensityGraph';

const SP_KEY_LABEL = { 1: 'Z', 2: 'S', 3: 'X', 4: 'D', 5: 'C', 6: 'F', 7: 'V' };

const keyNum = (lane) => (lane.side === 0 ? lane.index : lane.index - 8); // 1..7

function keyLabel(lane, mode) {
    if (lane.kind === 'scratch') return lane.side === 1 ? '2SC' : 'SC';
    if (mode === 'SP7' || mode === 'SP5') return SP_KEY_LABEL[lane.index] || String(lane.index);
    if (mode === 'PMS9') return String(lane.index + 1);
    return String(keyNum(lane)); // DP: 1-7
}

// IIDX 片側 (皿 + 鍵)。IIDX 実機準拠のスタッガード配置(偶数鍵=黒鍵を上げる)。
function IIDXSide({ lanes, mirror, compact, controllerRefs, countRefs }) {
    const scr = lanes.find(l => l.kind === 'scratch');
    const keys = lanes.filter(l => l.kind === 'key').sort((a, b) => keyNum(a) - keyNum(b));
    const tt = compact ? 40 : 68;
    const bkW = compact ? 9 : 15, wkW = compact ? 13 : 22;
    const bkH = compact ? 50 : 72, wkH = compact ? 42 : 60;
    const raise = compact ? 12 : 18;

    const KeyBar = (lane) => {
        const black = keyNum(lane) % 2 === 0;
        return (
            <div key={lane.index} className="flex flex-col items-center" style={{ gap: 2, marginBottom: black ? raise : 0 }}>
                <div ref={el => (countRefs.current[lane.index] = el)} className="text-[7px] text-blue-400/70 font-mono leading-none">0</div>
                <div ref={el => (controllerRefs.current[lane.index] = el)}
                    style={{
                        width: black ? bkW : wkW, height: black ? bkH : wkH,
                        background: '#0b0f1a', borderRadius: 3,
                        border: `1px solid ${black ? '#3b82f688' : '#e2e8f088'}`,
                    }} />
            </div>
        );
    };

    const TT = scr && (
        <div key="tt" className="flex flex-col items-center" style={{ gap: 2 }}>
            <div ref={el => (countRefs.current[scr.index] = el)} className="text-[7px] text-blue-400/70 font-mono leading-none">0</div>
            <div ref={el => (controllerRefs.current[scr.index] = el)}
                className="rounded-full border-[3px] border-[#1e293b] bg-neutral-900 flex items-center justify-center relative overflow-hidden"
                style={{ width: tt, height: tt, willChange: 'transform' }}>
                <div className="absolute w-full h-[2px] bg-gray-600/40" />
                <div className="absolute w-full h-[2px] bg-gray-600/40 rotate-45" />
                <div className="absolute w-full h-[2px] bg-gray-600/40 rotate-90" />
                <div className="absolute w-full h-[2px] bg-gray-600/40 -rotate-45" />
                <span className="text-[7px] text-blue-500/50 font-bold z-10">SC</span>
            </div>
        </div>
    );

    // 2P(mirror)は「鍵1-7 → 皿」の順(皿が右)。鍵の並びは反転しない。
    const kids = mirror ? [...keys.map(KeyBar), TT] : [TT, ...keys.map(KeyBar)];
    return <div className="flex items-end" style={{ gap: compact ? 1 : 2 }}>{kids}</div>;
}

// pop'n 9ボタン。1,3,5,7,9 が下段、2,4,6,8 が上段(実機準拠)。
function PopnBoard({ lanes, controllerRefs, countRefs }) {
    return (
        <div className="flex items-end justify-center gap-1.5">
            {lanes.map(lane => {
                const raised = (lane.index % 2 === 1); // ボタン2,4,6,8 (0-index の 1,3,5,7)
                return (
                    <div key={lane.index} className="flex flex-col items-center" style={{ gap: 2, marginBottom: raised ? 16 : 0 }}>
                        <div ref={el => (countRefs.current[lane.index] = el)} className="text-[7px] text-blue-400/70 font-mono leading-none">0</div>
                        <div ref={el => (controllerRefs.current[lane.index] = el)}
                            className="rounded-full"
                            style={{ width: 20, height: 20, background: '#0b0f1a', border: `2px solid ${PMS_LANE_COLORS[lane.index]}99` }} />
                        <div className="text-[7px] font-bold leading-none" style={{ color: PMS_LANE_COLORS[lane.index] }}>{lane.index + 1}</div>
                    </div>
                );
            })}
        </div>
    );
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
    const isDP = mode === 'DP14' || mode === 'DP10';
    const side1 = lanes.filter(l => l.side === 0);
    const side2 = lanes.filter(l => l.side === 1);

    return (
        <div className="w-64 flex flex-col border-r border-blue-900/30 bg-[#080808] p-2 gap-2 shrink-0 overflow-y-auto scrollbar-hide text-blue-100">
            {/* CONTROLLER */}
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1"><Gamepad2 size={10} /> CONTROLLER</span>
                    <span className="text-[9px] text-blue-500/60">{parsedSong?.keyMode || '—'}</span>
                </div>
                <div className="flex items-end justify-center gap-3 min-h-[110px] bg-black/60 rounded border border-blue-900/30 px-2 pt-2 pb-1 overflow-x-auto scrollbar-hide">
                    {mode === 'PMS9'
                        ? <PopnBoard lanes={lanes} controllerRefs={controllerRefs} countRefs={countRefs} />
                        : isDP
                            ? (<>
                                <IIDXSide lanes={side1} mirror={false} compact controllerRefs={controllerRefs} countRefs={countRefs} />
                                <div className="w-px self-stretch bg-blue-900/40" />
                                <IIDXSide lanes={side2} mirror compact controllerRefs={controllerRefs} countRefs={countRefs} />
                            </>)
                            : <IIDXSide lanes={side1} mirror={false} compact={false} controllerRefs={controllerRefs} countRefs={countRefs} />}
                </div>
            </div>

            {/* KEY MAPPING */}
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center gap-1"><Keyboard size={10} /> KEY MAPPING</div>
                <div className="flex flex-wrap gap-1 justify-center">
                    {lanes.map((lane, i) => {
                        const gap = i > 0 && lanes[i - 1].side !== lane.side;
                        return (
                            <React.Fragment key={lane.index}>
                                {gap && <div className="basis-full h-0" />}
                                <div ref={el => (keyboardRefs.current[lane.index] = el)}
                                    className="w-7 h-7 rounded text-[9px] font-bold flex items-center justify-center border border-blue-900/40"
                                    style={{ background: '#0f172a', color: lane.kind === 'scratch' ? '#fca5a5' : '#93a0be' }}>
                                    {keyLabel(lane, mode)}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
                {(isDP || mode === 'PMS9') && (
                    <div className="text-[9px] text-blue-500/50 mt-1.5 text-center">キー割り当ての変更は今後対応</div>
                )}
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
