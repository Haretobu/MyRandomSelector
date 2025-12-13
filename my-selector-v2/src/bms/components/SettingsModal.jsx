// src/bms/components/SettingsModal.jsx
import React from 'react';
import { Settings, X, ChevronsUp, RotateCw, Disc, ChevronDown, Film, Flag, Music, Layers, Speaker, EyeOff, FileX, Keyboard } from 'lucide-react';
import { VISIBILITY_MODES } from '../constants';

const SettingsModal = ({
    showSettings, setShowSettings, visibilityMode, setVisibilityMode,
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
    isInputDebugMode, setIsInputDebugMode
}) => {
    if (!showSettings) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="bg-[#080808] w-[700px] border-2 border-blue-900/50 shadow-2xl p-6 relative text-blue-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 relative z-50">
                     <div className="text-2xl font-bold text-blue-400 flex items-center gap-2"><Settings /> 設定</div>
                    <button onClick={() => setShowSettings(false)} className="text-blue-400 hover:text-white transition absolute right-0 top-0 z-50 p-2"><X size={28} /></button>
                </div>
                <div className="flex flex-col gap-6">
                     {/* LANE COVER SETTINGS */}
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 relative">
                        <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                            <ChevronsUp size={14} /> 譜面の表示エリア (LANE COVER)
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-3 gap-2">
                                 {[
                                    { mode: VISIBILITY_MODES.OFF, label: 'OFF' },
                                    { mode: VISIBILITY_MODES.SUDDEN_PLUS, label: 'SUDDEN+' },
                                    { mode: VISIBILITY_MODES.HIDDEN_PLUS, label: 'HIDDEN+' },
                                    { mode: VISIBILITY_MODES.SUD_HID_PLUS, label: 'SUD+ & HID+' },
                                     { mode: VISIBILITY_MODES.LIFT, label: 'LIFT' },
                                    { mode: VISIBILITY_MODES.LIFT_SUD_PLUS, label: 'LIFT & SUD+' }
                                 ].map(opt => (
                                    <button 
                                        key={opt.mode}
                                        onClick={() => setVisibilityMode(opt.mode)}
                                        className={`py-2 px-3 text-xs font-bold rounded border transition-all ${visibilityMode === opt.mode 
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
                                {visibilityMode === VISIBILITY_MODES.OFF && <span className="text-[10px] text-gray-500 text-center italic py-1">表示オプションなし</span>}
                             </div>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                         <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex justify-between items-center">
                             <span className="font-bold text-sm text-blue-300">プレイサイド</span>
                             <button onClick={() => setPlaySide(p => p==='1P'?'2P':'1P')} className="bg-blue-600/20 border border-blue-500/50 px-6 py-1 text-blue-100 hover:bg-blue-600/40 transition rounded w-32 font-mono">{playSide}</button>
                          </div>
                         <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex flex-col gap-2 relative">
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
                             <div className="text-[10px] font-mono text-blue-400/70 text-right tracking-widest">
                                  {currentLaneOrder.join(' ')}
                             </div>
                         </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex justify-between items-center">
                             <span className="font-bold text-sm text-blue-300">コンボ表示位置</span>
                             <div className="relative bg-blue-600/20 border border-blue-500/50 rounded hover:bg-blue-600/30 transition">
                                  <select value={comboPos} onChange={e => setComboPos(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full">
                                     <option value="CENTER" className="bg-black text-white">中央 (CENTER)</option><option value="LEFT" className="bg-black text-white">左側 (LEFT)</option><option value="OFF" className="bg-black text-white">非表示 (OFF)</option>
                                  </select>
                                 <div className="px-3 py-1 text-blue-100 text-sm min-w-[100px] text-center">{comboPos}</div>
                             </div>
                         </div>
                         <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex flex-col gap-2">
                             <div className="flex justify-between items-center relative">
                                  <span className="font-bold text-sm text-blue-300">鍵盤 打鍵音</span>
                                 <div className="flex items-center gap-2">
                                     <div className="text-blue-400 text-sm underline cursor-pointer relative hover:text-blue-200 transition max-w-[100px] truncate">
                                         {customKeyHitSound ? '設定済み' : 'デフォルト'}
                                         <input type="file" accept="audio/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleKeyHitSoundUpload} />
                                     </div>
                                      {customKeyHitSound && <button onClick={handleKeyHitSoundReset} className="text-blue-400 hover:text-white"><RefreshCcw size={14} /></button>}
                                 </div>
                             </div>
                             <div className="flex justify-between items-center relative border-t border-blue-900/20 pt-1">
                                 <span className="font-bold text-sm text-blue-300 flex items-center gap-1"><Disc size={12}/> 皿 打鍵音</span>
                                  <div className="flex items-center gap-2">
                                     <div className="text-blue-400 text-sm underline cursor-pointer relative hover:text-blue-200 transition max-w-[100px] truncate">
                                         {customScratchHitSound ? '設定済み' : 'デフォルト'}
                                         <input type="file" accept="audio/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleScratchHitSoundUpload} />
                                     </div>
                                      {customScratchHitSound && <button onClick={handleScratchHitSoundReset} className="text-blue-400 hover:text-white"><RefreshCcw size={14} /></button>}
                                 </div>
                             </div>
                          </div>
                    </div>
                    <details className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open>
                        <summary className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer list-none">
                            <span>サウンド・表示設定</span>
                            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-900 scrollbar-track-black/20">
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                                <span className="text-sm text-blue-300">マスター音量</span>
                                 <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                                  <span className="text-sm text-blue-300">モニター更新間隔 ({monitorUpdateInterval}ms)</span>
                                <input type="range" min="10" max="1000" step="10" value={monitorUpdateInterval} onChange={e => setMonitorUpdateInterval(Number(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                            </div>
                             <label className={`flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer transition border border-transparent ${!hasVideo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/40 hover:border-blue-500/30'}`}>
                                <div className="flex items-center gap-3"><Film className="text-blue-400" size={18}/><span className="text-sm">BGA動画を再生</span></div>
                                <input type="checkbox" checked={playBgaVideo} onChange={e=>setPlayBgaVideo(e.target.checked)} disabled={!hasVideo} className="accent-blue-500"/>
                             </label>
                            <div className="border-t border-blue-900/30 my-2"></div>
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
                            <div className="border-t border-blue-900/30 my-2"></div>
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><RotateCw className="text-blue-400" size={18}/><span className="text-sm">スクラッチの定常回転</span></div>
                                 <input type="checkbox" checked={scratchRotationEnabled} onChange={e=>setScratchRotationEnabled(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            <div className="border-t border-blue-900/30 my-2"></div>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Keyboard className="text-red-400" size={18}/><span className="text-sm font-bold text-red-200">デバッグ用キー入力</span></div>
                                <input type="checkbox" checked={isInputDebugMode} onChange={e=>setIsInputDebugMode(e.target.checked)} className="accent-red-500"/>
                             </label>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;