// src/bms/components/SettingsModal.jsx
import React from 'react';
import { Settings, X, ChevronsUp, RotateCw, Film, Flag, Music, Layers, Speaker, EyeOff, FileX, Keyboard, FolderOpen, FileArchive, ChevronDown, Gamepad2 } from 'lucide-react'; // Gamepad2を追加
import { VISIBILITY_MODES } from '../constants';

const SettingsModal = ({
    showSettings, setShowSettings, isMobile,
    visibilityMode, setVisibilityMode,
    suddenPlusVal, setSuddenPlusVal, hiddenPlusVal, setHiddenPlusVal, liftVal, setLiftVal,
    playSide, setPlaySide, playOption, setPlayOption, currentLaneOrder, refreshRandom,
    comboPos, setComboPos, 
    customKeyHitSound, handleKeyHitSoundUpload, handleKeyHitSoundReset,
    customScratchHitSound, handleScratchHitSoundUpload, handleScratchHitSoundReset,
    volume, setVolume, monitorUpdateInterval, setMonitorUpdateInterval,
    hasVideo, playBgaVideo, setPlayBgaVideo, hitSoundVolume, setHitSoundVolume,
    showReady, setShowReady, playKeySounds, setPlayKeySounds, playLongAudio, setPlayLongAudio,
    playBgSounds, setPlayBgSounds, showMutedMonitor, setShowMutedMonitor,
    showAbortedMonitor, setShowAbortedMonitor, scratchRotationEnabled, setScratchRotationEnabled,
    isInputDebugMode, setIsInputDebugMode,
    // ▼▼▼ 追加: デバッグ時の自動再生ミュート設定を受け取る ▼▼▼
    muteDebugAutoPlay, setMuteDebugAutoPlay,
    // ファイル操作
    handleFileSelect, handleZipSelect, bmsList, selectedBmsIndex, setSelectedBmsIndex,
    hiSpeed, setHiSpeed, bgaOpacity, setBgaOpacity,
    // ★追加: 透明度設定 (ボード全体 / 各レーン)
    boardOpacity, setBoardOpacity,
    laneOpacity, setLaneOpacity,
    parsedSong
}) => {
    if (!showSettings) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="bg-[#080808] w-full max-w-[700px] h-[90vh] md:h-auto md:max-h-[90vh] border-2 border-blue-900/50 shadow-2xl p-4 md:p-6 relative text-blue-100 flex flex-col rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 shrink-0">
                     <div className="text-xl md:text-2xl font-bold text-blue-400 flex items-center gap-2"><Settings /> 設定 & メニュー</div>
                    <button onClick={() => setShowSettings(false)} className="text-blue-400 hover:text-white transition p-2 bg-white/10 rounded-full"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-900 pr-2 space-y-6">
                    
                    {/* ▼▼▼ スマホ用: ファイル読み込み・基本設定 ▼▼▼ */}
                    {isMobile && (
                        <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30 space-y-4">
                            <div className="text-sm font-bold text-blue-300 border-b border-blue-500/30 pb-2 mb-2">ファイル読込</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <label className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 text-sm cursor-pointer flex items-center justify-center gap-2 shadow-lg rounded-lg font-bold w-full transition active:scale-95">
                                    <FolderOpen size={18}/> フォルダを開く (BMS)
                                    <input type="file" webkitdirectory="" multiple className="hidden" onChange={handleFileSelect} />
                                </label>
                                <label className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-3 text-sm cursor-pointer flex items-center justify-center gap-2 shadow-lg rounded-lg font-bold w-full transition active:scale-95">
                                    <FileArchive size={18}/> ZIPを開く (スマホ推奨)
                                    <input type="file" accept=".zip,application/zip" className="hidden" onChange={handleZipSelect} />
                                </label>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-blue-400">選択中の曲</span>
                                <select className="bg-black/50 text-white p-2 rounded border border-blue-500/30 w-full text-sm" value={selectedBmsIndex} onChange={e => setSelectedBmsIndex(Number(e.target.value))}>
                                    {bmsList.length === 0 && <option>なし</option>}
                                    {bmsList.map((b, i) => <option key={i} value={i}>{b.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="text-xs text-blue-300 block mb-1">HI-SPEED: {hiSpeed}</label>
                                    <input type="range" min="0.5" max="10.0" step="0.1" value={hiSpeed} onChange={e => setHiSpeed(Number(e.target.value))} className="w-full accent-blue-500 h-4" />
                                </div>
                                <div>
                                    <label className="text-xs text-blue-300 block mb-1">Volume: {Math.round(volume * 100)}%</label>
                                    <input type="range" min="0" max="1.0" step="0.05" value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full accent-blue-500 h-4" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ▼▼▼ 表示・BGA設定 ▼▼▼ */}
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
                        <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                            <Film size={14} /> 表示・BGA設定
                        </div>
                        <div className="space-y-4">
                            <label className={`flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent ${!hasVideo ? 'opacity-50' : 'hover:border-blue-500/30'}`}>
                                <span className="text-sm">BGA動画再生 (重い場合OFF)</span>
                                <input type="checkbox" checked={playBgaVideo} onChange={e=>setPlayBgaVideo(e.target.checked)} disabled={!hasVideo} className="accent-blue-500 w-5 h-5"/>
                            </label>
                            
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-blue-300">BGAの明るさ</span>
                                    <span>{Math.round(bgaOpacity * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.05" value={bgaOpacity} onChange={e => setBgaOpacity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                            </div>

                            {/* ★修正: ボード全体とレーン個別の設定を分離 */}
                            <div className="pt-2 border-t border-blue-900/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-orange-300">ボード全体の背景 (黒)</span>
                                        <span>{Math.round(boardOpacity * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.05" value={boardOpacity} onChange={e => setBoardOpacity(parseFloat(e.target.value))} className="w-full accent-orange-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                    <p className="text-[10px] text-gray-400 mt-1">※0%にすると背景が完全に見えます</p>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-blue-300">各レーンの背景 (縞)</span>
                                        <span>{Math.round(laneOpacity * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.05" value={laneOpacity} onChange={e => setLaneOpacity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                    <p className="text-[10px] text-gray-400 mt-1">※レーンの色の濃さ</p>
                                </div>
                            </div>
                        </div>
                    </div>

                     {/* ▼▼▼ レーンカバー設定 (共通) ▼▼▼ */}
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 relative">
                        {/* ... (以下変更なし) ... */}
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
                                        onClick={() => setVisibilityMode(opt.mode)}
                                        className={`py-2 px-1 text-[10px] md:text-xs font-bold rounded border transition-all ${visibilityMode === opt.mode 
                                            ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)]' 
                                            : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                                    >
                                         {opt.label}
                                    </button>
                                ))}
                             </div>
                            
                             <div className="flex flex-col gap-2 mt-1 bg-black/20 p-2 rounded">
                                {(visibilityMode === VISIBILITY_MODES.SUDDEN_PLUS || visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS || visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-blue-300 w-16">SUDDEN+</span>
                                        <input type="range" min="0" max="1000" value={suddenPlusVal} onChange={e => setSuddenPlusVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                        <span className="text-[10px] font-mono w-8 text-right">{suddenPlusVal}</span>
                                    </div>
                                 )}
                                {(visibilityMode === VISIBILITY_MODES.HIDDEN_PLUS || visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-blue-300 w-16">HIDDEN+</span>
                                         <input type="range" min="0" max="1000" value={hiddenPlusVal} onChange={e => setHiddenPlusVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                        <span className="text-[10px] font-mono w-8 text-right">{hiddenPlusVal}</span>
                                     </div>
                                )}
                                {(visibilityMode === VISIBILITY_MODES.LIFT || visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) && (
                                     <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-blue-300 w-16">LIFT</span>
                                         <input type="range" min="0" max="500" value={liftVal} onChange={e => setLiftVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                        <span className="text-[10px] font-mono w-8 text-right">{liftVal}</span>
                                     </div>
                                )}
                             </div>
                        </div>
                    </div>

                    {/* PC用設定 */}
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                         <div className="w-full md:flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex justify-between items-center">
                             <span className="font-bold text-sm text-blue-300">プレイサイド</span>
                             <button onClick={() => setPlaySide(p => p==='1P'?'2P':'1P')} className="bg-blue-600/20 border border-blue-500/50 px-6 py-1 text-blue-100 hover:bg-blue-600/40 transition rounded w-32 font-mono">{playSide}</button>
                          </div>
                         <div className="w-full md:flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex flex-col gap-2 relative">
                             <div className="flex justify-between items-center">
                                  <span className="font-bold text-sm text-blue-300">レーンオプション</span>
                                 <div className="flex items-center gap-2">
                                     <div className="relative bg-blue-600/20 border border-blue-500/50 rounded hover:bg-blue-600/30 transition">
                                          <select value={playOption} onChange={e => setPlayOption(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full">
                                            <option value="OFF" className="bg-black text-white">正規 (OFF)</option><option value="MIRROR" className="bg-black text-white">MIRROR</option>
                                             <option value="RANDOM" className="bg-black text-white">RANDOM</option><option value="R-RANDOM" className="bg-black text-white">R-RANDOM</option>
                                            <option value="S-RANDOM" className="bg-black text-white">S-RANDOM</option>
                                          </select>
                                         <div className="px-4 py-1 text-blue-100 font-bold flex items-center gap-2 min-w-[140px] justify-between">{playOption}</div>
                                      </div>
                                     <button onClick={refreshRandom} className="bg-blue-600/20 border border-blue-500/50 p-1 text-blue-300 hover:text-white hover:bg-blue-600/40 active:scale-95 transition rounded"><RotateCw size={20} /></button>
                                   </div>
                             </div>
                         </div>
                    </div>

                    {/* 詳細設定 */}
                    <details className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open={!isMobile}>
                        <summary className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer list-none">
                            <span>詳細設定 (サウンド・デバッグ)</span>
                            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                                 <span className="text-sm text-blue-300">打鍵音の音量</span>
                                <input type="range" min="0" max="2" step="0.1" value={hitSoundVolume} onChange={e => setHitSoundVolume(parseFloat(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                            </div>
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Flag className="text-blue-400" size={18}/><span className="text-sm">開始時のREADY演出</span></div>
                                <input type="checkbox" checked={showReady} onChange={e=>setShowReady(e.target.checked)} className="accent-blue-500"/>
                             </label>
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Music className="text-blue-400" size={18}/><span className="text-sm">キー音を再生</span></div>
                                 <input type="checkbox" checked={playKeySounds} onChange={e=>setPlayKeySounds(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Layers className="text-blue-400" size={18}/><span className="text-sm">BGMを再生</span></div>
                                <input type="checkbox" checked={playLongAudio} onChange={e=>setPlayLongAudio(e.target.checked)} className="accent-blue-500"/>
                             </label>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Speaker className="text-blue-400" size={18}/><span className="text-sm">バックサウンドを再生</span></div>
                                 <input type="checkbox" checked={playBgSounds} onChange={e=>setPlayBgSounds(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            <div className="border-t border-blue-900/30 my-2"></div>
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><EyeOff className="text-blue-400" size={18}/><span className="text-sm">ミュート音源をモニターに表示</span></div>
                                <input type="checkbox" checked={showMutedMonitor} onChange={e=>setShowMutedMonitor(e.target.checked)} className="accent-blue-500"/>
                               </label>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><FileX className="text-blue-400" size={18}/><span className="text-sm">停止時に音源情報を残す</span></div>
                                 <input type="checkbox" checked={showAbortedMonitor} onChange={e=>setShowAbortedMonitor(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            
                            {!isMobile && (
                                <>
                                    <div className="border-t border-blue-900/30 my-2"></div>
                                    <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                        <div className="flex items-center gap-3"><Gamepad2 className="text-blue-400" size={18}/><span className="text-sm font-bold text-blue-200">デバッグ用キー入力</span></div>
                                        <input type="checkbox" checked={isInputDebugMode} onChange={e=>setIsInputDebugMode(e.target.checked)} className="accent-blue-500"/>
                                    </label>

                                    {isInputDebugMode && (
                                        <div className="flex items-center justify-between pl-6 border-l-2 border-gray-700 ml-1 bg-black/10 p-2 rounded">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-300">入力時に自動再生音をミュート</span>
                                                <span className="text-[10px] text-gray-500">キー音再生設定に関わらず自動再生音が消えます</span>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={muteDebugAutoPlay} 
                                                onChange={(e) => setMuteDebugAutoPlay(e.target.checked)} 
                                                className="accent-green-500 w-4 h-4" 
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;