// src/bms/components/SettingsModal.jsx
import React, { memo, useState, useEffect } from 'react';
import { Settings, X, ChevronsUp, RotateCw, Film, Flag, Music, Layers, Speaker, EyeOff, FileX, Keyboard, FolderOpen, FileArchive, ChevronDown, Gamepad2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { VISIBILITY_MODES, LANE_LAYOUTS, MODE_LABELS, DEFAULT_KEYMAPS, keyCodeLabel } from '../constants';

// キー割り当て設定(6-1-d)。表示・保存のみ。手動プレイの判定入力接続は P6-2。
function KeyMapSection({ mode, keyMaps, setKeyMaps }) {
    const km = DEFAULT_KEYMAPS[mode] ? mode : 'SP7';
    const curMap = (keyMaps && keyMaps[km]) || DEFAULT_KEYMAPS[km];
    const laneList = LANE_LAYOUTS[km] || LANE_LAYOUTS.SP7;
    const [listeningLane, setListeningLane] = useState(null);

    useEffect(() => {
        if (listeningLane == null) return;
        const onKey = (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.code === 'Escape') { setListeningLane(null); return; }
            setKeyMaps(prev => {
                const next = { ...prev };
                const m = { ...(next[km] || DEFAULT_KEYMAPS[km]) };
                const oldCode = m[listeningLane];
                // 既に他レーンが使っているコードなら入れ替え
                const dup = Object.keys(m).find(k => m[k] === e.code && Number(k) !== listeningLane);
                if (dup != null) m[dup] = oldCode;
                m[listeningLane] = e.code;
                next[km] = m;
                return next;
            });
            setListeningLane(null);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [listeningLane, km, setKeyMaps]);

    const laneLabel = (lane) => {
        if (lane.kind === 'scratch') return lane.side === 1 ? '2P SC' : 'SC';
        if (km === 'PMS9') return `B${lane.index + 1}`;
        const n = lane.side === 0 ? lane.index : lane.index - 8;
        return `${lane.side === 1 ? '2P ' : ''}${n}`;
    };

    return (
        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Keyboard size={14} /> キー割り当て（{MODE_LABELS[km] || km}）</span>
                <button
                    onClick={() => { setListeningLane(null); setKeyMaps(prev => ({ ...prev, [km]: { ...DEFAULT_KEYMAPS[km] } })); }}
                    className="text-[10px] font-bold text-blue-300 hover:text-white flex items-center gap-1 bg-black/40 border border-blue-900/50 rounded px-2 py-1 transition">
                    <RotateCcw size={11} /> デフォルトに戻す
                </button>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
                {laneList.map((lane, i, arr) => {
                    const brk = i > 0 && arr[i - 1].side !== lane.side;
                    const listening = listeningLane === lane.index;
                    return (
                        <React.Fragment key={lane.index}>
                            {brk && <div className="basis-full h-0" />}
                            <button
                                onClick={() => setListeningLane(listening ? null : lane.index)}
                                className={`w-[52px] rounded border px-1 py-1 transition-all flex flex-col items-center gap-0.5 ${listening
                                    ? 'bg-orange-600 border-orange-400 text-white animate-pulse shadow-[0_0_10px_rgba(234,88,12,0.6)]'
                                    : 'bg-black/40 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-blue-500/40'}`}>
                                <span className="text-[8px] opacity-60 leading-none">{laneLabel(lane)}</span>
                                <span className="font-mono text-[11px] font-bold leading-none whitespace-nowrap">{listening ? '…' : keyCodeLabel(curMap[lane.index])}</span>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
            <div className="text-[10px] text-blue-500/60 mt-2 leading-relaxed">
                ボタンを押してからキーを入力すると割り当てが変わります（Esc でキャンセル）。他のレーンと重複するキーは自動で入れ替わります。<br />
                ※ 手動プレイの判定入力への接続は今後のアップデート（プレイ機能）で対応します。現在は表示と保存のみです。
            </div>
        </div>
    );
}

// 6-3: サウンドエフェクト(EQ / ECHO / COMP / FILTER)。
function AudioFxSection({ audioFx, setAudioFx }) {
    const fx = audioFx || {};
    const patch = (k, v) => setAudioFx({ ...fx, [k]: { ...(fx[k] || {}), ...v } });
    const master = !!fx.enabled;

    const Row = ({ label, children }) => (
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-blue-300 w-14 shrink-0">{label}</span>
            {children}
        </div>
    );
    const Slider = ({ min, max, step, value, onChange, fmt }) => (
        <>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
            <span className="text-[10px] font-mono w-12 text-right">{fmt ? fmt(value) : value}</span>
        </>
    );
    const SubHead = ({ k, name }) => (
        <label className="flex items-center justify-between cursor-pointer mt-2 mb-1">
            <span className="text-[11px] font-bold text-blue-200">{name}</span>
            <input type="checkbox" checked={!!fx[k]?.on} disabled={!master}
                onChange={e => patch(k, { on: e.target.checked })} className="accent-orange-500 w-4 h-4" />
        </label>
    );

    return (
        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                <SlidersHorizontal size={14} /> サウンドエフェクト
            </div>
            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                <span className="text-sm">エフェクトを有効にする（EQ / ECHO / COMP / FILTER）</span>
                <input type="checkbox" checked={master} onChange={e => setAudioFx({ ...fx, enabled: e.target.checked })} className="accent-blue-500 w-4 h-4" />
            </label>

            <div className={`mt-2 space-y-1 ${master ? '' : 'opacity-40 pointer-events-none'}`}>
                {/* FILTER */}
                <SubHead k="filter" name="FILTER" />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    <Row label="種類">
                        <div className="flex gap-1 flex-1">
                            {['lowpass', 'highpass'].map(t => (
                                <button key={t} onClick={() => patch('filter', { type: t })}
                                    className={`flex-1 text-[10px] font-bold py-1 rounded border transition ${fx.filter?.type === t
                                        ? 'bg-orange-600 border-orange-400 text-white' : 'bg-black/40 border-gray-700 text-gray-400'}`}>
                                    {t === 'lowpass' ? 'LOW-PASS' : 'HIGH-PASS'}
                                </button>
                            ))}
                        </div>
                    </Row>
                    <Row label="周波数">
                        <Slider min={40} max={18000} step={10} value={fx.filter?.freq ?? 12000}
                            onChange={v => patch('filter', { freq: v })} fmt={v => `${(v / 1000).toFixed(1)}k`} />
                    </Row>
                </div>

                {/* EQ */}
                <SubHead k="eq" name="EQ (3BAND)" />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    {[['low', 'LOW'], ['mid', 'MID'], ['high', 'HIGH']].map(([k, lbl]) => (
                        <Row key={k} label={lbl}>
                            <Slider min={-18} max={18} step={1} value={fx.eq?.[k] ?? 0}
                                onChange={v => patch('eq', { [k]: v })} fmt={v => `${v > 0 ? '+' : ''}${v}dB`} />
                        </Row>
                    ))}
                </div>

                {/* COMP */}
                <SubHead k="comp" name="COMPRESSOR" />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    <Row label="Thresh">
                        <Slider min={-60} max={0} step={1} value={fx.comp?.threshold ?? -24}
                            onChange={v => patch('comp', { threshold: v })} fmt={v => `${v}dB`} />
                    </Row>
                    <Row label="Ratio">
                        <Slider min={1} max={20} step={0.5} value={fx.comp?.ratio ?? 4}
                            onChange={v => patch('comp', { ratio: v })} fmt={v => `${v}:1`} />
                    </Row>
                </div>

                {/* ECHO */}
                <SubHead k="echo" name="ECHO (DELAY)" />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    <Row label="Time">
                        <Slider min={0.05} max={1.2} step={0.01} value={fx.echo?.time ?? 0.3}
                            onChange={v => patch('echo', { time: v })} fmt={v => `${Math.round(v * 1000)}ms`} />
                    </Row>
                    <Row label="Feedback">
                        <Slider min={0} max={0.9} step={0.01} value={fx.echo?.feedback ?? 0.35}
                            onChange={v => patch('echo', { feedback: v })} fmt={v => `${Math.round(v * 100)}%`} />
                    </Row>
                    <Row label="Mix">
                        <Slider min={0} max={1} step={0.01} value={fx.echo?.mix ?? 0.25}
                            onChange={v => patch('echo', { mix: v })} fmt={v => `${Math.round(v * 100)}%`} />
                    </Row>
                </div>
            </div>
            <div className="text-[10px] text-blue-500/60 mt-2 leading-relaxed">
                キー音・BGM・打鍵音すべてに掛かります。設定は自動保存されます。
            </div>
        </div>
    );
}

const SettingsModal = ({
    showSettings, setShowSettings, isMobile,
    visibilityMode, setVisibilityMode,
    suddenPlusVal, setSuddenPlusVal, hiddenPlusVal, setHiddenPlusVal, liftVal, setLiftVal,
    playSide, setPlaySide, playOption, setPlayOption, currentLaneOrder, refreshRandom,
    playOption2, setPlayOption2, dpFlip, setDpFlip, laneOrder2,
    comboPos, setComboPos, 
    customKeyHitSound, handleKeyHitSoundUpload, handleKeyHitSoundReset,
    customScratchHitSound, handleScratchHitSoundUpload, handleScratchHitSoundReset,
    volume, setVolume, monitorUpdateInterval, setMonitorUpdateInterval,
    hasVideo, playBgaVideo, setPlayBgaVideo, hitSoundVolume, setHitSoundVolume,
    showReady, setShowReady, playKeySounds, setPlayKeySounds, playLongAudio, setPlayLongAudio,
    playBgSounds, setPlayBgSounds, showMutedMonitor, setShowMutedMonitor,
    showAbortedMonitor, setShowAbortedMonitor, scratchRotationEnabled, setScratchRotationEnabled,
    isInputDebugMode, setIsInputDebugMode,
    muteDebugAutoPlay, setMuteDebugAutoPlay,
    keyMaps, setKeyMaps,
    playMode, setPlayMode,
    judgeOffset, setJudgeOffset, suggestJudgeOffset,
    audioFx, setAudioFx,
    // ファイル操作
    handleFileSelect, handleZipSelect, bmsList, selectedBmsIndex, setSelectedBmsIndex,
    hiSpeed, setHiSpeed, bgaOpacity, setBgaOpacity,
    autoHiSpeed, setAutoHiSpeed, targetGreen, setTargetGreen,
    laneMute, setLaneMute,
    boardOpacity, setBoardOpacity,
    laneOpacity, setLaneOpacity,
    parsedSong,
    // ▼▼▼ 追加: カスタム打鍵音用の一時保存と分離設定 ▼▼▼
    isSeparateHitSound, setIsSeparateHitSound,
    tempKeySoundName, tempScratchSoundName
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
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 relative">
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

                    {/* オートHI-SPEED / グリーンナンバー固定 (共通) */}
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
                        <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                            <ChevronsUp size={14} /> HI-SPEED (グリーンナンバー固定)
                        </div>
                        <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                            <span className="text-sm">オートHI-SPEED（主BPMで緑数字を固定）</span>
                            <input type="checkbox" checked={autoHiSpeed} onChange={e => setAutoHiSpeed(e.target.checked)} className="accent-blue-500 w-4 h-4"/>
                        </label>
                        <div className={`flex items-center gap-2 mt-2 ${autoHiSpeed ? '' : 'opacity-40 pointer-events-none'}`}>
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

                    {/* レーンミュート (共通・モード対応) */}
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
                        <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                            <Speaker size={14} /> レーンミュート
                        </div>
                        <div className="flex gap-1 justify-center flex-wrap">
                            {(parsedSong?.lanes || [{index:0,kind:'scratch',side:0},{index:1,kind:'key',side:0},{index:2,kind:'key',side:0},{index:3,kind:'key',side:0},{index:4,kind:'key',side:0},{index:5,kind:'key',side:0},{index:6,kind:'key',side:0},{index:7,kind:'key',side:0}]).map((lane, i, arr) => {
                                const lbl = lane.kind === 'scratch' ? 'SC'
                                    : parsedSong?.mode === 'PMS9' ? String(lane.index + 1)
                                    : String(lane.side === 0 ? lane.index : lane.index - 8);
                                const brk = i > 0 && arr[i - 1].side !== lane.side;
                                const muted = laneMute && laneMute[lane.index];
                                return (
                                    <React.Fragment key={lane.index}>
                                        {brk && <div className="basis-full h-0" />}
                                        <button
                                            onClick={() => setLaneMute((laneMute || new Array(16).fill(false)).map((v, idx) => idx === lane.index ? !v : v))}
                                            className={`w-8 h-8 rounded font-bold text-[10px] border transition-all ${muted
                                                ? 'bg-red-600/80 border-red-400 text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]'
                                                : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
                                            {lbl}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                        <div className="text-[10px] text-blue-500/60 mt-2 text-center">赤 = ミュート。そのレーンのキー音・打鍵音を鳴らさず、ノーツを薄く表示します。</div>
                    </div>

                    {/* キー割り当て (PC のみ・モード対応) */}
                    {!isMobile && (
                        <KeyMapSection mode={parsedSong?.mode || 'SP7'} keyMaps={keyMaps} setKeyMaps={setKeyMaps} />
                    )}

                    {/* PC用設定 */}
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                         {(() => {
                             const sideLocked = parsedSong && parsedSong.mode !== 'SP7' && parsedSong.mode !== 'SP5';
                             return (
                                 <div className={`w-full md:flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex justify-between items-center ${sideLocked ? 'opacity-40' : ''}`}>
                                     <span className="font-bold text-sm text-blue-300">プレイサイド</span>
                                     <button
                                         disabled={sideLocked}
                                         onClick={() => setPlaySide(p => p === '1P' ? '2P' : '1P')}
                                         className="bg-blue-600/20 border border-blue-500/50 px-6 py-1 text-blue-100 hover:bg-blue-600/40 disabled:cursor-not-allowed transition rounded w-32 font-mono">
                                         {sideLocked ? '—' : playSide}
                                     </button>
                                 </div>
                             );
                         })()}
                         {(() => {
                             const mode = parsedSong?.mode || 'SP7';
                             const isDP = mode === 'DP14' || mode === 'DP10';
                             const isPms = mode === 'PMS9';
                             const OPTS = isPms
                                 ? ['OFF', 'MIRROR', 'RANDOM', 'S-RANDOM']
                                 : ['OFF', 'MIRROR', 'RANDOM', 'R-RANDOM', 'S-RANDOM'];
                             const OptSelect = ({ value, onChange }) => (
                                 <div className="relative bg-blue-600/20 border border-blue-500/50 rounded hover:bg-blue-600/30 transition flex-1">
                                     <select value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full">
                                         {OPTS.map(o => <option key={o} value={o} className="bg-black text-white">{o === 'OFF' ? '正規 (OFF)' : o}</option>)}
                                     </select>
                                     <div className="px-3 py-1 text-blue-100 font-bold text-center">{value}</div>
                                 </div>
                             );
                             const orderText = (order, base) => {
                                 if (order === 'S') return '毎ノート乱数（固定配置なし）';
                                 if (!Array.isArray(order) || !order.length) return null;
                                 const inv = new Array(order.length);
                                 order.forEach((v, i) => { const p = v - base; if (p >= 0 && p < order.length) inv[p] = i + 1; });
                                 return inv.join('');
                             };
                             const t1 = playOption !== 'OFF' ? orderText(currentLaneOrder, isPms ? 0 : 1) : null;
                             const t2 = (isDP && playOption2 !== 'OFF') ? orderText(laneOrder2, 9) : null;
                             return (
                                 <div className="w-full md:flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex flex-col gap-2 relative">
                                     <div className="flex justify-between items-center">
                                         <span className="font-bold text-sm text-blue-300">レーンオプション</span>
                                         <button onClick={refreshRandom} title="RANDOM を振り直す" className="bg-blue-600/20 border border-blue-500/50 p-1 text-blue-300 hover:text-white hover:bg-blue-600/40 active:scale-95 transition rounded"><RotateCw size={18} /></button>
                                     </div>

                                     {isDP ? (
                                         <>
                                             <div className="flex items-center gap-2">
                                                 <span className="text-[11px] text-blue-400 w-8 shrink-0 font-bold">1P</span>
                                                 <OptSelect value={playOption} onChange={setPlayOption} />
                                             </div>
                                             <div className="flex items-center gap-2">
                                                 <span className="text-[11px] text-blue-400 w-8 shrink-0 font-bold">2P</span>
                                                 <OptSelect value={playOption2} onChange={setPlayOption2} />
                                             </div>
                                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30 mt-1">
                                                 <span className="text-[12px] text-blue-200">FLIP（1P ⇄ 2P 入れ替え）</span>
                                                 <input type="checkbox" checked={dpFlip} onChange={e => setDpFlip(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                                             </label>
                                         </>
                                     ) : (
                                         <OptSelect value={playOption} onChange={setPlayOption} />
                                     )}

                                     {(t1 || t2) && (
                                         <div className="text-[11px] font-mono text-blue-200/90 bg-black/30 rounded px-2 py-1 text-center border border-blue-900/40 space-y-0.5">
                                             {t1 && <div className="tracking-[0.2em]"><span className="text-blue-500/70 tracking-normal mr-1">{isDP ? '1P' : '配置'}</span>{t1}</div>}
                                             {t2 && <div className="tracking-[0.2em]"><span className="text-blue-500/70 tracking-normal mr-1">2P</span>{t2}</div>}
                                         </div>
                                     )}
                                 </div>
                             );
                         })()}
                    </div>

                    {/* プレイモード (PC のみ・6-2) */}
                    {!isMobile && (
                        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
                            <div className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                                <Gamepad2 size={14} /> プレイモード
                            </div>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                                <span className="text-sm">自分の入力で判定する（オートプレイ判定を止める）</span>
                                <input type="checkbox" checked={!!playMode} onChange={e => setPlayMode(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                            </label>
                            <div className="text-[10px] text-blue-500/60 mt-2 leading-relaxed">
                                キー割り当てで操作。判定・コンボ・EX SCORE・DJ LEVEL・FAST/SLOW を表示。完走でリザルト、途中は Tab 長押しで成績表示。<br />
                                皿は割り当てキー（既定 Shift）と Ctrl の2キー。CN は最初と逆方向に回して離す。<br />
                                ※「デバッグ用キー入力」とは別機能です（併用可）。
                            </div>

                            {/* 判定オフセット (6-2-c) */}
                            <div className="mt-3 pt-3 border-t border-blue-900/30">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[12px] font-bold text-blue-300">判定オフセット</span>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min={-100} max={100} step={1} value={judgeOffset}
                                            onChange={e => setJudgeOffset(Math.max(-100, Math.min(100, Math.round(Number(e.target.value) || 0))))}
                                            className="w-16 bg-black/50 border border-blue-500/30 rounded px-2 py-0.5 text-white text-sm text-center font-mono" />
                                        <span className="text-[11px] text-blue-500/70">ms</span>
                                    </div>
                                </div>
                                <input type="range" min={-100} max={100} step={1} value={judgeOffset}
                                    onChange={e => setJudgeOffset(Number(e.target.value))}
                                    className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                {(() => {
                                    const s = suggestJudgeOffset ? suggestJudgeOffset() : { n: 0, value: 0 };
                                    const enough = s.n >= 10;
                                    return (
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                disabled={!enough}
                                                onClick={() => setJudgeOffset(Math.max(-100, Math.min(100, s.value)))}
                                                className={`text-[11px] font-bold px-3 py-1 rounded border transition ${enough
                                                    ? 'bg-blue-600/30 border-blue-500/50 text-white hover:bg-blue-600/50'
                                                    : 'bg-black/30 border-gray-700 text-gray-500 cursor-not-allowed'}`}>
                                                オート調整
                                            </button>
                                            <span className="text-[10px] text-blue-500/70 font-mono">
                                                {enough ? `直近${s.n}件 → 推奨 ${s.value > 0 ? '+' : ''}${s.value}ms` : `データ不足（${s.n}/10）`}
                                            </span>
                                            <button onClick={() => setJudgeOffset(0)} className="ml-auto text-[10px] text-blue-400 hover:text-white border border-blue-900/50 rounded px-2 py-1">0に戻す</button>
                                        </div>
                                    );
                                })()}
                                <div className="text-[10px] text-blue-500/60 mt-1.5 leading-relaxed">
                                    FAST が多い（早入り）→ マイナス方向 / SLOW が多い（遅入り）→ プラス方向。オート調整は直近の判定タイミングの中央値から算出（ボタンで手動反映）。
                                </div>
                            </div>
                        </div>
                    )}

                    {/* サウンドエフェクト (共通・6-3) */}
                    <AudioFxSection audioFx={audioFx} setAudioFx={setAudioFx} />

                    {/* 詳細設定1 (システム・デバッグ) */}
                    <details className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open={!isMobile}>
                        <summary className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer list-none">
                            <span>詳細設定1 (システム・デバッグ)</span>
                            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-3 pt-2">
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Flag className="text-blue-400" size={18}/><span className="text-sm">開始時のREADY演出</span></div>
                                <input type="checkbox" checked={showReady} onChange={e=>setShowReady(e.target.checked)} className="accent-blue-500"/>
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

                    {/* 詳細設定2 (カスタム打鍵音設定) */}
                    <details className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open={!isMobile}>
                        <summary className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer list-none">
                            <span>詳細設定2 (カスタム打鍵音)</span>
                            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-3 pt-2">
                            
                            {/* 音量などの基本設定 */}
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                                <span className="text-sm text-blue-300">打鍵音の音量</span>
                                <input type="range" min="0" max="2" step="0.1" value={hitSoundVolume} onChange={e => setHitSoundVolume(parseFloat(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                            </div>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Music className="text-blue-400" size={18}/><span className="text-sm">キー音を再生</span></div>
                                <input type="checkbox" checked={playKeySounds} onChange={e=>setPlayKeySounds(e.target.checked)} className="accent-blue-500"/>
                            </label>

                            <div className="border-t border-blue-900/30 my-2"></div>

                            {/* カスタム音源アップロードエリア */}
                            <div className="bg-black/20 p-3 rounded space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-blue-200">打鍵音ファイルの変更</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-xs text-gray-400">通常とスクラッチを分ける</span>
                                        <input type="checkbox" checked={isSeparateHitSound} onChange={e => setIsSeparateHitSound(e.target.checked)} className="accent-blue-500" />
                                    </label>
                                </div>

                                {/* 通常ノーツ（または共通）用 */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-400">{isSeparateHitSound ? "通常ノーツ用 (WAV/OGG等)" : "共通打鍵音 (WAV/OGG等)"}</span>
                                    <div className="flex items-center gap-2">
                                        <label className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs cursor-pointer rounded transition shadow">
                                            ファイル選択
                                            <input type="file" accept="audio/*" className="hidden" onChange={handleKeyHitSoundUpload} onClick={(e) => { e.target.value = null; }} />
                                        </label>
                                        <span className="text-xs text-gray-300 truncate flex-1">{tempKeySoundName || customKeyHitSound || "デフォルト音源"}</span>
                                        {(tempKeySoundName || customKeyHitSound) && (
                                            <button onClick={handleKeyHitSoundReset} className="text-red-400 hover:text-red-300 px-2 py-1 text-xs rounded border border-red-900/50 bg-red-900/20 active:scale-95">リセット</button>
                                        )}
                                    </div>
                                </div>

                                {/* スクラッチ用 (チェックを入れた時だけ表示) */}
                                {isSeparateHitSound && (
                                    <div className="flex flex-col gap-1 pt-1">
                                        <span className="text-xs text-gray-400">スクラッチ用 (WAV/OGG等)</span>
                                        <div className="flex items-center gap-2">
                                            <label className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 text-xs cursor-pointer rounded transition shadow">
                                                ファイル選択
                                                <input type="file" accept="audio/*" className="hidden" onChange={handleScratchHitSoundUpload} onClick={(e) => { e.target.value = null; }} />
                                            </label>
                                            <span className="text-xs text-gray-300 truncate flex-1">{tempScratchSoundName || customScratchHitSound || "デフォルト音源"}</span>
                                            {(tempScratchSoundName || customScratchHitSound) && (
                                                <button onClick={handleScratchHitSoundReset} className="text-red-400 hover:text-red-300 px-2 py-1 text-xs rounded border border-red-900/50 bg-red-900/20 active:scale-95">リセット</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                                    ※ 変更は次回の再生開始時（または曲の停止時）に安全に適用されます。<br/>
                                    ※ 負荷防止のため、長さが 2.0秒 以上、または読み込めない形式のファイルは自動的にスキップされます。
                                </p>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
};

export default memo(SettingsModal);