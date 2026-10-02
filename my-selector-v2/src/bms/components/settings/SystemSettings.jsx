// src/bms/components/settings/SystemSettings.jsx
// 設定画面の「システム」タブ: lite モード(低スペック機向け)と 詳細設定1(システム・デバッグ)。
import React from 'react';
import { Flag, Music, Layers, Speaker, EyeOff, FileX, Gamepad2, ChevronDown, Gauge, RotateCcw } from 'lucide-react';
import { DEFAULT_LITE_MODE, LITE_MODE_ITEMS } from '../../constants';

// lite モード(低スペック機向け)。親スイッチを ON にすると詳細項目が展開される。
function LiteModeSection({ liteMode, setLiteMode }) {
    const lm = liteMode || DEFAULT_LITE_MODE;
    const on = !!lm.enabled;
    const activeCount = LITE_MODE_ITEMS.filter(it => lm[it.key]).length;
    return (
        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Gauge size={14} /> lite モード(低スペック機向け)</span>
                {on && (
                    <button
                        onClick={() => setLiteMode({ ...DEFAULT_LITE_MODE, enabled: true })}
                        className="text-[10px] font-bold text-blue-300 hover:text-white flex items-center gap-1 bg-black/40 border border-blue-900/50 rounded px-2 py-1 transition">
                        <RotateCcw size={11} /> 既定に戻す
                    </button>
                )}
            </div>
            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                <div className="flex flex-col">
                    <span className="text-sm">lite モードを有効にする</span>
                    <span className="text-[10px] text-blue-400/60">見た目・演出を少し落として動作を軽くします。この設定はこのPC(ブラウザ)にだけ保存されます</span>
                </div>
                <input type="checkbox" checked={on} onChange={e => setLiteMode({ ...lm, enabled: e.target.checked })} className="accent-blue-500 w-4 h-4 shrink-0 ml-2" />
            </label>

            {on && (
                <div className="mt-2 space-y-1">
                    <div className="text-[10px] text-blue-400/60 px-1">有効な項目: {activeCount} / {LITE_MODE_ITEMS.length}</div>
                    {LITE_MODE_ITEMS.map(it => (
                        <label key={it.key} className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                            <div className="flex flex-col">
                                <span className="text-[13px]">{it.label}</span>
                                <span className="text-[10px] text-blue-400/60">{it.desc}</span>
                            </div>
                            <input type="checkbox" checked={!!lm[it.key]} onChange={e => setLiteMode({ ...lm, [it.key]: e.target.checked })} className="accent-blue-500 w-4 h-4 shrink-0 ml-2" />
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * システムタブ全体。
 * @param {boolean} hidden タブが選ばれていないとき true(要素は残したまま隠す)
 * @param {boolean} isMobile
 * @param {object} system BmsViewer のシステム設定一式
 *   { liteMode, showReady, playKeySounds, playLongAudio, playBgSounds, resumeAudioOnSeek,
 *     showMutedMonitor, showAbortedMonitor, isInputDebugMode, muteDebugAutoPlay } とそれぞれの setXxx
 */
export default function SystemSettings({ hidden, isMobile, system }) {
    return (
        <>
        {/* lite モード (システム) */}
        <div hidden={hidden}><LiteModeSection liteMode={system.liteMode} setLiteMode={system.setLiteMode} /></div>

        {/* 詳細設定1 (システム・デバッグ) */}
        <details hidden={hidden} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open={!isMobile}>
            <summary className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer list-none">
                <span>詳細設定1 (システム・デバッグ)</span>
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 pt-2">
                 <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                    <div className="flex items-center gap-3"><Flag className="text-blue-400" size={18}/><span className="text-sm">開始時のREADY演出</span></div>
                    <input type="checkbox" checked={system.showReady} onChange={e=>system.setShowReady(e.target.checked)} className="accent-blue-500"/>
                 </label>
                <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                    <div className="flex items-center gap-3"><Music className="text-blue-400" size={18}/><span className="text-sm">キー音を再生</span></div>
                    <input type="checkbox" checked={system.playKeySounds} onChange={e=>system.setPlayKeySounds(e.target.checked)} className="accent-blue-500"/>
                </label>
                <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                    <div className="flex items-center gap-3"><Layers className="text-blue-400" size={18}/><span className="text-sm">BGMを再生</span></div>
                    <input type="checkbox" checked={system.playLongAudio} onChange={e=>system.setPlayLongAudio(e.target.checked)} className="accent-blue-500"/>
                 </label>
                <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                    <div className="flex items-center gap-3"><Speaker className="text-blue-400" size={18}/><span className="text-sm">バックサウンドを再生</span></div>
                     <input type="checkbox" checked={system.playBgSounds} onChange={e=>system.setPlayBgSounds(e.target.checked)} className="accent-blue-500"/>
                </label>
                <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                    <div className="flex items-center gap-3"><Music className="text-blue-400" size={18}/>
                        <div className="flex flex-col">
                            <span className="text-sm">シーク後も鳴っている音を途中から再生</span>
                            <span className="text-[10px] text-blue-400/60">OFF = beatoraja 式(シーク地点より前に始まった音は鳴らさない)。一時停止→再開は常に続きから再生</span>
                        </div>
                    </div>
                    <input type="checkbox" checked={system.resumeAudioOnSeek} onChange={e=>system.setResumeAudioOnSeek(e.target.checked)} className="accent-blue-500"/>
                </label>
                <div className="border-t border-blue-900/30 my-2"></div>
                 <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                    <div className="flex items-center gap-3"><EyeOff className="text-blue-400" size={18}/><span className="text-sm">ミュート音源をモニターに表示</span></div>
                    <input type="checkbox" checked={system.showMutedMonitor} onChange={e=>system.setShowMutedMonitor(e.target.checked)} className="accent-blue-500"/>
                   </label>
                <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                    <div className="flex items-center gap-3"><FileX className="text-blue-400" size={18}/><span className="text-sm">停止時に音源情報を残す</span></div>
                     <input type="checkbox" checked={system.showAbortedMonitor} onChange={e=>system.setShowAbortedMonitor(e.target.checked)} className="accent-blue-500"/>
                </label>
                
                {!isMobile && (
                    <>
                        <div className="border-t border-blue-900/30 my-2"></div>
                        <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                            <div className="flex items-center gap-3"><Gamepad2 className="text-blue-400" size={18}/><span className="text-sm font-bold text-blue-200">デバッグ用キー入力</span></div>
                            <input type="checkbox" checked={system.isInputDebugMode} onChange={e=>system.setIsInputDebugMode(e.target.checked)} className="accent-blue-500"/>
                        </label>

                        {system.isInputDebugMode && (
                            <div className="flex items-center justify-between pl-6 border-l-2 border-gray-700 ml-1 bg-black/10 p-2 rounded">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-300">入力時に自動再生音をミュート</span>
                                    <span className="text-[10px] text-gray-500">キー音再生設定に関わらず自動再生音が消えます</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={system.muteDebugAutoPlay} 
                                    onChange={(e) => system.setMuteDebugAutoPlay(e.target.checked)} 
                                    className="accent-green-500 w-4 h-4" 
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </details>
        </>
    );
}
