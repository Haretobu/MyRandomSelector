// src/bms/components/DensityGraph.jsx
import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';

const DensityGraph = ({ parsedSong, currentMeasure }) => {
    // グラフデータの計算（曲が変わった時だけ再計算）
    const { bars, maxDensity } = useMemo(() => {
        if (!parsedSong) return { bars: [], maxDensity: 0 };
        
        const counts = parsedSong.notesPerMeasure || {};
        // 小節数の最大値を取得（データが存在する最後の小節まで）
        const keys = Object.keys(counts).map(Number);
        const maxM = keys.length > 0 ? Math.max(...keys) : 0;
        const maxVal = keys.length > 0 ? Math.max(...Object.values(counts)) : 0;
        
        const barsData = [];
        // 全小節分のデータを配列化
        for (let i = 0; i <= maxM; i++) {
            barsData.push({
                measure: i,
                count: counts[i] || 0,
                // 高さの割合 (最大値を100%とする)
                heightPercent: maxVal > 0 ? ((counts[i] || 0) / maxVal) * 100 : 0
            });
        }
        return { bars: barsData, maxDensity: maxVal };
    }, [parsedSong]);

    if (!parsedSong) return null;

    return (
        <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30 mt-2 w-full">
            <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1"><BarChart3 size={10}/> DENSITY</div>
                <div className="text-[8px] text-blue-500/50">PEAK: {maxDensity}</div>
            </div>
            
            {/* グラフ描画エリア: flexを使って横幅いっぱいに均等配置 */}
            <div className="relative w-full h-16 bg-black/40 border-b border-l border-blue-900/30 flex items-end px-1">
                {bars.map((bar) => {
                    const isCurrent = bar.measure === currentMeasure;
                    // 現在の小節は赤、ピークはオレンジ、他は青
                    let colorClass = 'bg-blue-600/60';
                    if (isCurrent) colorClass = 'bg-red-500 shadow-[0_0_8px_#ef4444] z-10';
                    else if (bar.count === maxDensity && maxDensity > 0) colorClass = 'bg-orange-400/80';

                    return (
                        <div 
                            key={bar.measure}
                            className={`flex-1 min-w-[1px] transition-colors duration-200 mx-[0.5px] ${colorClass}`}
                            style={{ 
                                height: `${Math.max(5, bar.heightPercent)}%`, // 0個でも5%の高さは確保（視認性のため）
                                opacity: isCurrent ? 1 : 0.8
                            }}
                            title={`Measure #${bar.measure}: ${bar.count} notes`}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default DensityGraph;