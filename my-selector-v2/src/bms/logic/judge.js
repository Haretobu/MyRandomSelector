// src/bms/logic/judge.js
// 判定ロジックのうち、React / 再生状態に依存しない純粋な部分。

// LN 終端の判定幅(ms・早離し側)。beatoraja SEVENKEYS の longnote / longscratch に準拠。
export const LN_END_WINDOW = { key: { pg: 120, gr: 160, gd: 200 }, scratch: { pg: 130, gr: 170, gd: 210 } };
const JUDGE_ORDER = { pg: 0, gr: 1, gd: 2, bd: 3 };

/**
 * LN を途中で離したときの最終判定(beatoraja の既定「LN モード」準拠)。
 * 始点の判定と「離した時刻 vs 終点」の判定の悪い方。終点の判定幅を外れた早離しは BAD。
 * @param {'pg'|'gr'|'gd'} startKind 始点の判定
 * @param {number} startDelta 始点のずれ(ms, 負=FAST)
 * @param {number} earlyMs 終点より何 ms 早く離したか(正=早い)
 * @param {boolean} isScratch 皿 LN か
 * @returns {{ kind: 'pg'|'gr'|'gd'|'bd', delta: number }} delta はずれの大きい方(早離しは FAST=負)
 */
export function resolveLnRelease(startKind, startDelta, earlyMs, isScratch) {
    const win = isScratch ? LN_END_WINDOW.scratch : LN_END_WINDOW.key;
    const endKind = earlyMs <= win.pg ? 'pg' : earlyMs <= win.gr ? 'gr' : earlyMs <= win.gd ? 'gd' : 'bd';
    const kind = JUDGE_ORDER[endKind] > JUDGE_ORDER[startKind] ? endKind : startKind;
    const delta = Math.abs(startDelta) > Math.abs(earlyMs) ? startDelta : -earlyMs;
    return { kind, delta };
}
