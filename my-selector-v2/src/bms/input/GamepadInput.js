// src/bms/input/GamepadInput.js
// ゲームパッド(Gamepad API)の入力。物理コントローラを直接認識するので、Joy2Key 等のキーボード変換を
// 経由せず、スクラッチが押しっぱなしになってもブラウザのショートカットに干渉しない。
// Gamepad API にはイベント通知が無いため、毎フレーム poll() で状態を読み、前フレームとの差分から押下/離しを作る。
import { useEffect } from 'react';
import { isScratchLane } from './laneMaps';

export class GamepadInput {
    constructor() {
        this.index = null; // 使用する gamepad の index (navigator.getGamepads() 内)
        this.prev = {};    // ボタン番号 → 前フレームの押下状態
        // 軸番号 → { last: 前フレームの値, dir: '+'|'-'|null(現在有効な方向), t: 最後に動きを検知した時刻 }
        this.axes = {};
    }

    /**
     * 入力を有効にした瞬間に呼ぶ。既に押されている(皿を回している最中など)ボタンを「押されている」として記録しておく。
     * 空の状態から始めると、押しっぱなしのボタンを「新しく押された」と誤検知して勝手にレーンが反応してしまう。
     * 軸は状態をリセットするだけでよい(次のポーリングで現在値を基準として記録し直すので誤発火しない)。
     */
    snapshot() {
        if (navigator.getGamepads) {
            navigator.getGamepads().forEach(pad => {
                if (!pad) return;
                for (let i = 0; i < pad.buttons.length; i++) this.prev[i] = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
            });
        }
        this.axes = {};
    }

    /**
     * 1フレームぶん読む。
     * @param {number} now performance.now()
     * @param {{ lane: Object, dir: Object }} map buildLaneMap の結果(ボタン番号 / "a<軸番号><符号>" → レーン)
     * @param {number} axisDelta これ以上の変化があれば「回転中」とみなす
     * @param {number} axisReleaseMs この時間動きが無ければ「離した」とみなす
     * @param {(lane, isScratch, dir) => void} onDown
     * @param {(lane, dir) => void} onUp
     */
    poll(now, map, axisDelta, axisReleaseMs, onDown, onUp) {
        if (this.index == null || !navigator.getGamepads) return;
        const pad = navigator.getGamepads()[this.index];
        if (!pad) return;
        const { lane: laneMap, dir: dirMap } = map;
        const prev = this.prev;
        for (let bi = 0; bi < pad.buttons.length; bi++) {
            const pressed = pad.buttons[bi].pressed || pad.buttons[bi].value > 0.5;
            if (pressed !== !!prev[bi]) {
                const lane = laneMap[bi];
                if (lane !== undefined) {
                    if (pressed) onDown(lane, isScratchLane(lane), dirMap[bi]);
                    else onUp(lane, dirMap[bi]);
                }
                prev[bi] = pressed;
            }
        }
        // ★「Unknown Gamepad」等の非標準機種では、スクラッチがボタンではなく軸(axis)として来ることがある。
        //   ターンテーブルはバネで中央(0)に戻らない機種があり、絶対値のしきい値だけで press/release を決めると
        //   「静止位置が0でない」場合に押しっぱなしのまま戻らなくなる。そのためフレーム間で値が動いているかで判定する。
        //   (機種によって1フレームあたりの変化量が大きく異なるため、しきい値は設定画面で調整可能)
        for (let ai = 0; ai < pad.axes.length; ai++) {
            const v = pad.axes[ai];
            const st = this.axes[ai];
            if (!st) { this.axes[ai] = { last: v, dir: null, t: now }; continue; } // 初回は基準値の記録のみ
            const delta = v - st.last;
            st.last = v;
            if (Math.abs(delta) > axisDelta) {
                const d = delta > 0 ? '+' : '-';
                st.t = now;
                if (st.dir !== d) {
                    if (st.dir) { const l = laneMap[`a${ai}${st.dir}`]; if (l !== undefined) onUp(l, dirMap[`a${ai}${st.dir}`]); }
                    const lane = laneMap[`a${ai}${d}`];
                    if (lane !== undefined) onDown(lane, isScratchLane(lane), dirMap[`a${ai}${d}`]);
                    st.dir = d;
                }
            } else if (st.dir && (now - st.t) > axisReleaseMs) {
                const l = laneMap[`a${ai}${st.dir}`];
                if (l !== undefined) onUp(l, dirMap[`a${ai}${st.dir}`]);
                st.dir = null;
            }
        }
    }
}

/**
 * ゲームパッドの接続/切断を検知し、使う対象(先に繋がったもの)を input.index に設定する。表示名は onName で通知。
 */
export function useGamepadConnection(input, onName) {
    useEffect(() => {
        const pickFirst = () => {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (const p of pads) { if (p) return p; }
            return null;
        };
        const onConnect = (e) => { input.index = e.gamepad.index; onName(e.gamepad.id); };
        const onDisconnect = (e) => {
            if (input.index === e.gamepad.index) {
                const next = pickFirst();
                input.index = next ? next.index : null;
                onName(next ? next.id : null);
            }
        };
        window.addEventListener('gamepadconnected', onConnect);
        window.addEventListener('gamepaddisconnected', onDisconnect);
        const already = pickFirst(); // ページを開く前から繋がっていた場合
        if (already) { input.index = already.index; onName(already.id); }
        // ★フォールバック: 一部のUSB変換器/ドライバでは gamepadconnected イベントが確実に発火せず、
        //   ページ再読み込み後にボタンを押しても接続扱いにならないことがある。イベントだけに頼らず、
        //   1秒おきに navigator.getGamepads() を直接見て検知する(未接続→接続 の変化を拾う保険)。
        const pollId = setInterval(() => {
            if (input.index != null) return; // 既に何か繋がっていれば何もしない
            const p = pickFirst();
            if (p) { input.index = p.index; onName(p.id); }
        }, 1000);
        return () => {
            window.removeEventListener('gamepadconnected', onConnect);
            window.removeEventListener('gamepaddisconnected', onDisconnect);
            clearInterval(pollId);
        };
    }, [input, onName]);
}
