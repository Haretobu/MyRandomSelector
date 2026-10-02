// src/bms/logic/greenNumber.js
// 白数字・緑数字と HI-SPEED の計算。
//   緑数字 = ノーツが画面に出てから判定ラインに届くまでの時間(ms)。レーンカバー(白数字)で隠れる分を除く。
//   譜面は「4拍 / HI-SPEED」ぶんを画面の高さに表示するので、1画面を流れる時間は 240000 / (BPM × HI-SPEED) ms。
//   白数字はレーンの高さを 1000 としたときの、レーンカバー(SUDDEN+ / LIFT)で隠れる量。
import { VISIBILITY_MODES } from '../constants';

/** レーンカバーの設定から白数字(0〜1000)を求める */
export function whiteNumber(visibilityMode, suddenPlus, lift) {
    let white = 0;
    if (visibilityMode === VISIBILITY_MODES.SUDDEN_PLUS || visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS) white += suddenPlus;
    if (visibilityMode === VISIBILITY_MODES.LIFT || visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) {
        white += lift;
        if (visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) white += suddenPlus;
    }
    return Math.min(1000, Math.max(0, white));
}

/** BPM と HI-SPEED と白数字から緑数字(ms)を求める */
export function greenNumber(bpm, hiSpeed, white) {
    return (240000 / ((bpm || 1) * (hiSpeed || 1))) * ((1000 - white) / 1000);
}

/** 緑数字を目標値にする HI-SPEED を求める(0.01 刻みに丸め、0.1 以上) */
export function hiSpeedForGreen(bpm, green, white) {
    const hs = (240000 * ((1000 - white) / 1000)) / ((bpm || 1) * (green || 300));
    return Math.max(0.1, Math.round(hs * 100) / 100);
}

/** 曲ごとの基準 BPM = 主 BPM(曲中で最も長く続く BPM) */
export const songBaseBpm = (song) => song?.bpmRange?.main || song?.header?.bpm || 130;
