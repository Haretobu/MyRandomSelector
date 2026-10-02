// プレイモードの判定エンジン(src/bms/game/PlayJudge.js)
import { describe, it, expect, beforeEach } from 'vitest';
import { PlayJudge } from '../../src/bms/game/PlayJudge';
import { buildJudgeConfig } from '../../src/bms/logic/judge';

const chart = () => [
    { time: 1.0, isNote: true, laneIndex: 1 },
    { time: 2.0, isNote: true, laneIndex: 0, type: 'long', endTime: 3.0 }, // 皿 LN
    { time: 4.0, isNote: true, laneIndex: 2, type: 'long', endTime: 5.0 }, // 鍵 LN
    { time: 6.0, isNote: true, laneIndex: 3 },
];

describe('PlayJudge', () => {
    let j, events, o;
    beforeEach(() => {
        events = [];
        j = new PlayJudge({ onJudge: (k) => events.push(k) });
        j.setConfig(buildJudgeConfig('BMS', 'SP7', { rank: 3 })); // PG ±20
        o = chart();
    });

    it('1曲ぶんの判定(PG / 空POOR / 皿 LN / 鍵 LN の早離し / 見逃し)', () => {
        expect(j.press(o, 1, 1.005, false)).toBe(true);
        expect([j.counts.pg, j.combo]).toEqual([1, 1]);
        // 二度押し → 空POOR(コンボは切らない)
        expect(j.press(o, 1, 1.05, false)).toBe(false);
        expect([j.counts.epoor, j.combo]).toEqual([1, 1]);
        // 皿 LN: A 方向で始点 → 判定は保留
        j.press(o, 0, 2.0, true, 'A');
        expect([j.notesDone, !!j.activeLn[0]]).toEqual([1, true]);
        // 保持中の B 方向の押下・離しは無視
        j.press(o, 0, 2.3, true, 'B');
        j.release(0, 2.4, true, 'B');
        expect([j.notesDone, j.counts.epoor, !!j.activeLn[0]]).toEqual([1, 1, true]);
        // 終点まで保持 → 始点の PG で確定
        j.tickNote(o[1], 3.0, true);
        expect([j.counts.pg, j.notesDone, j.activeLn[0]]).toEqual([2, 2, null]);
        // 鍵 LN を 500ms 早離し → BAD
        j.press(o, 2, 4.0, false);
        j.release(2, 4.5, false);
        expect([j.counts.bd, j.combo]).toEqual([1, 0]);
        // 見逃し(遅れ 300ms > bdLate 280) → POOR
        j.tickNote(o[3], 6.3, false);
        expect([j.counts.poor, o[3].processed]).toEqual([1, true]);

        expect(j.notesDone).toBe(4); // 判定数 = ノーツ数
        expect(events).toEqual(['pg', 'epoor', 'pg', 'bd', 'poor']);
        const r = j.result({ totalNotes: 4 }, true);
        expect([r.exScore, r.maxEx, r.judged, r.total]).toEqual([4, 8, 4, 4]);
    });

    it('オフセット推奨は直近のずれの中央値。適用後はずれ 0 で判定', () => {
        const many = Array.from({ length: 12 }, (_, i) => ({ time: i + 1, isNote: true, laneIndex: 1 }));
        many.forEach(n => j.press(many, 1, n.time + 0.010, false)); // 毎回 +10ms で押すクセ
        expect(j.suggestOffset()).toEqual({ n: 12, value: 10 });
        j.setOffset(10);
        j.reset();
        j.press([{ time: 1, isNote: true, laneIndex: 1 }], 1, 1.010, false);
        expect([j.counts.pg, j.last.deltaMs]).toEqual([1, 0]);
        expect(j.recentDeltas.length).toBe(13); // reset しても直近のずれは残る
    });
});
