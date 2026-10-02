// src/bms/components/settings/ViewSettings.jsx
// 設定画面の「表示」タブ: 表示・BGA設定 / 譜面の表示エリア(レーンカバー) / オートHI-SPEED。
import React, { useState, useEffect, useRef } from 'react';
import { Film, ChevronsUp, ChevronDown } from 'lucide-react';
import { VISIBILITY_MODES } from '../../constants';

function AutoHiSpeedSection({ autoHiSpeed, setAutoHiSpeed, targetGreen, setTargetGreen, hiSpeed }) {
    const [open, setOpen] = useState(!!autoHiSpeed);
    const prevRef = useRef(!!autoHiSpeed);
    useEffect(() => {
        if (autoHiSpeed && !prevRef.current) setOpen(true);
        prevRef.current = !!autoHiSpeed;
    }, [autoHiSpeed]);

    return (
        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setOpen(o => !o)}
                    className="flex-1 flex items-center gap-2 text-xs text-blue-400 font-bold uppercase tracking-wider text-left">
                    <ChevronsUp size={14} /> <span>緑数字を維持 (フローティング HI-SPEED)</span>
                    <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <span className="text-[10px] text-blue-300">ON</span>
                    <input type="checkbox" checked={autoHiSpeed} onChange={e => setAutoHiSpeed(e.target.checked)} className="accent-blue-500 w-4 h-4"/>
                </label>
            </div>
            {open && (
                <div className="pt-3 mt-1 border-t border-blue-900/30">
                    <div className={`flex items-center gap-2 ${autoHiSpeed ? '' : 'opacity-40 pointer-events-none'}`}>
                        <span className="text-[11px] text-blue-300 w-32 shrink-0">維持する緑数字</span>
                        <input type="number" min="60" max="1500" step="5" value={targetGreen}
                            onChange={e => setTargetGreen(Math.max(60, Math.min(1500, Number(e.target.value) || 300)))}
                            className="w-20 bg-black/50 border border-blue-500/30 rounded px-2 py-1 text-white text-sm text-center font-mono"/>
                        <span className="text-[11px] text-blue-500/70">ms</span>
                    </div>
                    <div className="text-[10px] text-blue-500/60 mt-2 leading-relaxed">
                        現在 HI-SPEED: <span className="text-blue-300 font-mono">{hiSpeed}</span>（{autoHiSpeed ? '自動' : '手動'}）。<br />
                        曲が変わっても、その曲の主BPM(最も長く続くBPM)で緑数字がこの値になるよう HI-SPEED を自動で合わせます(IIDX と同じ)。
                        ON のまま HI-SPEED を変えると、その速さの緑数字が新しい維持値になります。曲中の BPM 変化(ソフラン)には追従しません。
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * 表示タブ全体。
 * @param {boolean} hidden タブが選ばれていないとき true(要素は残したまま隠す)
 * @param {boolean} isMobile
 * @param {object} view BmsViewer の表示設定一式
 *   { visibilityMode, suddenPlusVal, hiddenPlusVal, liftVal, playBgaVideo, missLayerEnabled, bgaBehindChart, bgaSidePanel,
 *     bgaSidePos, laneWidthPx, bgaOpacity, autoHiSpeed, targetGreen, boardOpacity, laneOpacity } とそれぞれの setXxx、
 *   hasVideo(動画BGAがあるか)、hiSpeed(オートHI-SPEED の表示用)
 */
export default function ViewSettings({ hidden, isMobile, view }) {
    return (
        <>
        {/* 表示・BGA設定 */}
        <div hidden={hidden} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                <Film size={14} /> 表示・BGA設定
            </div>
            <div className="space-y-4">
                <label className={`flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent ${!view.hasVideo ? 'opacity-50' : 'hover:border-blue-500/30'}`}>
                    <span className="text-sm">BGA動画再生 (重い場合OFF)</span>
                    <input type="checkbox" checked={view.playBgaVideo} onChange={e=>view.setPlayBgaVideo(e.target.checked)} disabled={!view.hasVideo} className="accent-blue-500 w-5 h-5"/>
                </label>

                <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                    <span className="text-sm">ミスレイヤー (POOR BGA) を表示</span>
                    <input type="checkbox" checked={!!view.missLayerEnabled} onChange={e=>view.setMissLayerEnabled(e.target.checked)} className="accent-blue-500 w-5 h-5"/>
                </label>
                <p className="text-[10px] text-gray-400 -mt-2 leading-relaxed">
                    オート: <span className="font-mono">M</span> キーで発動 ／ 自己プレイ: 空POOR以外の POOR・BAD で発動
                </p>

                {!isMobile && (
                    <div className="pt-2 border-t border-blue-900/30 space-y-2">
                        <div className="text-[11px] font-bold text-blue-300">PC の BGA 表示位置</div>
                        <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                            <span className="text-sm">レーン背面に BGA を表示</span>
                            <input type="checkbox" checked={!!view.bgaBehindChart} onChange={e=>view.setBgaBehindChart(e.target.checked)} className="accent-blue-500 w-5 h-5"/>
                        </label>
                        <p className="text-[10px] text-gray-400 -mt-1 leading-relaxed">
                            ※ 「ボード全体の背景 (黒)」を下げると見えやすくなります
                        </p>
                        <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                            <span className="text-sm">サイド BGA パネル (IIDX 風)</span>
                            <input type="checkbox" checked={!!view.bgaSidePanel} onChange={e=>view.setBgaSidePanel(e.target.checked)} className="accent-blue-500 w-5 h-5"/>
                        </label>
                        <div className={`flex gap-2 ${view.bgaSidePanel ? '' : 'opacity-40 pointer-events-none'}`}>
                            {['left', 'right'].map(p => (
                                <button key={p} onClick={() => view.setBgaSidePos(p)}
                                    className={`flex-1 text-[11px] font-bold py-1.5 rounded border transition ${view.bgaSidePos === p
                                        ? 'bg-orange-600 border-orange-400 text-white' : 'bg-black/40 border-gray-700 text-gray-400'}`}>
                                    {p === 'left' ? '左サイド' : '右サイド'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-blue-300">BGAの明るさ</span>
                        <span>{Math.round(view.bgaOpacity * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={view.bgaOpacity} onChange={e => view.setBgaOpacity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                </div>

                {!isMobile && view.setLaneWidthPx && (
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-blue-300">レーン幅 (PC)</span>
                            <span>{view.laneWidthPx}px</span>
                        </div>
                        <input type="range" min="20" max="72" step="1" value={view.laneWidthPx} onChange={e => view.setLaneWidthPx(Number(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                        <p className="text-[10px] text-gray-400 mt-1">※レーン領域の幅が変わります。余った幅はサイドBGA等に使われます。</p>
                    </div>
                )}

                <div className="pt-2 border-t border-blue-900/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-orange-300">ボード全体の背景 (黒)</span>
                            <span>{Math.round(view.boardOpacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={view.boardOpacity} onChange={e => view.setBoardOpacity(parseFloat(e.target.value))} className="w-full accent-orange-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                        <p className="text-[10px] text-gray-400 mt-1">※0%にすると背景が完全に見えます</p>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-blue-300">各レーンの背景 (縞)</span>
                            <span>{Math.round(view.laneOpacity * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={view.laneOpacity} onChange={e => view.setLaneOpacity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                        <p className="text-[10px] text-gray-400 mt-1">※レーンの色の濃さ</p>
                    </div>
                </div>
            </div>
        </div>

        {/* レーンカバー設定 (共通) */}
        <div hidden={hidden} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 relative">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                <ChevronsUp size={14} /> 譜面の表示エリア (LANE COVER)
            </div>
            <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-3 gap-2">
                     {[
                        { mode: VISIBILITY_MODES.OFF, label: 'OFF' },
                        { mode: VISIBILITY_MODES.SUDDEN_PLUS, label: 'SUD+' },
                        { mode: VISIBILITY_MODES.HIDDEN_PLUS, label: 'HID+' },
                        { mode: VISIBILITY_MODES.SUD_HID_PLUS, label: 'SUD+&HID+' },
                        { mode: VISIBILITY_MODES.LIFT, label: 'LIFT' },
                        { mode: VISIBILITY_MODES.LIFT_SUD_PLUS, label: 'LIFT&SUD+' }
                     ].map(opt => (
                        <button 
                            key={opt.mode}
                            onClick={() => view.setVisibilityMode(opt.mode)}
                            className={`py-2 px-1 text-[10px] md:text-xs font-bold rounded border transition-all ${view.visibilityMode === opt.mode 
                                ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)]' 
                                : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                        >
                             {opt.label}
                        </button>
                    ))}
                 </div>
                
                 <div className="flex flex-col gap-2 mt-1 bg-black/20 p-2 rounded">
                    {(view.visibilityMode === VISIBILITY_MODES.SUDDEN_PLUS || view.visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS || view.visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-300 w-16">SUDDEN+</span>
                            <input type="range" min="0" max="1000" value={view.suddenPlusVal} onChange={e => view.setSuddenPlusVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                            <span className="text-[10px] font-mono w-8 text-right">{view.suddenPlusVal}</span>
                        </div>
                     )}
                    {(view.visibilityMode === VISIBILITY_MODES.HIDDEN_PLUS || view.visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS) && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-300 w-16">HIDDEN+</span>
                             <input type="range" min="0" max="1000" value={view.hiddenPlusVal} onChange={e => view.setHiddenPlusVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                            <span className="text-[10px] font-mono w-8 text-right">{view.hiddenPlusVal}</span>
                         </div>
                    )}
                    {(view.visibilityMode === VISIBILITY_MODES.LIFT || view.visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) && (
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-300 w-16">LIFT</span>
                             <input type="range" min="0" max="500" value={view.liftVal} onChange={e => view.setLiftVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                            <span className="text-[10px] font-mono w-8 text-right">{view.liftVal}</span>
                         </div>
                    )}
                 </div>
            </div>
        </div>

        {/* オートHI-SPEED / グリーンナンバー固定 (共通・折りたたみ) */}
        <div hidden={hidden}>
            <AutoHiSpeedSection autoHiSpeed={view.autoHiSpeed} setAutoHiSpeed={view.setAutoHiSpeed} targetGreen={view.targetGreen} setTargetGreen={view.setTargetGreen} hiSpeed={view.hiSpeed} />
        </div>
        </>
    );
}
