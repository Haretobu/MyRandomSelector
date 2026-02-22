// src/bms/components/InfoPanel.jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Settings, Image as ImageIcon } from 'lucide-react';
import { VISIBILITY_MODES } from '../constants'; // 定数読み込みが必要
import BgaLayer from './BgaLayer';

const InfoPanel = forwardRef(({
    setShowSettings, playOption, 
    currentBackBga, currentLayerBga, currentPoorBga,
    showMissLayer, isPlaying, 
    playBgaVideo, readyAnimState,
    currentMeasureLines, totalNotes, currentMeasureNotes, realtimeBpm, nextBpmInfo, hiSpeed,
    // ★追加: 白数字・緑数字計算に必要なprops
    suddenPlusVal, liftVal, visibilityMode
}, ref) => {
    
    const comboTextRef = useRef(null);
    const notesTextRef = useRef(null);
    const backBgaRef = useRef(null);
    const layerBgaRef = useRef(null);
    const poorBgaRef = useRef(null);

    useImperativeHandle(ref, () => ({
        updateInfo: (time, currentCombo) => {
            if (comboTextRef.current) comboTextRef.current.innerText = currentCombo;
            if (notesTextRef.current) notesTextRef.current.innerText = currentCombo;
            if (backBgaRef.current) backBgaRef.current.syncTime(time);
            if (layerBgaRef.current) layerBgaRef.current.syncTime(time);
            if (showMissLayer && poorBgaRef.current) poorBgaRef.current.syncTime(time);
        }
    }));

    // --- 緑数字・白数字の計算ロジック ---
    
    // 1. 白数字 (White Number): SUD+とLIFTの合計
    let whiteNumber = 0;
    if (visibilityMode === VISIBILITY_MODES.SUDDEN_PLUS || visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS) {
        whiteNumber += suddenPlusVal;
    }
    if (visibilityMode === VISIBILITY_MODES.LIFT || visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) {
        whiteNumber += liftVal;
        if (visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) {
            whiteNumber += suddenPlusVal;
        }
    }
    // IIDX仕様に合わせて最大1000クリップ（通常はありえないが念のため）
    whiteNumber = Math.min(1000, Math.max(0, whiteNumber));

    // 2. 緑数字 (Green Number): ノーツ視認時間(ms)
    // 基本計算式: (174000 * (1 - 白/1000)) / (BPM * HS) 近似値
    // 正確には: 1小節の表示時間(秒) = 240 / BPM
    // 画面上に表示される小節数 = HiSpeed
    // 全体表示時間(秒) = 240 / (BPM * HiSpeed)
    // 有効表示領域率 = (1000 - 白数字) / 1000
    // 緑数字(ms) = (240 / (BPM * HiSpeed)) * 有効表示領域率 * 1000
    
    // ゼロ除算防止
    const safeBpm = realtimeBpm || 1;
    const safeHiSpeed = hiSpeed || 1;
    
    const visibleRate = (1000 - whiteNumber) / 1000;
    const rawGreenNumber = (240000 / (safeBpm * safeHiSpeed)) * visibleRate;
    const greenNumber = Math.round(rawGreenNumber);

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
                <div className="flex justify-between items-baseline"><span className="text-[10px] text-blue-400">MEASURE</span><span><span className={`font-bold ${currentMeasureNotes.total >= currentMeasureNotes.average + 5 ? 'text-red-400' : 'text-white'}`}>{currentMeasureNotes.processed}</span><span className="text-blue-500/50 mx-1">/</span><span className={`font-bold ${currentMeasureNotes.total >= currentMeasureNotes.average + 5 ? 'text-red-400' : 'text-white'}`}>{currentMeasureNotes.total}</span></span></div>
                <div className="flex justify-between items-baseline"><span className="text-[10px] text-blue-400">BPM</span><div className="flex items-baseline gap-2">{nextBpmInfo && (<span className={`text-[10px] font-bold ${nextBpmInfo.direction === 'up' ? 'text-red-400' : 'text-blue-400'} animate-pulse`}>{nextBpmInfo.direction === 'up' ? '↑' : '↓'} {nextBpmInfo.value} <span className="text-gray-500">|</span> {nextBpmInfo.old}</span>)}<span className="text-red-400 font-bold text-lg">{Math.round(safeBpm)}</span></div></div>
                
                {/* ★修正: 白数字 / 緑数字 表示 */}
                <div className="mt-2 pt-2 border-t border-blue-900/30 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-blue-400 leading-none mb-0.5">WHT / GRN</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-white font-bold text-base">{Math.round(whiteNumber)}</span>
                            <span className="text-blue-500/50 text-xs">/</span>
                            <span className="text-[#00ff00] font-bold text-lg shadow-[0_0_8px_rgba(0,255,0,0.4)]">{greenNumber}</span>
                        </div>
                    </div>
                </div>
            </div>
         </div>
    );
});

export default InfoPanel;