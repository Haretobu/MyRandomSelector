// src/bms/input/useLaneKeyboard.js
// キーボードのレーン入力(デバッグ用キー入力 / プレイモード時のみ有効)。
import { useEffect, useRef } from 'react';
import { isScratchLane } from './laneMaps';

/**
 * @param {boolean} active リスナーを張るか
 * @param {object} api 毎レンダー最新のものを渡す(内部で ref に入れるので、古いクロージャを掴まない)
 *   keys: { lane, dir }            buildLaneMap の結果(KeyboardEvent.code → レーン / 皿の方向)
 *   playMode: boolean
 *   onLaneDown(lane, isScratch, dir) / onLaneUp(lane, dir)
 *   onTogglePlay()                 プレイモード中の Space / Enter(誤爆防止の判定は呼び出し側)
 *   onLiveResult(show: boolean)    プレイモード中の Tab 押下/離し(成績オーバーレイ)
 *   onModifier(name: 'shift'|'ctrl', held: boolean)  皿の手動回転用フラグ
 *   onActivate()                   リスナーを張った直後(ゲームパッドの基準状態の記録など)
 */
export function useLaneKeyboard(active, api) {
    const apiRef = useRef(api);
    apiRef.current = api;
    useEffect(() => {
        if (!active) return;
        apiRef.current.onActivate?.();
        const handleKeyDown = (e) => {
            if (e.repeat) return;
            const a = apiRef.current;
            // プレイモード中: Space / Enter はブラウザ既定のボタン発火を止めて自前でトグル
            if (a.playMode && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); a.onTogglePlay(); return; }
            // Tab 押下中: 成績オーバーレイを表示(フォーカス移動は無効化)
            if (a.playMode && e.code === 'Tab') { e.preventDefault(); a.onLiveResult(true); return; }
            // 皿の手動回転用フラグ(Shift=逆回転 / Ctrl=高速)。
            // ★物理コントローラ対策: スクラッチが「押しっぱなし」になる機種だと、Shift/Ctrl が押されたまま
            //   別のレーンキーを叩いた瞬間にブラウザ/OSのショートカット(Ctrl+F 等)が暴発してしまう。
            //   ここで割り当て済みキーは必ず preventDefault し、ブラウザ側に既定動作をさせない。
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { a.onModifier('shift', true); e.preventDefault(); }
            else if (e.code === 'ControlLeft' || e.code === 'ControlRight') { a.onModifier('ctrl', true); e.preventDefault(); }
            const lane = a.keys.lane[e.code];
            if (lane !== undefined) {
                e.preventDefault();
                a.onLaneDown(lane, isScratchLane(lane), a.keys.dir[e.code]);
            }
        };
        const handleKeyUp = (e) => {
            const a = apiRef.current;
            if (a.playMode && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); return; }
            if (e.code === 'Tab') { a.onLiveResult(false); e.preventDefault(); return; }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') a.onModifier('shift', false);
            else if (e.code === 'ControlLeft' || e.code === 'ControlRight') a.onModifier('ctrl', false);
            const lane = a.keys.lane[e.code];
            if (lane === undefined) return;
            a.onLaneUp(lane, a.keys.dir[e.code]);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [active]);
}
