// src/bms/components/SettingsModal.jsx
import React, { memo, useState } from 'react';
import { Settings, X, FolderOpen, FileArchive } from 'lucide-react';
import ViewSettings from './settings/ViewSettings';
import InputSettings from './settings/InputSettings';
import SystemSettings from './settings/SystemSettings';
import { SoundEffectSettings, HitSoundSettings } from './settings/SoundSettings';
import PlaySettings from './settings/PlaySettings';

const SettingsModal = ({
    showSettings, setShowSettings, isMobile,
    view,   // 表示タブ(表示・BGA / レーンカバー / オートHI-SPEED)の設定一式。ViewSettings.jsx を参照
    play,   // プレイタブ(レーンミュート / オプション / プレイモード)の設定一式。PlaySettings.jsx を参照
    input,  // 入力タブ(キー割り当て / ゲームパッド)の設定一式。InputSettings.jsx を参照
    sound,  // 音タブ(サウンドエフェクト / 打鍵音)の設定一式。SoundSettings.jsx を参照
    system, // システムタブ(lite モード / 詳細設定1)の設定一式。SystemSettings.jsx を参照
    // スマホ用のファイル読込・基本設定(タブなしの1画面表示の先頭)
    handleFileSelect, handleZipSelect, bmsList, selectedBmsIndex, setSelectedBmsIndex,
    hiSpeed, setHiSpeed, volume, setVolume,
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

                    {/* 表示タブ: 表示・BGA設定 / レーンカバー / オートHI-SPEED */}
                    <ViewSettings hidden={!showView} isMobile={isMobile} view={view} />

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