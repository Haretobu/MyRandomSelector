// 白数字・緑数字と HI-SPEED の計算(src/bms/logic/greenNumber.js)
import { describe, it, expect } from 'vitest';
import { whiteNumber, greenNumber, hiSpeedForGreen, songBaseBpm } from '../../src/bms/logic/greenNumber';
import { VISIBILITY_MODES as V } from '../../src/bms/constants';

describe('whiteNumber', () => {
    it('レーンカバーの種類ごとに隠れる量を足す', () => {
        expect(whiteNumber(V.OFF, 250, 150)).toBe(0);
        expect(whiteNumber(V.SUDDEN_PLUS, 250, 150)).toBe(250);
        expect(whiteNumber(V.HIDDEN_PLUS, 250, 150)).toBe(0);   // HIDDEN+ は緑数字に影響しない
        expect(whiteNumber(V.LIFT, 250, 150)).toBe(150);
        expect(whiteNumber(V.LIFT_SUD_PLUS, 250, 150)).toBe(400);
        expect(whiteNumber(V.LIFT_SUD_PLUS, 900, 300)).toBe(1000); // 上限 1000
    });
});

describe('greenNumber / hiSpeedForGreen', () => {
    it('BPM 120 / HI-SPEED 4 の緑数字は 500ms', () => {
        expect(greenNumber(120, 4, 0)).toBe(500);
    });
    it('白数字の分だけ緑数字が減る', () => {
        expect(greenNumber(120, 4, 250)).toBe(375);
    });
    it('緑数字 500 を保つ HI-SPEED は BPM に反比例する', () => {
        expect(hiSpeedForGreen(120, 500, 0)).toBe(4);
        expect(hiSpeedForGreen(150, 500, 0)).toBe(3.2);
        expect(hiSpeedForGreen(200, 500, 0)).toBe(2.4);
    });
    it('0.01 刻みに丸め、得られる緑数字の誤差は 1% 未満', () => {
        for (const bpm of [97, 133, 155, 174, 222]) {
            const hs = hiSpeedForGreen(bpm, 500, 0);
            expect(Math.round(hs * 100)).toBe(hs * 100);
            expect(Math.abs(greenNumber(bpm, hs, 0) - 500) / 500).toBeLessThan(0.01);
        }
    });
    it('HI-SPEED の下限は 0.1', () => {
        expect(hiSpeedForGreen(999, 1500, 0)).toBe(0.16);
        expect(hiSpeedForGreen(9999, 1500, 0)).toBe(0.1);
    });
});

describe('songBaseBpm', () => {
    it('主 BPM → 無ければヘッダの #BPM → 無ければ 130', () => {
        expect(songBaseBpm({ bpmRange: { main: 150 }, header: { bpm: 120 } })).toBe(150);
        expect(songBaseBpm({ header: { bpm: 120 } })).toBe(120);
        expect(songBaseBpm(null)).toBe(130);
    });
});
