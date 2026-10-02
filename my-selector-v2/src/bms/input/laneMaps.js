// src/bms/input/laneMaps.js
// 入力(キー / ゲームパッドのボタン)→ レーンの逆引き表を作る。

/**
 * @param {Object<number, string|number|null>} map  レーン index → 入力キー(KeyboardEvent.code / ボタン番号 / 軸キー)
 * @param {Object<number, string|number|null>} alt  皿のもう一方向のキー(レーン index → キー)。そのモードに皿が無ければ無視
 * @returns {{ lane: Object, dir: Object }}
 *   lane: 入力キー → レーン index
 *   dir:  皿の入力キー → 'A'(map 側 = 一方向) | 'B'(alt 側 = 逆方向)。皿は2キーを交互に押して回す。
 */
export function buildLaneMap(map = {}, alt = {}) {
    const lane = {};
    const dir = {};
    for (const idx of Object.keys(map)) {
        const key = map[idx];
        if (key === null || key === undefined) continue;
        const li = Number(idx);
        lane[key] = li;
        if (li === 0 || li === 8) dir[key] = 'A';
    }
    for (const idx of Object.keys(alt)) {
        const key = alt[idx];
        if (key === null || key === undefined) continue;
        const li = Number(idx);
        if (map[li] === undefined) continue; // そのモードに該当サイドの皿が無い(SP/9K)
        if (lane[key] === undefined) lane[key] = li;
        dir[key] = 'B';
    }
    return { lane, dir };
}

export const isScratchLane = (lane) => lane === 0 || lane === 8;
