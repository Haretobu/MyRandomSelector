// src/bms/logic/judge.js
// 判定ロジックのうち、React / 再生状態に依存しない純粋な部分。
//
// 判定幅は「判定方式」で切り替える:
//   BMS  … beatoraja 準拠。モード別の基準値(7鍵 / 5鍵 / PMS、皿は別)を #RANK / #DEFEXRANK の倍率で拡縮する。
//          beatoraja の JudgeProperty / JudgeWindowRule / BMSPlayerRule の計算をそのまま移植している。
//   IIDX … beatmania IIDX(GOLD 判定健全化以降)相当の固定幅。#RANK は無視する。
//          PG ±16.67 / GR ±33.33 / GD ±116.67ms は複数の検証で一致する値。BAD ±250ms は公式値が無く推定値。
//
// 判定幅の表し方: { pg, gr, gd, bdEarly, bdLate } (ms)。PG〜GD は早遅対称、BAD は早遅で幅が違う(beatoraja)。
// ずれ(deltaMs)は「入力時刻 - ノーツ時刻」。負 = 早い(FAST) / 正 = 遅い(SLOW)。

export const JUDGE_SYSTEMS = ['BMS', 'IIDX'];

// beatoraja の基準値(ms)。元データは { LATE下限, EARLY上限 } の組なので、ここでは早遅を名前で持つ。
const bj = (pg, gr, gd, bdLate, bdEarly) => ({ pg, gr, gd, bdEarly, bdLate });
const BEATORAJA = {
    SEVENKEYS: { note: bj(20, 60, 150, 280, 220), scratch: bj(30, 70, 160, 290, 230),
                 lnEnd: bj(120, 160, 200, 280, 220), lnScratchEnd: bj(130, 170, 210, 290, 230), rule: 'NORMAL' },
    FIVEKEYS:  { note: bj(20, 50, 100, 150, 150), scratch: bj(30, 60, 110, 160, 160),
                 lnEnd: bj(120, 150, 200, 250, 250), lnScratchEnd: bj(130, 160, 110, 260, 260), rule: 'NORMAL' },
    PMS:       { note: bj(20, 50, 117, 183, 183), scratch: bj(20, 50, 117, 183, 183),
                 lnEnd: bj(120, 150, 217, 283, 283), lnScratchEnd: bj(120, 150, 217, 283, 283), rule: 'PMS' },
};
// JudgeWindowRule: #RANK 0..4(VERY HARD..VERY EASY)の倍率(%) と、#RANK によらず固定の判定(PG, GR, GD, BD)。
const WINDOW_RULE = {
    NORMAL: { rankRate: [25, 50, 75, 100, 125], fixed: [false, false, false, false] },
    PMS:    { rankRate: [33, 50, 70, 100, 133], fixed: [true, false, false, true] },
};
// 空POOR の範囲(beatoraja の MS 判定。#RANK によらず固定): ノーツより 500ms 早い〜150ms 遅い
export const EPOOR_WINDOW = { early: 500, late: 150 };

const IIDX_WINDOW = { pg: 16.67, gr: 33.33, gd: 116.67, bdEarly: 250, bdLate: 250 };

// 鍵盤モード → beatoraja の判定セット
const propertyForMode = (mode) => mode === 'PMS9' ? BEATORAJA.PMS
    : (mode === 'SP5' || mode === 'DP10') ? BEATORAJA.FIVEKEYS : BEATORAJA.SEVENKEYS;

/**
 * 譜面ヘッダから beatoraja の judgerank(%) を求める(BMSPlayerRule と同じ)。
 *   #RANK 0..4 → 倍率表、範囲外・未指定 → RANK 2 相当。#DEFEXRANK x → x × (RANK 2 の倍率) / 100。
 */
export function judgeRankRate(header, mode) {
    const rule = WINDOW_RULE[propertyForMode(mode).rule];
    const base = rule.rankRate[2];
    const defex = Number(header?.defexrank);
    if (Number.isFinite(defex) && defex >= 1) return defex * base / 100;
    const rank = header?.rank;
    if (rank === null || rank === undefined || rank === '') return base;
    const r = Number(rank);
    return Number.isInteger(r) && r >= 0 && r < 5 ? rule.rankRate[r] : base;
}

// beatoraja の JudgeWindowRule.create 相当: 倍率を掛け、固定判定との大小関係・判定間の順序を補正する
function scaleWindow(org, rate, ruleName) {
    const rule = WINDOW_RULE[ruleName];
    const keys = ['pg', 'gr', 'gd', 'bd'];
    // 早遅それぞれ [PG, GR, GD, BD] の配列にして計算する
    const sides = ['early', 'late'].map(side => keys.map(k => (k === 'bd' ? (side === 'early' ? org.bdEarly : org.bdLate) : org[k])));
    for (const arr of sides) {
        for (let i = 0; i < 4; i++) if (!rule.fixed[i]) arr[i] = arr[i] * rate / 100;
        // 固定判定の間に収める(PMS: GR/GD を PG 以上・BD 以下に)
        let fixmin = -1;
        for (let i = 0; i < 4; i++) {
            if (rule.fixed[i]) { fixmin = i; continue; }
            let fixmax = -1;
            for (let j = i + 1; j < 4; j++) if (rule.fixed[j]) { fixmax = j; break; }
            if (fixmin !== -1 && arr[i] < arr[fixmin]) arr[i] = arr[fixmin];
            if (fixmax !== -1 && arr[i] > arr[fixmax]) arr[i] = arr[fixmax];
        }
        // PG〜GD は BD を超えず、前の判定より狭くならない(judgeWindowRate 補正部分。倍率は既定の 100%)
        for (let i = 0; i < 3; i++) {
            if (arr[i] > arr[3]) arr[i] = arr[3];
            if (i > 0 && arr[i] < arr[i - 1]) arr[i] = arr[i - 1];
        }
    }
    const [e, l] = sides;
    // PG〜GD は早遅で同じ値になる(元データが対称)。念のため狭い方を採用する。
    return { pg: Math.min(e[0], l[0]), gr: Math.min(e[1], l[1]), gd: Math.min(e[2], l[2]), bdEarly: e[3], bdLate: l[3] };
}

/**
 * 判定設定一式を作る。曲のロード時・判定方式の変更時に1回だけ呼び、結果を使い回す。
 * @returns {{ system, rate, note, scratch, lnEnd, lnScratchEnd, epoor }}
 */
export function buildJudgeConfig(system, mode, header) {
    if (system === 'IIDX') {
        const p = BEATORAJA.SEVENKEYS;
        // LN 終端は IIDX の数値が不明なため beatoraja の等倍(EASY 相当)を使う
        return { system, rate: 100, note: IIDX_WINDOW, scratch: IIDX_WINDOW,
                 lnEnd: { ...p.lnEnd }, lnScratchEnd: { ...p.lnScratchEnd }, epoor: EPOOR_WINDOW };
    }
    const p = propertyForMode(mode);
    const rate = judgeRankRate(header, mode);
    return {
        system: 'BMS', rate,
        note: scaleWindow(p.note, rate, p.rule), scratch: scaleWindow(p.scratch, rate, p.rule),
        lnEnd: scaleWindow(p.lnEnd, rate, p.rule), lnScratchEnd: scaleWindow(p.lnScratchEnd, rate, p.rule),
        epoor: EPOOR_WINDOW,
    };
}

/** ずれ(ms, 負=FAST)を判定する。BAD の外なら null。 */
export function classifyJudge(deltaMs, w) {
    const a = Math.abs(deltaMs);
    if (a <= w.pg) return 'pg';
    if (a <= w.gr) return 'gr';
    if (a <= w.gd) return 'gd';
    if (deltaMs < 0 ? a <= w.bdEarly : a <= w.bdLate) return 'bd';
    return null;
}

const JUDGE_ORDER = { pg: 0, gr: 1, gd: 2, bd: 3 };

/**
 * LN を途中で離したときの最終判定(beatoraja の既定「LN モード」準拠)。
 * 始点の判定と「離した時刻 vs 終点」の判定の悪い方。終点の判定幅を外れた早離しは BAD。
 * @param {'pg'|'gr'|'gd'} startKind 始点の判定
 * @param {number} startDelta 始点のずれ(ms, 負=FAST)
 * @param {number} earlyMs 終点より何 ms 早く離したか(正=早い)
 * @param {{pg:number,gr:number,gd:number}} endWindow LN 終端の判定幅(buildJudgeConfig の lnEnd / lnScratchEnd)
 * @returns {{ kind: 'pg'|'gr'|'gd'|'bd', delta: number }} delta はずれの大きい方(早離しは FAST=負)
 */
export function resolveLnRelease(startKind, startDelta, earlyMs, endWindow) {
    const w = endWindow;
    const endKind = earlyMs <= w.pg ? 'pg' : earlyMs <= w.gr ? 'gr' : earlyMs <= w.gd ? 'gd' : 'bd';
    const kind = JUDGE_ORDER[endKind] > JUDGE_ORDER[startKind] ? endKind : startKind;
    const delta = Math.abs(startDelta) > Math.abs(earlyMs) ? startDelta : -earlyMs;
    return { kind, delta };
}
