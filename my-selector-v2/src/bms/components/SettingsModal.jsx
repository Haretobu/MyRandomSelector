// src/bms/components/SettingsModal.jsx
import React, { memo, useState, useEffect, useRef } from 'react';
import { Settings, X, ChevronsUp, Film, FolderOpen, FileArchive, ChevronDown } from 'lucide-react';
import { VISIBILITY_MODES } from '../constants';
import InputSettings from './settings/InputSettings';
import SystemSettings from './settings/SystemSettings';
import { SoundEffectSettings, HitSoundSettings } from './settings/SoundSettings';
import PlaySettings from './settings/PlaySettings';

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
                    <ChevronsUp size={14} /> <span>HI-SPEED (グリーンナンバー固定)</span>
                    <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <span className="text-[10px] text-blue-300">オート</span>
                    <input type="checkbox" checked={autoHiSpeed} onChange={e => setAutoHiSpeed(e.target.checked)} className="accent-blue-500 w-4 h-4"/>
                </label>
            </div>
            {open && (
                <div className="pt-3 mt-1 border-t border-blue-900/30">
                    <div className={`flex items-center gap-2 ${autoHiSpeed ? '' : 'opacity-40 pointer-events-none'}`}>
                        <span className="text-[11px] text-blue-300 w-32 shrink-0">目標グリーンナンバー</span>
                        <input type="number" min="60" max="1500" step="5" value={targetGreen}
                            onChange={e => setTargetGreen(Math.max(60, Math.min(1500, Number(e.target.value) || 300)))}
                            className="w-20 bg-black/50 border border-blue-500/30 rounded px-2 py-1 text-white text-sm text-center font-mono"/>
                        <span className="text-[11px] text-blue-500/70">ms</span>
                    </div>
                    <div className="text-[10px] text-blue-500/60 mt-2 leading-relaxed">
                        現在 HI-SPEED: <span className="text-blue-300 font-mono">{hiSpeed}</span>（{autoHiSpeed ? '自動' : '手動'}）。
                        HI-SPEED を手動で変えるとオートは OFF になります。
                    </div>
                </div>
            )}
        </div>
    );
}

const SettingsModal = ({
    showSettings, setShowSettings, isMobile,
    visibilityMode, setVisibilityMode,
    suddenPlusVal, setSuddenPlusVal, hiddenPlusVal, setHiddenPlusVal, liftVal, setLiftVal,
    comboPos, setComboPos, 
    volume, setVolume, monitorUpdateInterval, setMonitorUpdateInterval,
    hasVideo, playBgaVideo, setPlayBgaVideo,
    scratchRotationEnabled, setScratchRotationEnabled,
    input, // 入力タブ(キー割り当て / ゲームパッド)の設定一式。InputSettings.jsx を参照
    play, // プレイタブ(レーンミュート / オプション / プレイモード)の設定一式。PlaySettings.jsx を参照
    sound, // 音タブ(サウンドエフェクト / 打鍵音)の設定一式。SoundSettings.jsx を参照
    system, // システムタブ(lite モード / 詳細設定1)の設定一式。SystemSettings.jsx を参照
    missLayerEnabled, setMissLayerEnabled,
    bgaBehindChart, setBgaBehindChart,
    bgaSidePanel, setBgaSidePanel,
    bgaSidePos, setBgaSidePos,
    laneWidthPx, setLaneWidthPx,
    // ファイル操作
    handleFileSelect, handleZipSelect, bmsList, selectedBmsIndex, setSelectedBmsIndex,
    hiSpeed, setHiSpeed, bgaOpacity, setBgaOpacity,
    autoHiSpeed, setAutoHiSpeed, targetGreen, setTargetGreen,
    boardOpacity, setBoardOpacity,
    laneOpacity, setLaneOpacity,
    parsedSong,
}) => {
    // PC はタブ付き右ドロワー。モバイルは従来どおり全画面モーダル(タブなし・1画面スクロール)。
    const [tab, setTab] = useState('view');
    if (!showSettings && isMobile) return null;

    const T = isMobile ? null : tab;   // null = 全表示(モバイル)
    const showView = !T || T === 'view';
    const showPlay = !T || T === 'play';
    const showInput = !T || T === 'input';
    const showSound = !T || T === 'sound';
    const showSystem = !T || T === 'system';

    const TABS = [
        { id: 'view', label: '表示' },
        { id: 'play', label: 'プレイ' },
        { id: 'input', label: '入力' },
        { id: 'sound', label: '音' },
        { id: 'system', label: 'システム' },
    ];

    const header = (
        <div className="flex justify-between items-center mb-3 shrink-0">
            <div className="text-lg md:text-xl font-bold text-blue-400 flex items-center gap-2"><Settings size={18} /> 設定</div>
            <button onClick={() => setShowSettings(false)} className="text-blue-400 hover:text-white transition p-1.5 bg-white/10 rounded-full"><X size={20} /></button>
        </div>
    );
    const tabBar = !isMobile && (
        <div className="flex gap-1 mb-3 shrink-0">
            {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex-1 text-[11px] font-bold py-1.5 rounded transition ${tab === t.id
                        ? 'bg-blue-600/30 text-white border-b-2 border-blue-400'
                        : 'text-blue-400/60 hover:text-blue-200 hover:bg-white/5'}`}>
                    {t.label}
                </button>
            ))}
        </div>
    );

    const content = (
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-900 pr-1 space-y-4">
                    
                    {/* スマホ用: ファイル読み込み・基本設定 */}
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

                    {/* 表示・BGA設定 */}
                    <div hidden={!showView} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
                        <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                            <Film size={14} /> 表示・BGA設定
                        </div>
                        <div className="space-y-4">
                            <label className={`flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent ${!hasVideo ? 'opacity-50' : 'hover:border-blue-500/30'}`}>
                                <span className="text-sm">BGA動画再生 (重い場合OFF)</span>
                                <input type="checkbox" checked={playBgaVideo} onChange={e=>setPlayBgaVideo(e.target.checked)} disabled={!hasVideo} className="accent-blue-500 w-5 h-5"/>
                            </label>

                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                                <span className="text-sm">ミスレイヤー (POOR BGA) を表示</span>
                                <input type="checkbox" checked={!!missLayerEnabled} onChange={e=>setMissLayerEnabled(e.target.checked)} className="accent-blue-500 w-5 h-5"/>
                            </label>
                            <p className="text-[10px] text-gray-400 -mt-2 leading-relaxed">
                                オート: <span className="font-mono">M</span> キーで発動 ／ 自己プレイ: 空POOR以外の POOR・BAD で発動
                            </p>

                            {!isMobile && (
                                <div className="pt-2 border-t border-blue-900/30 space-y-2">
                                    <div className="text-[11px] font-bold text-blue-300">PC の BGA 表示位置</div>
                                    <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                                        <span className="text-sm">レーン背面に BGA を表示</span>
                                        <input type="checkbox" checked={!!bgaBehindChart} onChange={e=>setBgaBehindChart(e.target.checked)} className="accent-blue-500 w-5 h-5"/>
                                    </label>
                                    <p className="text-[10px] text-gray-400 -mt-1 leading-relaxed">
                                        ※ 「ボード全体の背景 (黒)」を下げると見えやすくなります
                                    </p>
                                    <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                                        <span className="text-sm">サイド BGA パネル (IIDX 風)</span>
                                        <input type="checkbox" checked={!!bgaSidePanel} onChange={e=>setBgaSidePanel(e.target.checked)} className="accent-blue-500 w-5 h-5"/>
                                    </label>
                                    <div className={`flex gap-2 ${bgaSidePanel ? '' : 'opacity-40 pointer-events-none'}`}>
                                        {['left', 'right'].map(p => (
                                            <button key={p} onClick={() => setBgaSidePos(p)}
                                                className={`flex-1 text-[11px] font-bold py-1.5 rounded border transition ${bgaSidePos === p
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
                                    <span>{Math.round(bgaOpacity * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.05" value={bgaOpacity} onChange={e => setBgaOpacity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                            </div>

                            {!isMobile && setLaneWidthPx && (
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-blue-300">レーン幅 (PC)</span>
                                        <span>{laneWidthPx}px</span>
                                    </div>
                                    <input type="range" min="20" max="72" step="1" value={laneWidthPx} onChange={e => setLaneWidthPx(Number(e.target.value))} className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                    <p className="text-[10px] text-gray-400 mt-1">※レーン領域の幅が変わります。余った幅はサイドBGA等に使われます。</p>
                                </div>
                            )}

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

                    {/* レーンカバー設定 (共通) */}
                    <div hidden={!showView} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 relative">
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

                    {/* オートHI-SPEED / グリーンナンバー固定 (共通・折りたたみ) */}
                    <div hidden={!showView}>
                        <AutoHiSpeedSection autoHiSpeed={autoHiSpeed} setAutoHiSpeed={setAutoHiSpeed} targetGreen={targetGreen} setTargetGreen={setTargetGreen} hiSpeed={hiSpeed} />
                    </div>

                    {/* プレイタブ: レーンミュート / プレイサイド・レーンオプション / プレイモード */}
                    <PlaySettings hidden={!showPlay} isMobile={isMobile} song={parsedSong} play={play} />

                    {/* 入力タブ: キー割り当て / ゲームパッド (PC のみ・モード対応) */}
                    {!isMobile && showInput && <InputSettings mode={parsedSong?.mode || 'SP7'} input={input} />}

                    {/* サウンドエフェクト (共通・6-3) */}
                    <SoundEffectSettings hidden={!showSound} sound={sound} />

                    {/* システムタブ: lite モード / 詳細設定1 */}
                    <SystemSettings hidden={!showSystem} isMobile={isMobile} system={system} />

                    {/* 音タブ: 詳細設定2 (カスタム打鍵音) */}
                    <HitSoundSettings hidden={!showSound} isMobile={isMobile} sound={sound} />
                </div>
    );

    if (isMobile) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                <div className="bg-[#080808] w-full max-w-[700px] h-[90vh] border-2 border-blue-900/50 shadow-2xl p-4 relative text-blue-100 flex flex-col rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    {header}
                    {content}
                </div>
            </div>
        );
    }

    // PC: 右ドロワー。純粋なオーバーレイ(fixed)で、アプリ本体のレイアウト幅には影響を与えない。
    // 開いている間は画面右端の内容(BACKING TRACK 列など)に重なって表示される。
    return (
        <div className="fixed top-0 right-0 h-full z-[95] w-[min(380px,42vw)] bg-[#080808] border-l-2 border-blue-900/50 shadow-2xl p-3 text-blue-100 flex flex-col transition-transform duration-300 ease-out"
             style={{ transform: showSettings ? 'translateX(0)' : 'translateX(100%)' }}>
            {header}
            {tabBar}
            {showSettings ? content : null}
        </div>
    );
};

export default memo(SettingsModal);