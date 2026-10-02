// src/bms/render/laneLayout.js
// レーン(盤面)の並び・幅・色の計算。描画ループとキャンバス幅の算出で共用する。
import { LANE_LAYOUTS } from '../constants';

export const MAX_LANES = 16;            // 0=1P皿,1-7=1P鍵 / 8=2P皿,9-15=2P鍵 (PMS は 0-8)
const SIDE_GAP_UNITS = 0.7;             // DP の 1P/2P 間の隙間 (KEY_W 単位)
const LANE_GAP_UNITS = 0.05;
const SCRATCH_UNITS = 1.5;
export const DEFAULT_LANES = LANE_LAYOUTS.SP7;

/** 画面に並べる順のレーン配列。SP の 2P 側は鍵を左→右のまま、皿だけ右端へ。 */
export function displayLanes(parsedSong, is2P) {
    const lanes = parsedSong?.lanes || DEFAULT_LANES;
    const mode = parsedSong?.mode || 'SP7';
    if (is2P && (mode === 'SP7' || mode === 'SP5')) {
        const keys = lanes.filter(l => l.kind === 'key');
        const scr = lanes.find(l => l.kind === 'scratch');
        return scr ? [...keys, scr] : keys;
    }
    return lanes;
}

/** 盤面の「レーン単位数」(皿=1.5, 鍵=1.0, 隙間を加算) */
export function laneUnits(lanes) {
    let u = 0;
    for (let i = 0; i < lanes.length; i++) {
        if (i > 0) u += (lanes[i].side !== lanes[i - 1].side ? SIDE_GAP_UNITS : LANE_GAP_UNITS);
        u += (lanes[i].kind === 'scratch' ? SCRATCH_UNITS : 1.0);
    }
    return u;
}

/** キャンバス幅 = 盤面単位数 × レーン幅px + 余白、でモード別に盤面ぴったりのサイズを出すための単位数 */
export const boardUnitsFor = (parsedSong, is2P) => laneUnits(displayLanes(parsedSong, is2P));

/**
 * 幅 width の中にレーンを配置する。laneX[index] / laneW[index] に盤面内の左端X・幅を書き込む(配列は再利用)。
 * @returns {{ keyW: number, boardW: number, boardX: number }}
 */
export function layoutLanes(lanes, width, laneX, laneW) {
    const keyW = Math.max(7, Math.min(72, (width - 24) / laneUnits(lanes)));
    laneW.fill(0);
    let cx = 0;
    for (let i = 0; i < lanes.length; i++) {
        if (i > 0) cx += keyW * (lanes[i].side !== lanes[i - 1].side ? SIDE_GAP_UNITS : LANE_GAP_UNITS);
        const w = keyW * (lanes[i].kind === 'scratch' ? SCRATCH_UNITS : 1.0);
        laneX[lanes[i].index] = cx; laneW[lanes[i].index] = w;
        cx += w;
    }
    return { keyW, boardW: cx, boardX: (width - cx) / 2 };
}

// レーンの見た目の色。lane = { index, kind, side }
const laneKeyNum = (lane) => (lane.side === 0 ? lane.index : lane.index - 8); // 1..7
export function laneNoteColor(lane, pmsColors) {
    if (pmsColors) return pmsColors[lane.index] || '#f1f5f9';
    if (lane.kind === 'scratch') return '#ef4444';
    return (laneKeyNum(lane) % 2 === 0) ? '#3b82f6' : '#f1f5f9';
}
export function laneBgColor(lane, lOpacity, isMobile, pms) {
    if (pms) return isMobile ? `rgba(20, 20, 28, ${lOpacity})` : '#12121c';
    if (lane.kind === 'scratch') return isMobile ? `rgba(15, 23, 42, ${lOpacity})` : '#0f172a';
    const dark = laneKeyNum(lane) % 2 === 0;
    return dark ? `rgba(15, 23, 42, ${lOpacity})` : `rgba(30, 41, 59, ${lOpacity})`;
}
