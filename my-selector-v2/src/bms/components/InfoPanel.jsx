// src/bms/components/InfoPanel.jsx
import React, { forwardRef, useImperativeHandle, useRef, memo } from 'react';
import { Settings, Image as ImageIcon } from 'lucide-react';
import BgaLayer from './BgaLayer';

const InfoPanel = forwardRef(({
    setShowSettings, playOption,
    currentBackBga, currentLayerBga, currentPoorBga,
    showMissLayer, isPlaying,
    playBgaVideo, readyAnimState,
    currentMeasureLines, totalNotes,
}, ref) => {

    const comboTextRef = useRef(null);
    const notesTextRef = useRef(null);
    const backBgaRef = useRef(null);
    const layerBgaRef = useRef(null);
    const poorBgaRef = useRef(null);
    const lastComboRef = useRef(null);
    const lastNotesRef = useRef(null);

    // updateStats で imperative 更新する要素 (再生中は再レンダリングせずここだけ書き換える)
    const measProcRef = useRef(null);
    const measTotalRef = useRef(null);
    const bpmRef = useRef(null);
    const nextBpmRef = useRef(null);
    const whiteRef = useRef(null);
    const greenRef = useRef(null);
    // 6-2-b: プレイモードのスコア表示
    const scoreBlockRef = useRef(null);
    const exRef = useRef(null);
    const djRef = useRef(null);
    const jbRef = useRef({}); // { pg, gr, gd, bd, poor, epoor } の span
    const fsRef = useRef(null);

    useImperativeHandle(ref, () => ({
        // 毎フレーム: コンボ表示 + BGA の位置合わせ
        updateInfo: (time, currentCombo, notesDone) => {
            if (currentCombo !== lastComboRef.current) {
                lastComboRef.current = currentCombo;
                if (comboTextRef.current) comboTextRef.current.innerText = currentCombo;
            }
            if (notesDone !== undefined && notesDone !== lastNotesRef.current) {
                lastNotesRef.current = notesDone;
                if (notesTextRef.current) notesTextRef.current.innerText = notesDone;
            }
            if (backBgaRef.current) backBgaRef.current.syncTime(time);
            if (layerBgaRef.current) layerBgaRef.current.syncTime(time);
            if (showMissLayer && poorBgaRef.current) poorBgaRef.current.syncTime(time);
        },
        // 〜10Hz: MEASURE / BPM / 次BPM / WHT・GRN
        updateStats: (s) => {
            const denseColor = s.dense ? '#f87171' : '#ffffff';
            if (measProcRef.current) { measProcRef.current.textContent = s.measProc; measProcRef.current.style.color = denseColor; }
            if (measTotalRef.current) { measTotalRef.current.textContent = s.measTotal; measTotalRef.current.style.color = denseColor; }
            if (bpmRef.current) bpmRef.current.textContent = s.bpm;
            if (nextBpmRef.current) {
                if (s.nextBpm) {
                    nextBpmRef.current.style.display = '';
                    nextBpmRef.current.style.color = s.nextBpm.dir === 'up' ? '#f87171' : '#60a5fa';
                    nextBpmRef.current.textContent = `${s.nextBpm.dir === 'up' ? '↑' : '↓'} ${s.nextBpm.value} | ${s.nextBpm.old}`;
                } else {
                    nextBpmRef.current.style.display = 'none';
                }
            }
            if (whiteRef.current) whiteRef.current.textContent = Math.round(s.white);
            if (greenRef.current) greenRef.current.textContent = s.green;
        },
        // 6-2-b: プレイモードのスコア。d=null で非表示。
        updateScore: (d) => {
            const el = scoreBlockRef.current;
            if (!el) return;
            if (!d) { el.style.display = 'none'; return; }
            el.style.display = '';
            if (exRef.current) exRef.current.textContent = `${d.exScore} / ${d.maxEx}  ${(d.rate * 100).toFixed(2)}%`;
            if (djRef.current) djRef.current.textContent = d.djLevel;
            const jb = jbRef.current;
            ['pg', 'gr', 'gd', 'bd', 'poor', 'epoor'].forEach(k => { if (jb[k]) jb[k].textContent = d[k]; });
            if (fsRef.current) fsRef.current.textContent = `${d.fast} / ${d.slow}`;
        },
    }));

    return (
        <div className="w-64 flex flex-col border-r border-blue-900/30 bg-[#0a0a0a] p-2 gap-2 shrink-0">
            {/* 設定ボタンエリア */}
            <div className="bg-[#112233] border border-blue-500/30 text-blue-100 p-2 rounded flex items-center gap-2 text-xs font-bold shrink-0 cursor-pointer hover:bg-[#1e3a5f] transition shadow-sm group" onClick={() => setShowSettings(true)}>
                 <Settings size={14} className="text-blue-400 group-hover:rotate-90 transition-transform duration-500"/>
                  <div className="flex-1 flex flex-col"><span className="text-blue-200 group-hover:text-white transition-colors">{playOption}</span><span className="text-[8px] text-blue-500/70 font-mono tracking-tighter mt-0.5">設定を開く</span></div>
            </div>

            {/* BGA表示エリア */}
            <div className="aspect-video w-full bg-black border border-blue-900/30 flex items-center justify-center text-blue-900/50 text-xs shrink-0 overflow-hidden relative shadow-inner rounded-sm">
                <BgaLayer ref={backBgaRef} bgaState={currentBackBga} zIndex={0} isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
                <BgaLayer ref={layerBgaRef} bgaState={currentLayerBga} zIndex={10} blendMode="screen" isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
                {showMissLayer && currentPoorBga ? (
                    <div className="absolute inset-0 w-full h-full z-50 bg-black flex items-center justify-center">
                        <BgaLayer ref={poorBgaRef} bgaState={currentPoorBga} zIndex={50} isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
                    </div>
                ) : null}
                 {!currentBackBga && !currentLayerBga && !showMissLayer && <div className="flex flex-col items-center gap-1 z-0"><ImageIcon size={20} /><span className="text-[9px] font-bold tracking-wider">NO SIGNAL</span></div>}
                {readyAnimState === 'GO' && <div className="absolute inset-0 bg-white animate-ping opacity-20 pointer-events-none"></div>}
            </div>

            {/* BMS Monitor */}
            <div className="bg-[#050505] border border-blue-900/30 p-1 flex-1 min-h-0 overflow-hidden font-mono text-[9px] leading-tight text-blue-300/80 relative shadow-inner rounded-sm flex flex-col">
                 <div className="absolute top-0 right-0 bg-blue-900/20 text-blue-400 px-1 text-[8px] z-10">BMS MONITOR</div>
                <div className="mt-4 flex-1 overflow-hidden flex flex-col justify-center pb-1">
                    {currentMeasureLines.length > 0 ? <div className="flex flex-col gap-0.5">{currentMeasureLines.map((item, i) => (<div key={i} className={`truncate transition-all ${item.isCurrent ? 'text-yellow-300 bg-blue-900/20 font-bold scale-105 pl-1' : 'text-blue-500/50 blur-[0.5px]'}`}>{item.text}</div>))}</div> : <div className="text-center text-blue-900/50 italic">No Data</div>}
                </div>
            </div>

            {/* コンボ・BPM・数字情報 */}
            <div className="bg-[#112233]/30 border border-blue-900/30 p-2 text-xs space-y-2 shrink-0 text-blue-200 font-mono rounded-sm">
                <div className="flex justify-between items-baseline border-b border-blue-900/30 pb-1">
                    <span className="text-[10px] text-blue-400">COMBO</span>
                    <span ref={comboTextRef} className="text-xl font-bold text-white drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">0</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-blue-400">NOTES</span>
                    <span><span ref={notesTextRef} className="text-white">0</span> <span className="text-blue-500"> / </span> {totalNotes}</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-blue-400">MEASURE</span>
                    <span><span ref={measProcRef} className="font-bold text-white">0</span><span className="text-blue-500/50 mx-1">/</span><span ref={measTotalRef} className="font-bold text-white">0</span></span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-blue-400">BPM</span>
                    <div className="flex items-baseline gap-2">
                        <span ref={nextBpmRef} className="text-[10px] font-bold animate-pulse" style={{ display: 'none' }}></span>
                        <span ref={bpmRef} className="text-red-400 font-bold text-lg">0</span>
                    </div>
                </div>

                {/* 白数字 / 緑数字 */}
                <div className="mt-2 pt-2 border-t border-blue-900/30 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-blue-400 leading-none mb-0.5">WHT / GRN</span>
                        <div className="flex items-baseline gap-1">
                            <span ref={whiteRef} className="text-white font-bold text-base">0</span>
                            <span className="text-blue-500/50 text-xs">/</span>
                            <span ref={greenRef} className="text-[#00ff00] font-bold text-lg shadow-[0_0_8px_rgba(0,255,0,0.4)]">0</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 6-2-b: プレイモードのスコア (updateScore で表示切替) */}
            <div ref={scoreBlockRef} style={{ display: 'none' }} className="bg-[#112233]/30 border border-blue-900/30 p-2 text-xs shrink-0 text-blue-200 font-mono rounded-sm space-y-1.5">
                <div className="flex justify-between items-baseline border-b border-blue-900/30 pb-1">
                    <span className="text-[10px] text-blue-400">DJ LEVEL</span>
                    <span ref={djRef} className="text-xl font-black text-white">F</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-blue-400">EX</span>
                    <span ref={exRef} className="text-white text-[11px]">0 / 0  0.00%</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-[#22d3ee]">PG</span><span ref={el => (jbRef.current.pg = el)} className="text-white">0</span></div>
                    <div className="flex justify-between"><span className="text-[#fde047]">GR</span><span ref={el => (jbRef.current.gr = el)} className="text-white">0</span></div>
                    <div className="flex justify-between"><span className="text-[#4ade80]">GD</span><span ref={el => (jbRef.current.gd = el)} className="text-white">0</span></div>
                    <div className="flex justify-between"><span className="text-[#fb923c]">BD</span><span ref={el => (jbRef.current.bd = el)} className="text-white">0</span></div>
                    <div className="flex justify-between"><span className="text-[#f87171]">PR</span><span ref={el => (jbRef.current.poor = el)} className="text-white">0</span></div>
                    <div className="flex justify-between"><span className="text-[#94a3b8]">空PR</span><span ref={el => (jbRef.current.epoor = el)} className="text-white">0</span></div>
                </div>
                <div className="flex justify-between items-baseline pt-1 border-t border-blue-900/30">
                    <span className="text-[10px] text-blue-400">FAST / SLOW</span>
                    <span ref={fsRef} className="text-[11px]"><span className="text-blue-400">0</span> / <span className="text-red-400">0</span></span>
                </div>
                <div className="text-[9px] text-blue-500/50 text-center pt-0.5">Tab: リザルト表示</div>
            </div>
         </div>
    );
});

export default memo(InfoPanel);
