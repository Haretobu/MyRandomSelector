// 判定幅の計算(src/bms/logic/judge.js)。BMS は beatoraja の JudgeProperty / JudgeWindowRule の計算に一致すること。
import { describe, it, expect } from 'vitest';
import { buildJudgeConfig as build, classifyJudge, judgeRankRate, resolveLnRelease } from '../../src/bms/logic/judge';
import { round2 } from './helpers';

describe('判定幅(BMS = beatoraja 準拠)', () => {
    it('7鍵 #RANK 3 (EASY = 100%) は基準値そのまま。BAD は早 220 / 遅 280', () => {
        expect(round2(build('BMS', 'SP7', { rank: 3 }).note)).toEqual({ pg: 20, gr: 60, gd: 150, bdEarly: 220, bdLate: 280 });
    });
    it('#RANK 未指定は NORMAL (75%)', () => {
        expect(round2(build('BMS', 'SP7', { rank: null }).note)).toEqual({ pg: 15, gr: 45, gd: 112.5, bdEarly: 165, bdLate: 210 });
    });
    it('#RANK 0 (VERY HARD = 25%)', () => {
        expect(round2(build('BMS', 'SP7', { rank: 0 }).note)).toEqual({ pg: 5, gr: 15, gd: 37.5, bdEarly: 55, bdLate: 70 });
    });
    it('皿は別の判定幅', () => {
        expect(round2(build('BMS', 'SP7', { rank: 2 }).scratch)).toEqual({ pg: 22.5, gr: 52.5, gd: 120, bdEarly: 172.5, bdLate: 217.5 });
    });
    it('LN 終端の判定幅も #RANK で拡縮する', () => {
        expect(round2(build('BMS', 'SP7', { rank: 2 }).lnEnd)).toEqual({ pg: 90, gr: 120, gd: 150, bdEarly: 165, bdLate: 210 });
    });
    it('#DEFEXRANK は RANK 2 を 100 とする%', () => {
        expect(judgeRankRate({ defexrank: 100 }, 'SP7')).toBe(75);
        expect(judgeRankRate({ defexrank: 120 }, 'SP7')).toBe(90);
        expect(judgeRankRate({ rank: 9 }, 'SP7')).toBe(75); // 範囲外は NORMAL
    });
    it('5鍵は FIVEKEYS の基準値。GD が GR より狭い定義は GR まで広げる(beatoraja の順序補正)', () => {
        expect(round2(build('BMS', 'SP5', { rank: 3 }).note)).toEqual({ pg: 20, gr: 50, gd: 100, bdEarly: 150, bdLate: 150 });
        expect(round2(build('BMS', 'SP5', { rank: 3 }).lnScratchEnd)).toEqual({ pg: 130, gr: 160, gd: 160, bdEarly: 260, bdLate: 260 });
    });
    it('PMS は PG / BD 固定、GR / GD だけ拡縮', () => {
        expect(round2(build('BMS', 'PMS9', { rank: 2 }).note)).toEqual({ pg: 20, gr: 35, gd: 81.9, bdEarly: 183, bdLate: 183 });
        expect(round2(build('BMS', 'PMS9', { rank: 0 }).note)).toEqual({ pg: 20, gr: 20, gd: 38.61, bdEarly: 183, bdLate: 183 });
    });
});

describe('判定幅(IIDX)', () => {
    it('#RANK によらず固定', () => {
        expect(round2(build('IIDX', 'SP7', { rank: 0 }).note)).toEqual({ pg: 16.67, gr: 33.33, gd: 116.67, bdEarly: 250, bdLate: 250 });
    });
});

describe('classifyJudge', () => {
    const w = build('BMS', 'SP7', { rank: 3 }).note;
    it('BAD は早遅で幅が違う(早 220 / 遅 280)', () => {
        expect(classifyJudge(-250, w)).toBe(null);
        expect(classifyJudge(250, w)).toBe('bd');
    });
    it('境界 ±20ms は PG', () => {
        expect([classifyJudge(-20, w), classifyJudge(20, w)]).toEqual(['pg', 'pg']);
    });
});

describe('resolveLnRelease(LN の途中離し)', () => {
    const key = build('BMS', 'SP7', { rank: 3 }).lnEnd;          // PG 120 / GR 160 / GD 200
    const scr = build('BMS', 'SP7', { rank: 3 }).lnScratchEnd;   // PG 130 / GR 170 / GD 210
    it('始点 PG・終点直前(50ms 早)で離す → PG', () => expect(resolveLnRelease('pg', -5, 50, key)).toEqual({ kind: 'pg', delta: -50 }));
    it('始点 GD → 悪い方の GD', () => expect(resolveLnRelease('gd', 90, 30, key)).toEqual({ kind: 'gd', delta: 90 }));
    it('150ms 早離し → GR', () => expect(resolveLnRelease('pg', 3, 150, key).kind).toBe('gr'));
    it('大きく早離し → BAD', () => expect(resolveLnRelease('pg', 3, 1000, key).kind).toBe('bd'));
    it('皿は判定幅が広い(125ms 早: 皿 PG / 鍵 GR)', () => {
        expect(resolveLnRelease('pg', 0, 125, scr).kind).toBe('pg');
        expect(resolveLnRelease('pg', 0, 125, key).kind).toBe('gr');
    });
});
