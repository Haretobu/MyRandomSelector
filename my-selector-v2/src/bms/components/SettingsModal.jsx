// src/bms/components/SettingsModal.jsx
import React, { memo, useState, useEffect, useRef } from 'react';
import { Settings, X, ChevronsUp, RotateCw, Film, Flag, Music, Layers, Speaker, EyeOff, FileX, Keyboard, FolderOpen, FileArchive, ChevronDown, Gamepad2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { VISIBILITY_MODES, LANE_LAYOUTS, MODE_LABELS, DEFAULT_KEYMAPS, DEFAULT_GAMEPAD_MAPS, DEFAULT_GAMEPAD_SCRATCH_ALT, DEFAULT_AUDIO_FX, keyCodeLabel } from '../constants';

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

// ゲームパッド(物理コントローラ)入力設定。Gamepad API でブラウザから直接認識する。
//   Joy2Key等でキーボードに変換すると、スクラッチが押しっぱなしの機種でブラウザのショートカットが
//   暴発してしまうため、それを避ける目的で追加。スクラッチは物理的に2ボタン(順/逆)想定。
function GamepadMapSection({ mode, gamepadEnabled, setGamepadEnabled, gamepadName, gamepadMaps, setGamepadMaps, gamepadScratchAlt, setGamepadScratchAlt }) {
    const km = DEFAULT_GAMEPAD_MAPS[mode] ? mode : 'SP7';
    const curMap = (gamepadMaps && gamepadMaps[km]) || DEFAULT_GAMEPAD_MAPS[km];
    const curAlt = (gamepadScratchAlt && gamepadScratchAlt[km]) || DEFAULT_GAMEPAD_SCRATCH_ALT;
    const laneList = LANE_LAYOUTS[km] || LANE_LAYOUTS.SP7;
    // listening: { lane, slot: 'main' | 'alt' } | null
    const [listening, setListening] = useState(null);

    useEffect(() => {
        if (!listening) return;
        let cancelled = false;
        let raf = null;
        const AXIS_ON = 0.5, AXIS_OFF = 0.25;
        const prevBtn = {};
        const prevAxisSign = {}; // key: `${pad.index}_${axisIndex}` -> -1|0|1 (ヒステリシス用)
        // ★重要: リスニング開始時点で既に押されている/倒れているボタン・軸を先に記録しておく。
        //   これをしないと、開始直後にたまたま押しっぱなし・倒れっぱなしの入力(皿など)を
        //   「新しく押された」と誤検知して即座に割り当ててしまい、意図した入力の前に
        //   別のものが割り当てられる不具合になっていた。
        (navigator.getGamepads ? navigator.getGamepads() : []).forEach(pad => {
            if (!pad) return;
            for (let i = 0; i < pad.buttons.length; i++) {
                prevBtn[`${pad.index}_${i}`] = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
            }
            for (let i = 0; i < pad.axes.length; i++) {
                const v = pad.axes[i];
                prevAxisSign[`${pad.index}_${i}`] = v > AXIS_ON ? 1 : (v < -AXIS_ON ? -1 : 0);
            }
        });
        const assign = (value) => {
            if (listening.slot === 'alt') {
                setGamepadScratchAlt(prev => ({ ...prev, [km]: { ...(prev[km] || DEFAULT_GAMEPAD_SCRATCH_ALT), [listening.lane]: value } }));
            } else {
                setGamepadMaps(prev => {
                    const next = { ...prev };
                    const m = { ...(next[km] || DEFAULT_GAMEPAD_MAPS[km]) };
                    // 既に他レーンが使っているボタン/軸なら解除(入れ替えではなく未割り当てに)
                    const dup = Object.keys(m).find(k => m[k] === value && Number(k) !== listening.lane);
                    if (dup != null) m[dup] = null;
                    m[listening.lane] = value;
                    next[km] = m;
                    return next;
                });
            }
            setListening(null);
        };
        const tick = () => {
            if (cancelled) return;
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (const pad of pads) {
                if (!pad) continue;
                for (let i = 0; i < pad.buttons.length; i++) {
                    const key = `${pad.index}_${i}`;
                    const pressed = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
                    if (pressed && !prevBtn[key]) { assign(i); return; }
                    prevBtn[key] = pressed;
                }
                // ★一部のコントローラ(特に「Unknown Gamepad」として認識される非標準機種)は、
                //   スクラッチのような2方向入力をボタンではなく「軸(axis)」として送ってくる。
                //   軸の正/負それぞれの方向を、別々の割り当て候補として拾えるようにする。
                for (let i = 0; i < pad.axes.length; i++) {
                    const key = `${pad.index}_${i}`;
                    const v = pad.axes[i];
                    const prevSign = prevAxisSign[key] || 0;
                    if (v > AXIS_ON && prevSign <= 0) { assign(`a${i}+`); return; }
                    if (v < -AXIS_ON && prevSign >= 0) { assign(`a${i}-`); return; }
                    if (Math.abs(v) < AXIS_OFF) prevAxisSign[key] = 0;
                }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { cancelled = true; if (raf) cancelAnimationFrame(raf); };
    }, [listening, km, setGamepadMaps, setGamepadScratchAlt]);

    const laneLabel = (lane) => {
        if (lane.kind === 'scratch') return lane.side === 1 ? '2P SC' : 'SC';
        if (km === 'PMS9') return `B${lane.index + 1}`;
        const n = lane.side === 0 ? lane.index : lane.index - 8;
        return `${lane.side === 1 ? '2P ' : ''}${n}`;
    };
    const btnLabel = (v) => {
        if (v === null || v === undefined) return '未設定';
        if (typeof v === 'string') {
            const m = v.match(/^a(\d+)([+-])$/);
            if (m) return `AXIS${m[1]}${m[2]}`;
        }
        return `#${v}`;
    };

    return (
        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Gamepad2 size={14} /> ゲームパッド入力（{MODE_LABELS[km] || km}）</span>
                <button
                    onClick={() => { setListening(null); setGamepadMaps(prev => ({ ...prev, [km]: { ...DEFAULT_GAMEPAD_MAPS[km] } })); setGamepadScratchAlt(prev => ({ ...prev, [km]: { ...DEFAULT_GAMEPAD_SCRATCH_ALT } })); }}
                    className="text-[10px] font-bold text-blue-300 hover:text-white flex items-center gap-1 bg-black/40 border border-blue-900/50 rounded px-2 py-1 transition">
                    <RotateCcw size={11} /> 全解除
                </button>
            </div>
            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30 mb-3">
                <span className="text-sm">物理コントローラを使う(Joy2Key不要)</span>
                <input type="checkbox" checked={gamepadEnabled} onChange={e => setGamepadEnabled(e.target.checked)} className="accent-blue-500 w-4 h-4" />
            </label>
            <div className="text-[11px] text-blue-500/70 mb-3">
                接続中: <span className={gamepadName ? 'text-blue-300 font-mono' : 'text-gray-500'}>{gamepadName || '未接続'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
                {laneList.map((lane, i, arr) => {
                    const brk = i > 0 && arr[i - 1].side !== lane.side;
                    if (lane.kind === 'scratch') {
                        const listeningMain = listening && listening.lane === lane.index && listening.slot === 'main';
                        const listeningAlt = listening && listening.lane === lane.index && listening.slot === 'alt';
                        return (
                            <React.Fragment key={lane.index}>
                                {brk && <div className="basis-full h-0" />}
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[8px] opacity-60 leading-none">{laneLabel(lane)}</span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setListening(listeningMain ? null : { lane: lane.index, slot: 'main' })}
                                            title="順回転"
                                            className={`w-[52px] rounded border px-1 py-1 transition-all flex flex-col items-center gap-0.5 ${listeningMain
                                                ? 'bg-orange-600 border-orange-400 text-white animate-pulse shadow-[0_0_10px_rgba(234,88,12,0.6)]'
                                                : 'bg-black/40 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-blue-500/40'}`}>
                                            <span className="text-[8px] opacity-60 leading-none">順</span>
                                            <span className="font-mono text-[11px] font-bold leading-none whitespace-nowrap">{listeningMain ? '…' : btnLabel(curMap[lane.index])}</span>
                                        </button>
                                        <button
                                            onClick={() => setListening(listeningAlt ? null : { lane: lane.index, slot: 'alt' })}
                                            title="逆回転"
                                            className={`w-[52px] rounded border px-1 py-1 transition-all flex flex-col items-center gap-0.5 ${listeningAlt
                                                ? 'bg-orange-600 border-orange-400 text-white animate-pulse shadow-[0_0_10px_rgba(234,88,12,0.6)]'
                                                : 'bg-black/40 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-blue-500/40'}`}>
                                            <span className="text-[8px] opacity-60 leading-none">逆</span>
                                            <span className="font-mono text-[11px] font-bold leading-none whitespace-nowrap">{listeningAlt ? '…' : btnLabel(curAlt[lane.index])}</span>
                                        </button>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    }
                    const listeningThis = listening && listening.lane === lane.index && listening.slot === 'main';
                    return (
                        <React.Fragment key={lane.index}>
                            {brk && <div className="basis-full h-0" />}
                            <button
                                onClick={() => setListening(listeningThis ? null : { lane: lane.index, slot: 'main' })}
                                className={`w-[52px] rounded border px-1 py-1 transition-all flex flex-col items-center gap-0.5 ${listeningThis
                                    ? 'bg-orange-600 border-orange-400 text-white animate-pulse shadow-[0_0_10px_rgba(234,88,12,0.6)]'
                                    : 'bg-black/40 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-blue-500/40'}`}>
                                <span className="text-[8px] opacity-60 leading-none">{laneLabel(lane)}</span>
                                <span className="font-mono text-[11px] font-bold leading-none whitespace-nowrap">{listeningThis ? '…' : btnLabel(curMap[lane.index])}</span>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
            <div className="text-[10px] text-blue-500/60 mt-2 leading-relaxed">
                ボタンを押してから物理コントローラを操作すると割り当てられます。スクラッチは「順」「逆」を別々に割り当ててください(2ボタン式のターンテーブル用)。ボタンではなく軸(AXIS)として来る機種でも、回した方向を検知して自動的に割り当てます。他のレーンと重複する入力は自動的に解除されます。<br />
                ※ ブラウザにコントローラを認識させるため、ページ内でいずれかのボタンを一度押してから使ってください(ブラウザの仕様)。
            </div>
        </div>
    );
}

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

// プレイモード設定ブロック(折りたたみ、有効化で自動展開)
function PlayModeSection({ playMode, setPlayMode, judgeOffset, setJudgeOffset, suggestJudgeOffset }) {
    const [open, setOpen] = useState(!!playMode);
    const prevRef = useRef(!!playMode);
    useEffect(() => {
        if (playMode && !prevRef.current) setOpen(true);
        prevRef.current = !!playMode;
    }, [playMode]);

    return (
        <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setOpen(o => !o)}
                    className="flex-1 flex items-center gap-2 text-xs text-blue-400 font-bold uppercase tracking-wider text-left">
                    <Gamepad2 size={14} /> <span>プレイモード</span>
                    <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <span className="text-[10px] text-blue-300">有効</span>
                    <input type="checkbox" checked={!!playMode} onChange={e => setPlayMode(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                </label>
            </div>
            {open && (
                <div className="pt-3 mt-1 border-t border-blue-900/30">
                    <div className="text-[10px] text-blue-500/60 leading-relaxed">
                        自分の入力で判定します（オートプレイ判定を止める）。キー割り当てで操作。判定・コンボ・EX SCORE・DJ LEVEL・FAST/SLOW を表示。完走でリザルト、途中は Tab 長押しで成績表示。<br />
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
    gamepadEnabled, setGamepadEnabled, gamepadName,
    gamepadMaps, setGamepadMaps, gamepadScratchAlt, setGamepadScratchAlt,
    playMode, setPlayMode,
    judgeOffset, setJudgeOffset, suggestJudgeOffset,
    audioFx, setAudioFx,
    missLayerEnabled, setMissLayerEnabled,
    bgaBehindChart, setBgaBehindChart,
    bgaSidePanel, setBgaSidePanel,
    bgaSidePos, setBgaSidePos,
    laneWidthPx, setLaneWidthPx,
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

                    {/* レーンミュート (共通・モード対応) */}
                    <div hidden={!showPlay} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
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
                    {!isMobile && showInput && (
                        <KeyMapSection mode={parsedSong?.mode || 'SP7'} keyMaps={keyMaps} setKeyMaps={setKeyMaps} />
                    )}

                    {/* ゲームパッド入力 (PC のみ・モード対応・物理コントローラ) */}
                    {!isMobile && showInput && (
                        <GamepadMapSection mode={parsedSong?.mode || 'SP7'}
                            gamepadEnabled={gamepadEnabled} setGamepadEnabled={setGamepadEnabled} gamepadName={gamepadName}
                            gamepadMaps={gamepadMaps} setGamepadMaps={setGamepadMaps}
                            gamepadScratchAlt={gamepadScratchAlt} setGamepadScratchAlt={setGamepadScratchAlt} />
                    )}

                    {/* PC用設定 (プレイサイド / レーンオプション) */}
                    <div className={`${showPlay ? 'flex' : 'hidden'} flex-col md:flex-row gap-4 items-start`}>
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

                    {/* プレイモード (PC のみ・6-2・折りたたみ) */}
                    {!isMobile && showPlay && (
                        <PlayModeSection playMode={playMode} setPlayMode={setPlayMode} judgeOffset={judgeOffset} setJudgeOffset={setJudgeOffset} suggestJudgeOffset={suggestJudgeOffset} />
                    )}

                    {/* サウンドエフェクト (共通・6-3) */}
                    <div hidden={!showSound}><AudioFxSection audioFx={audioFx} setAudioFx={setAudioFx} /></div>

                    {/* 詳細設定1 (システム・デバッグ) */}
                    <details hidden={!showSystem} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open={!isMobile}>
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

                    {/* 詳細設定2 (カスタム打鍵音設定) */}
                    <details hidden={!showSound} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open={!isMobile}>
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