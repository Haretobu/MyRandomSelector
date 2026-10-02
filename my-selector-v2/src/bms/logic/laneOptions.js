// src/bms/logic/laneOptions.js
// レーンオプション(OFF / MIRROR / RANDOM / R-RANDOM / S-RANDOM / DP の FLIP)の適用。
import { shuffleLanes } from './utils';
import { LANE_LAYOUTS } from '../constants';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 譜面のオブジェクトにオプションを適用した新しい配列を返す(元の配列は変更しない。processed は false に戻す)。
 * @param {object[]} objects 譜面オブジェクト
 * @param {{ mode?: string, lanes?: object[] }} song parseBMS の結果(mode / lanes を使う)
 * @param {string} opt1 1P / 左サイド(9K は全体)のオプション
 * @param {string} opt2 2P / 右サイドのオプション(DP のみ)
 * @param {boolean} flip 左右サイドの入れ替え(DP のみ)
 * @returns {{ objects: object[], order1: number[]|'S', order2: number[]|'S'|null }}
 *   order1/order2 は表示用の配置(S-RANDOM は 'S')
 */
export function applyLaneOptions(objects, song, opt1, opt2 = 'OFF', flip = false) {
    const mode = song?.mode || 'SP7';
    const lanes = song?.lanes || LANE_LAYOUTS.SP7;

    // --- 9K (pop'n): 皿なし・9ボタン(index 0-8)全体に opt1 を適用 (OFF/MIRROR/RANDOM/S-RANDOM) ---
    if (mode === 'PMS9') {
        const idx = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        const map = shuffleLanes(idx, opt1);
        return {
            order1: opt1 === 'S-RANDOM' ? 'S' : idx.map(i => map[i]),
            order2: null,
            objects: objects.map(o => ({
                ...o, processed: false,
                laneIndex: o.isNote
                    ? (opt1 === 'S-RANDOM' ? rand(idx) : (map[o.laneIndex] ?? o.laneIndex))
                    : o.laneIndex,
            })),
        };
    }

    // --- SP / DP ---
    const keys1 = lanes.filter(l => l.kind === 'key' && l.side === 0).map(l => l.index).sort((a, b) => a - b);
    const keys2 = lanes.filter(l => l.kind === 'key' && l.side === 1).map(l => l.index).sort((a, b) => a - b);
    const isDP = keys2.length > 0;
    const map1 = shuffleLanes(keys1, opt1);
    const map2 = isDP ? shuffleLanes(keys2, opt2) : {};
    const doFlip = isDP && flip;

    return {
        order1: opt1 === 'S-RANDOM' ? 'S' : keys1.map(i => map1[i]),
        order2: isDP ? (opt2 === 'S-RANDOM' ? 'S' : keys2.map(i => map2[i])) : null,
        objects: objects.map(o => {
            if (!o.isNote) return { ...o, processed: false };
            let li = o.laneIndex;
            // FLIP: サイド全体(鍵+皿)を入れ替えてから、そのサイドのオプションを適用
            if (doFlip) {
                if (li === 0) li = 8;
                else if (li === 8) li = 0;
                else if (li >= 1 && li <= 7) li += 8;
                else if (li >= 9 && li <= 15) li -= 8;
            }
            if (li >= 1 && li <= 7) li = (opt1 === 'S-RANDOM') ? rand(keys1) : (map1[li] ?? li);
            else if (li >= 9 && li <= 15) li = (opt2 === 'S-RANDOM') ? rand(keys2) : (map2[li] ?? li);
            return { ...o, processed: false, laneIndex: li };
        }),
    };
}
