// src/bms/components/DensityGraph.jsx
import React, { useMemo, useRef, useEffect, memo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useLiveStore } from '../logic/liveStore';

const BAR_W = 2;   // バー1本の幅(px)
const BAR_GAP = 1; // バー間の隙間(px)

const DensityGraph = ({ parsedSong, live }) => {
    const scrollRef = useRef(null);
    const currentMeasure = useLiveStore(live, s => s.measure);

    const { bars, maxDensity } = useMemo(() => {
        if (!parsedSong) return { bars: [], maxDensity: 0 };

        const counts = parsedSong.notesPerMeasure || {};
        const scratch = parsedSong.scratchPerMeasure || {};
        const keys = Object.keys(counts).map(Number);
        const maxM = keys.length > 0 ? Math.max(...keys) : 0;
        const maxVal = keys.length > 0 ? Math.max(...Object.values(counts)) : 0;

        const barsData = [];
        for (let i = 0; i <= maxM; i++) {
            const total = counts[i] || 0;
            const scr = scratch[i] || 0;
            barsData.push({
                measure: i,
                count: total,
                scratch: scr,
                heightPercent: maxVal > 0 ? (total / maxVal) * 100 : 0,
                scratchRatio: total > 0 ? scr / total : 0,
            });
        }
        return { bars: barsData, maxDensity: maxVal };
    }, [parsedSong]);

    // ★軽量化: バー(小節数ぶんの div)は譜面が変わったときだけ生成する。現在小節の強調は下の1本のマーカーで行い、
    //   小節が変わるたびに全バーを再レンダリングしないようにする。
    const barNodes = useMemo(() => bars.map((bar) => {
        const isPeak = bar.count === maxDensity && maxDensity > 0;
        return (
            <div
                key={bar.measure}
                className="flex-none flex flex-col justify-end"
                style={{ width: `${BAR_W}px`, height: `${Math.max(4, bar.heightPercent)}%`, opacity: 0.85 }}
                title={`#${bar.measure}: ${bar.count} notes (SC ${bar.scratch})`}
            >
                {bar.scratch > 0 && (
                    <div className="w-full bg-red-500 shrink-0" style={{ height: `${bar.scratchRatio * 100}%` }} />
                )}
                <div className={`w-full flex-1 ${isPeak ? 'bg-orange-400' : 'bg-blue-500'}`} />
            </div>
        );
    }), [bars, maxDensity]);

    // 現在の小節に合わせて自動横スクロール
    useEffect(() => {
        if (scrollRef.current && currentMeasure >= 0) {
            const scrollPos = (currentMeasure * (BAR_W + BAR_GAP)) - (scrollRef.current.clientWidth / 2);
            scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
        }
    }, [currentMeasure]);

    if (!parsedSong) return null;
    const cur = bars[currentMeasure];

    return (
        <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30 mt-2 w-full flex flex-col shrink-0">
            <div className="text-[10px] text-blue-400 font-bold mb-1.5 flex items-center justify-between gap-1 shrink-0">
                <div className="flex items-center gap-1"><BarChart3 size={10}/> DENSITY</div>
                <div className="flex items-center gap-2 text-[8px]">
                    <span className="flex items-center gap-1 text-blue-300/70"><span className="w-2 h-2 rounded-[1px] bg-blue-500 inline-block"/>KEY</span>
                    <span className="flex items-center gap-1 text-red-300/70"><span className="w-2 h-2 rounded-[1px] bg-red-500 inline-block"/>SC</span>
                    <span className="text-blue-500/50">PEAK: {maxDensity}</span>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="relative w-full h-14 bg-black/40 border-b border-l border-blue-900/30 overflow-x-auto scrollbar-hide"
            >
                <div className="relative flex items-end h-full w-max" style={{ gap: `${BAR_GAP}px` }}>
                    {barNodes}
                    {/* 現在小節のマーカー(白) */}
                    {cur && (
                        <div className="absolute bottom-0 bg-white pointer-events-none"
                            style={{ left: currentMeasure * (BAR_W + BAR_GAP), width: BAR_W, height: `${Math.max(4, cur.heightPercent)}%` }} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(DensityGraph);
