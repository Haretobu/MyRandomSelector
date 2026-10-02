// src/bms/components/settings/InputSettings.jsx
// 設定画面の「入力」タブ: キー割り当て(KeyMapSection)とゲームパッド(GamepadMapSection)。
import React, { useState, useEffect } from 'react';
import { Keyboard, Gamepad2, RotateCcw } from 'lucide-react';
import { LANE_LAYOUTS, MODE_LABELS, DEFAULT_KEYMAPS, DEFAULT_GAMEPAD_MAPS, DEFAULT_GAMEPAD_SCRATCH_ALT, keyCodeLabel } from '../../constants';

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

// 生データモニター: ボタン/軸の現在値をリアルタイム表示(トラブルシューティング用)。
// 表示中だけ rAF で毎フレーム読み続けるので、通常は非表示にしておく。
function GamepadLiveMonitor() {
    const [snap, setSnap] = useState(null);
    useEffect(() => {
        let raf = null;
        const tick = () => {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const pad = pads.find(p => p);
            setSnap(pad ? { buttons: pad.buttons.map(b => b.pressed || b.value > 0.5), axes: pad.axes.map(v => v) } : null);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { if (raf) cancelAnimationFrame(raf); };
    }, []);
    if (!snap) return <div className="text-[10px] text-gray-500 mt-2">未接続、または反応なし</div>;
    return (
        <div className="text-[9px] font-mono text-blue-200/80 space-y-1.5 mt-2 bg-black/30 rounded p-2">
            <div>
                <span className="text-blue-500/70">BUTTONS: </span>
                {snap.buttons.map((p, i) => (
                    <span key={i} className={`inline-block px-1 mr-0.5 mb-0.5 rounded ${p ? 'bg-orange-600 text-white' : 'bg-black/40 text-gray-500'}`}>{i}</span>
                ))}
            </div>
            <div>
                <span className="text-blue-500/70">AXES: </span>
                {snap.axes.map((v, i) => (
                    <span key={i} className={`inline-block px-1 mr-1.5 mb-0.5 rounded ${Math.abs(v) > 0.5 ? 'text-orange-300' : 'text-gray-400'}`}>A{i}:{v.toFixed(3)}</span>
                ))}
            </div>
        </div>
    );
}

// ゲームパッド(物理コントローラ)入力設定。Gamepad API でブラウザから直接認識する。
//   Joy2Key等でキーボードに変換すると、スクラッチが押しっぱなしの機種でブラウザのショートカットが
//   暴発してしまうため、それを避ける目的で追加。スクラッチは物理的に2ボタン(順/逆)想定。
function GamepadMapSection({ mode, gamepadEnabled, setGamepadEnabled, gamepadName, gamepadMaps, setGamepadMaps, gamepadScratchAlt, setGamepadScratchAlt,
    gamepadAxisDelta, setGamepadAxisDelta, gamepadAxisReleaseMs, setGamepadAxisReleaseMs }) {
    const km = DEFAULT_GAMEPAD_MAPS[mode] ? mode : 'SP7';
    const curMap = (gamepadMaps && gamepadMaps[km]) || DEFAULT_GAMEPAD_MAPS[km];
    const curAlt = (gamepadScratchAlt && gamepadScratchAlt[km]) || DEFAULT_GAMEPAD_SCRATCH_ALT;
    const laneList = LANE_LAYOUTS[km] || LANE_LAYOUTS.SP7;
    // listening: { lane, slot: 'main' | 'alt' } | null
    const [listening, setListening] = useState(null);
    const [showRaw, setShowRaw] = useState(false);

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
            <div className="text-[11px] text-blue-500/70 mb-3 flex items-center justify-between">
                <span>接続中: <span className={gamepadName ? 'text-blue-300 font-mono' : 'text-gray-500'}>{gamepadName || '未接続'}</span></span>
                <button onClick={() => setShowRaw(v => !v)} className="text-[10px] font-bold text-blue-300 hover:text-white bg-black/40 border border-blue-900/50 rounded px-2 py-0.5 transition">
                    {showRaw ? '生データを隠す' : '生データを表示'}
                </button>
            </div>
            {showRaw && <GamepadLiveMonitor />}
            <div className="bg-black/20 rounded p-2 mb-3 mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-blue-300">スクラッチ(軸)の感度</span>
                    <span className="font-mono">{gamepadAxisDelta}</span>
                </div>
                <input type="range" min={0.0005} max={0.05} step={0.0005} value={gamepadAxisDelta}
                    onChange={e => setGamepadAxisDelta(Number(e.target.value))}
                    className="w-full accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-blue-300">スクラッチ(軸)を離すまでの時間</span>
                    <span className="font-mono">{gamepadAxisReleaseMs}ms</span>
                </div>
                <input type="range" min={20} max={300} step={5} value={gamepadAxisReleaseMs}
                    onChange={e => setGamepadAxisReleaseMs(Number(e.target.value))}
                    className="w-full accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                <p className="text-[10px] text-gray-500 leading-relaxed">
                    スクラッチがボタンではなく軸(AXIS)として来る機種向けの調整です(ボタン式のスクラッチには影響しません)。
                    全く反応しない場合は感度の数値を下げて、逆に触っていないのに押しっぱなしになる場合は数値を上げてください。
                </p>
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

/**
 * 入力タブ全体。
 * @param {string} mode 譜面の鍵盤モード(SP7 等)
 * @param {object} input BmsViewer の入力設定一式
 *   { keyMaps, setKeyMaps, gamepadEnabled, setGamepadEnabled, gamepadName, gamepadMaps, setGamepadMaps,
 *     gamepadScratchAlt, setGamepadScratchAlt, gamepadAxisDelta, setGamepadAxisDelta, gamepadAxisReleaseMs, setGamepadAxisReleaseMs }
 */
export default function InputSettings({ mode, input }) {
    return (
        <>
            {/* キー割り当て (モード対応) */}
            <KeyMapSection mode={mode} keyMaps={input.keyMaps} setKeyMaps={input.setKeyMaps} />
            {/* ゲームパッド入力 (モード対応・物理コントローラ) */}
            <GamepadMapSection mode={mode}
                gamepadEnabled={input.gamepadEnabled} setGamepadEnabled={input.setGamepadEnabled} gamepadName={input.gamepadName}
                gamepadMaps={input.gamepadMaps} setGamepadMaps={input.setGamepadMaps}
                gamepadScratchAlt={input.gamepadScratchAlt} setGamepadScratchAlt={input.setGamepadScratchAlt}
                gamepadAxisDelta={input.gamepadAxisDelta} setGamepadAxisDelta={input.setGamepadAxisDelta}
                gamepadAxisReleaseMs={input.gamepadAxisReleaseMs} setGamepadAxisReleaseMs={input.setGamepadAxisReleaseMs} />
        </>
    );
}
