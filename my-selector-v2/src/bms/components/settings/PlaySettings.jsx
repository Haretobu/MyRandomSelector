// src/bms/components/settings/PlaySettings.jsx
// 設定画面の「プレイ」タブ: レーンミュート / プレイサイド・レーンオプション / プレイモード(判定方式・オフセット)。
import React, { useState, useEffect, useRef } from 'react';
import { Speaker, RotateCw, Gamepad2, ChevronDown } from 'lucide-react';

// プレイモード設定ブロック(折りたたみ、有効化で自動展開)
function PlayModeSection({ playMode, setPlayMode, judgeOffset, setJudgeOffset, suggestJudgeOffset, judgeSystem, setJudgeSystem, judgeCfg }) {
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
                        皿は割り当てキー（既定 Shift）と Ctrl の2キー。LN は鍵盤・皿とも押し続けて終点で離す（beatoraja の LN モード準拠・1本 = 1ノーツ）。皿 LN は最初に押した方のキーを押し続ける。<br />
                        ※「デバッグ用キー入力」とは別機能です（併用可）。
                    </div>

                    {/* 判定方式 (BMS = beatoraja 準拠 / IIDX) */}
                    <div className="mt-3 pt-3 border-t border-blue-900/30">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-bold text-blue-300">判定方式</span>
                            <div className="flex gap-1">
                                {[['BMS', 'BMS (beatoraja)'], ['IIDX', 'IIDX']].map(([id, label]) => (
                                    <button key={id} onClick={() => setJudgeSystem(id)}
                                        className={`text-[10px] font-bold px-2 py-1 rounded border transition ${judgeSystem === id
                                            ? 'bg-blue-600/40 border-blue-400 text-white'
                                            : 'bg-black/40 border-blue-900/50 text-blue-300 hover:text-white'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="text-[10px] text-blue-500/60 leading-relaxed mb-1.5">
                            {judgeSystem === 'IIDX'
                                ? 'beatmania IIDX 相当の固定幅（#RANK は無視）。BAD は公式値が無いため推定値です。'
                                : 'beatoraja と同じ計算。譜面の #RANK / #DEFEXRANK で判定幅が変わります（未指定は NORMAL）。'}
                        </div>
                        {judgeCfg && (
                            <div className="bg-black/30 rounded p-2 font-mono text-[10px] text-blue-200 grid grid-cols-[52px_repeat(4,1fr)] gap-x-2 gap-y-0.5">
                                <span className="text-blue-500/70">{judgeCfg.system === 'BMS' ? `${Math.round(judgeCfg.rate)}%` : ''}</span>
                                <span className="text-[#22d3ee]">PG</span><span className="text-[#fde047]">GR</span><span className="text-[#4ade80]">GD</span><span className="text-[#fb923c]">BD</span>
                                {[['鍵盤', judgeCfg.note], ['皿', judgeCfg.scratch]].map(([lbl, w]) => (
                                    <React.Fragment key={lbl}>
                                        <span className="text-blue-400/80">{lbl}</span>
                                        <span>±{+w.pg.toFixed(1)}</span><span>±{+w.gr.toFixed(1)}</span><span>±{+w.gd.toFixed(1)}</span>
                                        <span>{w.bdEarly === w.bdLate ? `±${+w.bdEarly.toFixed(1)}` : `-${+w.bdEarly.toFixed(0)}/+${+w.bdLate.toFixed(0)}`}</span>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                        <div className="text-[9px] text-blue-500/50 mt-1">単位 ms。BD は 早(-) / 遅(+)。読み込み中の譜面の値です。</div>
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

/**
 * プレイタブ全体。
 * @param {boolean} hidden タブが選ばれていないとき true
 * @param {boolean} isMobile
 * @param {object|null} song 読み込み中の譜面(parseBMS の結果)
 * @param {object} play BmsViewer のプレイ設定一式
 *   { laneMute, playSide, playOption, playOption2, dpFlip, playMode, judgeOffset, judgeSystem } とそれぞれの setXxx、
 *   currentLaneOrder / laneOrder2(表示用の配置)、refreshRandom、suggestJudgeOffset、judgeCfg(読み込み中の譜面の判定幅)
 */
export default function PlaySettings({ hidden, isMobile, song, play }) {
    return (
        <>
        {/* レーンミュート (共通・モード対応) */}
        <div hidden={hidden} className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50">
            <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                <Speaker size={14} /> レーンミュート
            </div>
            <div className="flex gap-1 justify-center flex-wrap">
                {(song?.lanes || [{index:0,kind:'scratch',side:0},{index:1,kind:'key',side:0},{index:2,kind:'key',side:0},{index:3,kind:'key',side:0},{index:4,kind:'key',side:0},{index:5,kind:'key',side:0},{index:6,kind:'key',side:0},{index:7,kind:'key',side:0}]).map((lane, i, arr) => {
                    const lbl = lane.kind === 'scratch' ? 'SC'
                        : song?.mode === 'PMS9' ? String(lane.index + 1)
                        : String(lane.side === 0 ? lane.index : lane.index - 8);
                    const brk = i > 0 && arr[i - 1].side !== lane.side;
                    const muted = play.laneMute && play.laneMute[lane.index];
                    return (
                        <React.Fragment key={lane.index}>
                            {brk && <div className="basis-full h-0" />}
                            <button
                                onClick={() => play.setLaneMute((play.laneMute || new Array(16).fill(false)).map((v, idx) => idx === lane.index ? !v : v))}
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

        {/* PC用設定 (プレイサイド / レーンオプション) */}
        <div className={`${!hidden ? 'flex' : 'hidden'} flex-col md:flex-row gap-4 items-start`}>
             {(() => {
                 const sideLocked = song && song.mode !== 'SP7' && song.mode !== 'SP5';
                 return (
                     <div className={`w-full md:flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex justify-between items-center ${sideLocked ? 'opacity-40' : ''}`}>
                         <span className="font-bold text-sm text-blue-300">プレイサイド</span>
                         <button
                             disabled={sideLocked}
                             onClick={() => play.setPlaySide(p => p === '1P' ? '2P' : '1P')}
                             className="bg-blue-600/20 border border-blue-500/50 px-6 py-1 text-blue-100 hover:bg-blue-600/40 disabled:cursor-not-allowed transition rounded w-32 font-mono">
                             {sideLocked ? '—' : play.playSide}
                         </button>
                     </div>
                 );
             })()}
             {(() => {
                 const mode = song?.mode || 'SP7';
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
                 const t1 = play.playOption !== 'OFF' ? orderText(play.currentLaneOrder, isPms ? 0 : 1) : null;
                 const t2 = (isDP && play.playOption2 !== 'OFF') ? orderText(play.laneOrder2, 9) : null;
                 return (
                     <div className="w-full md:flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex flex-col gap-2 relative">
                         <div className="flex justify-between items-center">
                             <span className="font-bold text-sm text-blue-300">レーンオプション</span>
                             <button onClick={play.refreshRandom} title="RANDOM を振り直す" className="bg-blue-600/20 border border-blue-500/50 p-1 text-blue-300 hover:text-white hover:bg-blue-600/40 active:scale-95 transition rounded"><RotateCw size={18} /></button>
                         </div>

                         {isDP ? (
                             <>
                                 <div className="flex items-center gap-2">
                                     <span className="text-[11px] text-blue-400 w-8 shrink-0 font-bold">1P</span>
                                     <OptSelect value={play.playOption} onChange={play.setPlayOption} />
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <span className="text-[11px] text-blue-400 w-8 shrink-0 font-bold">2P</span>
                                     <OptSelect value={play.playOption2} onChange={play.setPlayOption2} />
                                 </div>
                                 <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer border border-transparent hover:border-blue-500/30 mt-1">
                                     <span className="text-[12px] text-blue-200">FLIP（1P ⇄ 2P 入れ替え）</span>
                                     <input type="checkbox" checked={play.dpFlip} onChange={e => play.setDpFlip(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                                 </label>
                             </>
                         ) : (
                             <OptSelect value={play.playOption} onChange={play.setPlayOption} />
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
        {!isMobile && !hidden && (
            <PlayModeSection playMode={play.playMode} setPlayMode={play.setPlayMode} judgeOffset={play.judgeOffset} setJudgeOffset={play.setJudgeOffset} suggestJudgeOffset={play.suggestJudgeOffset}
                judgeSystem={play.judgeSystem} setJudgeSystem={play.setJudgeSystem} judgeCfg={play.judgeCfg} />
        )}
        </>
    );
}
