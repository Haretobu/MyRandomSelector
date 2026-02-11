// src/bms/components/DensityGraph.jsx
import React, { useMemo, useRef, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

const DensityGraph = ({ parsedSong, currentMeasure }) => {
    const scrollRef = useRef(null);

    // グラフデータの計算
    const { bars, maxDensity } = useMemo(() => {
        if (!parsedSong) return { bars: [], maxDensity: 0 };
        
        const counts = parsedSong.notesPerMeasure || {};
        const keys = Object.keys(counts).map(Number);
        const maxM = keys.length > 0 ? Math.max(...keys) : 0;
        const maxVal = keys.length > 0 ? Math.max(...Object.values(counts)) : 0;
        
        const barsData = [];
        for (let i = 0; i <= maxM; i++) {
            barsData.push({
                measure: i,
                count: counts[i] || 0,
                heightPercent: maxVal > 0 ? ((counts[i] || 0) / maxVal) * 100 : 0
            });
        }
        return { bars: barsData, maxDensity: maxVal };
    }, [parsedSong]);

    // 現在の小節に合わせて自動横スクロール
    useEffect(() => {
        if (scrollRef.current && currentMeasure >= 0) {
            // 1小節あたりの幅(約5px) × 現在の小節数 - 表示領域の半分
            const barWidth = 5; 
            const scrollPos = (currentMeasure * barWidth) - (scrollRef.current.clientWidth / 2) + 20;
            scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
        }
    }, [currentMeasure]);

    if (!parsedSong) return null;

    return (
        <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30 mt-2 w-full flex flex-col shrink-0">
            <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center justify-between gap-1 shrink-0">
                <div className="flex items-center gap-1"><BarChart3 size={10}/> DENSITY</div>
                <div className="text-[8px] text-blue-500/50">PEAK: {maxDensity}</div>
            </div>
            
            {/* スクロールエリア: overflow-x-auto を設定 */}
            <div 
                ref={scrollRef}
                className="relative w-full h-16 bg-black/40 border-b border-l border-blue-900/30 overflow-x-auto scrollbar-hide"
            >
                {/* 内部コンテナ: w-max で子要素の幅に合わせて広がるようにする */}
                <div className="flex items-end h-full px-1 w-max">
                    {bars.map((bar) => {
                        const isCurrent = bar.measure === currentMeasure;
                        let colorClass = 'bg-blue-600/60';
                        if (isCurrent) colorClass = 'bg-red-500 shadow-[0_0_8px_#ef4444] z-10';
                        else if (bar.count === maxDensity && maxDensity > 0) colorClass = 'bg-orange-400/80';

                        return (
                            <div 
                                key={bar.measure}
                                // flex-none と w-1 (4px) で幅を固定し、絶対に縮まないようにする
                                className={`flex-none w-1 mx-[0.5px] transition-colors duration-200 ${colorClass}`}
                                style={{ 
                                    height: `${Math.max(5, bar.heightPercent)}%`, 
                                    opacity: isCurrent ? 1 : 0.8
                                }}
                                title={`Measure #${bar.measure}: ${bar.count} notes`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DensityGraph;