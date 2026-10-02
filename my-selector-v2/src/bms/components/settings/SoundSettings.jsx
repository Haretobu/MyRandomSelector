// src/bms/components/settings/SoundSettings.jsx
// 設定画面の「音」タブ: サウンドエフェクト(SoundEffectSettings)と 詳細設定2 = カスタム打鍵音(HitSoundSettings)。
// ※ モバイルでは全タブを縦に並べるため、間にシステムタブを挟む並び順を保つよう2つに分けて書き出している。
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { DEFAULT_AUDIO_FX } from '../../constants';

// 6-3: サウンドエフェクト。子コンポーネントはモジュールスコープに置く
//   (レンダーごとに再生成すると <input range> がドラッグ中に作り直され、ホールド追従できなくなるため)。
const FxRow = ({ label, children }) => (
    <div className="flex items-center gap-2">
        <span className="text-[10px] text-blue-300 w-14 shrink-0">{label}</span>
        {children}
    </div>
);
const FxSlider = ({ min, max, step, value, onChange, fmt }) => (
    <>
        <input type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
        <span className="text-[10px] font-mono w-12 text-right">{fmt ? fmt(value) : value}</span>
    </>
);
const FxSubHead = ({ name, checked, disabled, onChange }) => (
    <label className="flex items-center justify-between cursor-pointer mt-2 mb-1">
        <span className="text-[11px] font-bold text-blue-200">{name}</span>
        <input type="checkbox" checked={checked} disabled={disabled}
            onChange={e => onChange(e.target.checked)} className="accent-orange-500 w-4 h-4" />
    </label>
);

function AudioFxSection({ audioFx, setAudioFx }) {
    const fx = audioFx || {};
    const patch = (k, v) => setAudioFx({ ...fx, [k]: { ...(fx[k] || {}), ...v } });
    const master = !!fx.enabled;

    // 折りたたみ: 既定は master の状態に合わせ、OFF→ON になった瞬間だけ自動展開する。
    const [open, setOpen] = useState(master);
    const prevMasterRef = useRef(master);
    useEffect(() => {
        if (master && !prevMasterRef.current) setOpen(true);
        prevMasterRef.current = master;
    }, [master]);

    return (
        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center justify-between gap-2">
                <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 hover:text-white transition text-left">
                    <SlidersHorizontal size={14} /> <span>サウンドエフェクト</span>
                    <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <button
                    onClick={() => setAudioFx(JSON.parse(JSON.stringify(DEFAULT_AUDIO_FX)))}
                    className="text-[10px] font-bold text-blue-300 hover:text-white flex items-center gap-1 bg-black/40 border border-blue-900/50 rounded px-2 py-1 transition">
                    <RotateCcw size={11} /> リセット
                </button>
            </div>
            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30">
                <span className="text-sm">エフェクトを有効にする（EQ / ECHO / COMP / FILTER）</span>
                <input type="checkbox" checked={master} onChange={e => setAudioFx({ ...fx, enabled: e.target.checked })} className="accent-blue-500 w-4 h-4" />
            </label>

            {open && (
            <div className={`mt-2 space-y-1 ${master ? '' : 'opacity-40 pointer-events-none'}`}>
                {/* FILTER */}
                <FxSubHead name="FILTER" checked={!!fx.filter?.on} disabled={!master} onChange={v => patch('filter', { on: v })} />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    <FxRow label="種類">
                        <div className="flex gap-1 flex-1">
                            {['lowpass', 'highpass'].map(t => (
                                <button key={t} onClick={() => patch('filter', { type: t })}
                                    className={`flex-1 text-[10px] font-bold py-1 rounded border transition ${fx.filter?.type === t
                                        ? 'bg-orange-600 border-orange-400 text-white' : 'bg-black/40 border-gray-700 text-gray-400'}`}>
                                    {t === 'lowpass' ? 'LOW-PASS' : 'HIGH-PASS'}
                                </button>
                            ))}
                        </div>
                    </FxRow>
                    <FxRow label="周波数">
                        <FxSlider min={40} max={18000} step={10} value={fx.filter?.freq ?? 12000}
                            onChange={v => patch('filter', { freq: v })} fmt={v => `${(v / 1000).toFixed(1)}k`} />
                    </FxRow>
                </div>

                {/* EQ */}
                <FxSubHead name="EQ (3BAND)" checked={!!fx.eq?.on} disabled={!master} onChange={v => patch('eq', { on: v })} />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    {[['low', 'LOW'], ['mid', 'MID'], ['high', 'HIGH']].map(([k, lbl]) => (
                        <FxRow key={k} label={lbl}>
                            <FxSlider min={-18} max={18} step={1} value={fx.eq?.[k] ?? 0}
                                onChange={v => patch('eq', { [k]: v })} fmt={v => `${v > 0 ? '+' : ''}${v}dB`} />
                        </FxRow>
                    ))}
                </div>

                {/* COMP */}
                <FxSubHead name="COMPRESSOR" checked={!!fx.comp?.on} disabled={!master} onChange={v => patch('comp', { on: v })} />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    <FxRow label="Thresh">
                        <FxSlider min={-60} max={0} step={1} value={fx.comp?.threshold ?? -24}
                            onChange={v => patch('comp', { threshold: v })} fmt={v => `${v}dB`} />
                    </FxRow>
                    <FxRow label="Ratio">
                        <FxSlider min={1} max={20} step={0.5} value={fx.comp?.ratio ?? 4}
                            onChange={v => patch('comp', { ratio: v })} fmt={v => `${v}:1`} />
                    </FxRow>
                </div>

                {/* ECHO */}
                <FxSubHead name="ECHO (DELAY)" checked={!!fx.echo?.on} disabled={!master} onChange={v => patch('echo', { on: v })} />
                <div className="bg-black/20 p-2 rounded space-y-1.5">
                    <FxRow label="Time">
                        <FxSlider min={0.05} max={1.2} step={0.01} value={fx.echo?.time ?? 0.3}
                            onChange={v => patch('echo', { time: v })} fmt={v => `${Math.round(v * 1000)}ms`} />
                    </FxRow>
                    <FxRow label="Feedback">
                        <FxSlider min={0} max={0.9} step={0.01} value={fx.echo?.feedback ?? 0.35}
                            onChange={v => patch('echo', { feedback: v })} fmt={v => `${Math.round(v * 100)}%`} />
                    </FxRow>
                    <FxRow label="Mix">
                        <FxSlider min={0} max={1} step={0.01} value={fx.echo?.mix ?? 0.25}
                            onChange={v => patch('echo', { mix: v })} fmt={v => `${Math.round(v * 100)}%`} />
                    </FxRow>
                </div>
            </div>
            )}
            <div className="text-[10px] text-blue-500/60 mt-2 leading-relaxed">
                キー音・BGM・打鍵音すべてに掛かります。設定は自動保存されます。
            </div>
        </div>
    );
}

// 折りたたみ可能な設定ブロック。親トグルが OFF→ON になった瞬間だけ自動展開する。
//   (OFF に戻しても閉じない。手動で開閉した状態はそのまま尊重する)

/**
 * @param {boolean} hidden タブが選ばれていないとき true(要素は残したまま隠す)
 * @param {object} sound BmsViewer の音設定一式
 *   { audioFx, setAudioFx, hitSoundVolume, setHitSoundVolume, isSeparateHitSound, setIsSeparateHitSound,
 *     handleKeyHitSoundUpload, handleKeyHitSoundReset, handleScratchHitSoundUpload, handleScratchHitSoundReset,
 *     tempKeySoundName, tempScratchSoundName, customKeyHitSound, customScratchHitSound }
 */
export function SoundEffectSettings({ hidden, sound }) {
    return <div hidden={hidden}><AudioFxSection audioFx={sound.audioFx} setAudioFx={sound.setAudioFx} /></div>;
}

export function HitSoundSettings({ hidden, isMobile, sound }) {
    return (
        // 詳細設定2 (カスタム打鍵音設定)
        <details hidden={hidden} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open={!isMobile}>
            <summary className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer list-none">
                <span>詳細設定2 (カスタム打鍵音)</span>
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 pt-2">
                
                {/* 音量などの基本設定 */}
                <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                    <span className="text-sm text-blue-300">打鍵音の音量</span>
                    <input type="range" min="0" max="2" step="0.1" value={sound.hitSoundVolume} onChange={e => sound.setHitSoundVolume(parseFloat(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                </div>

                <div className="border-t border-blue-900/30 my-2"></div>

                {/* カスタム音源アップロードエリア */}
                <div className="bg-black/20 p-3 rounded space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-200">打鍵音ファイルの変更</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-gray-400">通常とスクラッチを分ける</span>
                            <input type="checkbox" checked={sound.isSeparateHitSound} onChange={e => sound.setIsSeparateHitSound(e.target.checked)} className="accent-blue-500" />
                        </label>
                    </div>

                    {/* 通常ノーツ（または共通）用 */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400">{sound.isSeparateHitSound ? "通常ノーツ用 (WAV/OGG等)" : "共通打鍵音 (WAV/OGG等)"}</span>
                        <div className="flex items-center gap-2">
                            <label className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs cursor-pointer rounded transition shadow">
                                ファイル選択
                                <input type="file" accept="audio/*" className="hidden" onChange={sound.handleKeyHitSoundUpload} onClick={(e) => { e.target.value = null; }} />
                            </label>
                            <span className="text-xs text-gray-300 truncate flex-1">{sound.tempKeySoundName || sound.customKeyHitSound || "デフォルト音源"}</span>
                            {(sound.tempKeySoundName || sound.customKeyHitSound) && (
                                <button onClick={sound.handleKeyHitSoundReset} className="text-red-400 hover:text-red-300 px-2 py-1 text-xs rounded border border-red-900/50 bg-red-900/20 active:scale-95">リセット</button>
                            )}
                        </div>
                    </div>

                    {/* スクラッチ用 (チェックを入れた時だけ表示) */}
                    {sound.isSeparateHitSound && (
                        <div className="flex flex-col gap-1 pt-1">
                            <span className="text-xs text-gray-400">スクラッチ用 (WAV/OGG等)</span>
                            <div className="flex items-center gap-2">
                                <label className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 text-xs cursor-pointer rounded transition shadow">
                                    ファイル選択
                                    <input type="file" accept="audio/*" className="hidden" onChange={sound.handleScratchHitSoundUpload} onClick={(e) => { e.target.value = null; }} />
                                </label>
                                <span className="text-xs text-gray-300 truncate flex-1">{sound.tempScratchSoundName || sound.customScratchHitSound || "デフォルト音源"}</span>
                                {(sound.tempScratchSoundName || sound.customScratchHitSound) && (
                                    <button onClick={sound.handleScratchHitSoundReset} className="text-red-400 hover:text-red-300 px-2 py-1 text-xs rounded border border-red-900/50 bg-red-900/20 active:scale-95">リセット</button>
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
    );
}
