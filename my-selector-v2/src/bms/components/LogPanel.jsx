// src/bms/components/LogPanel.jsx
import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, memo } from 'react';

const LogPanel = forwardRef(({ backingTracks, activeShortSoundsRef, lastPlayedSoundPerLaneRef, longAudioProgressRefs, isPlaying }, ref) => {
    const polyRef = useRef(null);      // POLY 数値の span
    const maxPolyRef = useRef(null);   // M POLY 数値の span
    const avgRef = useRef(0);          // 直近の平均(POLYの色分けに使う)
    const monitorListRef = useRef(null); // SOUND MONITOR のリスト領域(高さ実測用)
    const [listH, setListH] = useState(0);
    const [, force] = useState(0);

    // SOUND MONITOR の表示行数はコンテナの高さに合わせる(上端で行が途中クリップされないように)
    useEffect(() => {
        const el = monitorListRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => setListH(el.clientHeight));
        ro.observe(el);
        setListH(el.clientHeight);
        return () => ro.disconnect();
    }, []);
    const maxRows = listH ? Math.max(4, Math.floor(listH / 15)) : 18;

    useImperativeHandle(ref, () => ({
        updatePoly: (poly, maxPoly, avg) => {
            avgRef.current = avg;
            if (maxPolyRef.current) maxPolyRef.current.textContent = maxPoly;
            if (polyRef.current) {
                polyRef.current.textContent = poly;
                polyRef.current.style.color = poly > avg + 10 ? '#ef4444' : '#ffffff';
            }
        },
    }));

    // 流れるログ(SOUND MONITOR / LANE LOG)を ~8Hz で再描画。memo により親の再レンダリングとは独立。
    useEffect(() => {
        if (!isPlaying) return;
        const id = setInterval(() => force(n => (n + 1) & 1023), 120);
        return () => clearInterval(id);
    }, [isPlaying]);

    const shorts = (activeShortSoundsRef.current || []).slice(-maxRows);
    const laneLog = lastPlayedSoundPerLaneRef.current || [];

    return (
       <div className="w-60 flex flex-col bg-[#080808] p-2 gap-2 shrink-0 overflow-y-auto scrollbar-hide border-l border-blue-900/30">
             {/* BACKING TRACK (BGMモニター) */}
             <div className="bg-[#112233]/20 border border-blue-900/30 h-auto max-h-[25%] min-h-[60px] p-1 relative overflow-hidden flex flex-col shrink-0 rounded-sm">
                 <div className="text-[9px] font-bold mb-0.5 border-b border-blue-900/30 flex justify-between text-blue-300 px-1 shrink-0"><span>BACKING TRACK</span></div>
                 <div className="text-[8px] space-y-1 overflow-y-auto scrollbar-hide flex-1 font-mono px-1">
                     {backingTracks.map(s => (
                        <div key={s.id} className="flex flex-col mb-1">
                            <div className={`truncate flex items-center gap-1 leading-none py-[1px] ${s.isAborted ? 'text-red-500' : (s.isMuted ? 'text-gray-500' : 'text-blue-200')}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.isAborted ? 'bg-red-500' : (s.isSkipped ? 'bg-cyan-500' : (s.isMuted ? 'bg-gray-600' : 'bg-green-500'))} shrink-0 shadow-[0_0_5px_currentColor]`}/>{s.name}
                            </div>
                            <div className="h-[4px] bg-[#1e293b] w-full mt-[1px] overflow-hidden rounded-full relative">
                                <div className={`h-full absolute left-0 top-0 ${s.isAborted ? 'bg-red-500' : (s.isSkipped ? 'bg-cyan-400' : (s.isMuted ? 'bg-gray-500' : 'bg-green-400'))}`} ref={el => { if(el) longAudioProgressRefs.current.set(s.id, el); }} style={{width: '0%'}} />
                            </div>
                        </div>
                    ))}
                 </div>
              </div>

             {/* SOUND MONITOR (再生中の短い音) */}
             <div className="bg-[#112233]/20 border border-blue-900/30 flex-1 p-2 relative overflow-hidden flex flex-col rounded-sm min-h-0">
                 <div className="text-[10px] font-bold mb-1 border-b border-blue-900/30 flex justify-between items-center text-blue-300 shrink-0">
                    <span>SOUND MONITOR</span>
                    <div className="flex gap-2">
                         <span className="text-blue-500/70 text-[8px]">M POLY: <span ref={maxPolyRef} className="text-white">0</span></span>
                        <span className="text-blue-500/70">POLY: <span ref={polyRef} className="text-white">0</span></span>
                    </div>
                 </div>
                 <div ref={monitorListRef} className="flex-1 overflow-hidden flex flex-col justify-end text-[9px] space-y-0.5 font-mono">
                    {shorts.map(s => (
                         <div key={s.id} className={`truncate flex items-center gap-1 leading-none py-[1px] opacity-80 ${s.isMuted ? 'text-gray-600' : 'text-blue-100'}`}>
                            <span className={`w-1 h-1 rounded-full ${s.isSkipped ? 'bg-cyan-400' : (s.isMuted ? 'bg-gray-600' : 'bg-green-400')} shrink-0 shadow-[0_0_4px_currentColor]`}/>{s.name}
                        </div>
                     ))}
                 </div>
             </div>

             {/* LANE LOG (各レーンの最新音) */}
             <div className="bg-[#0f172a] text-blue-100 p-2 h-48 shrink-0 text-[10px] font-mono border border-blue-900/50 flex flex-col justify-center rounded-sm shadow-lg">
                 <div className="border-b border-blue-900/30 mb-2 pb-1 text-center text-blue-400 font-bold text-[9px] tracking-widest">LANE LOG</div>
                 <div className="grid grid-cols-[20px_1fr] gap-x-2 gap-y-1">{[0,1,2,3,4,5,6,7].map(i => (<React.Fragment key={i}><div className="text-blue-500 text-right font-bold opacity-70">{i===0?'SC':`K${i}`}</div><div className="truncate text-yellow-100 leading-tight opacity-90">{laneLog[i] || '-'}</div></React.Fragment>))}</div>
             </div>
         </div>
    );
});

export default memo(LogPanel);
