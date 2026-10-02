// BMS パーサー(src/bms/logic/parser.js)
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { parseBMS } from '../../src/bms/logic/parser';
import { bmsFromText, bmsFromPath } from './helpers';

const notesOf = (r) => r.objects.filter(o => o.isNote).map(o => `${o.measure}:${o.channel}`).join(',');
const base = '#BPM 120\n#WAV01 a.wav\n';
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

describe('#RANDOM / #IF 制御構文', () => {
    it('#RANDOM 2 の分岐は排他的に選ばれ、両方とも出現する', async () => {
        const seen = new Set();
        for (let i = 0; i < 100; i++) {
            const r = await parseBMS(bmsFromText(base + '#RANDOM 2\n#IF 1\n#00111:01\n#ENDIF\n#IF 2\n#00112:01\n#ENDIF\n#ENDRANDOM\n#00113:01\n'));
            seen.add(notesOf(r));
        }
        expect([...seen].sort()).toEqual(['1:11,1:13', '1:12,1:13']);
    });

    it.each([[1, '1:11'], [2, '1:12'], [3, '1:13']])('#SETRANDOM %i と #ELSEIF / #ELSE', async (v, exp) => {
        const r = await parseBMS(bmsFromText(base + `#SETRANDOM ${v}\n#IF 1\n#00111:01\n#ELSEIF 2\n#00112:01\n#ELSE\n#00113:01\n#ENDIF\n`));
        expect(notesOf(r)).toBe(exp);
    });

    it('ネスト・インデント・#END IF 表記、内側の乱数は #ENDIF で破棄', async () => {
        const r = await parseBMS(bmsFromText(base + `#SETRANDOM 1
#IF 1
    #SETRANDOM 2
    #IF 2
        #00111:01
    #END IF
    #IF 1
        #00112:01
    #ENDIF
#ENDIF
#IF 1
#00113:01
#ENDIF
`));
        expect(notesOf(r)).toBe('1:11,1:13');
    });

    it('選ばれなかったブロック内の #RANDOM / #IF は外側に影響しない', async () => {
        const r = await parseBMS(bmsFromText(base + '#SETRANDOM 2\n#IF 1\n#RANDOM 5\n#IF 3\n#00111:01\n#ENDIF\n#ENDIF\n#IF 2\n#00112:01\n#ENDIF\n'));
        expect(notesOf(r)).toBe('1:12');
    });

    it('ヘッダ(#BPM)も分岐の対象', async () => {
        const r = await parseBMS(bmsFromText('#SETRANDOM 2\n#IF 1\n#BPM 100\n#ELSE\n#BPM 200\n#ENDIF\n#00111:01\n'));
        expect(r.header.bpm).toBe(200);
    });
});

describe('LN', () => {
    it('通常の LN(5x チャンネル)は1本のノーツになる', async () => {
        const r = await parseBMS(bmsFromText(base + '#00151:01\n#00251:01\n'));
        expect(r.objects.filter(o => o.isNote).map(o => [o.type, o.time, o.endTime])).toEqual([['long', 2, 4]]);
    });

    it('終端の無い LN は通常ノーツとして残る', async () => {
        const r = await parseBMS(bmsFromText(base + '#00151:01\n#00211:01\n'));
        expect(r.objects.filter(o => o.isNote).map(o => [o.channel, o.type])).toEqual([['51', 'note'], ['11', 'note']]);
    });

    it('曲の長さは最後に「終わる」オブジェクトで決まる(LN の終点を含む)', async () => {
        const r = await parseBMS(bmsFromText(base + '#00111:01\n#00152:01\n#00452:01\n'));
        expect(r.totalTime).toBe(10); // LN 終点 8 秒 + 余白 2 秒
    });

    it('小節ごとのノーツ数の合計は総ノーツ数と一致する(LN 1本 = 1ノーツ)', async () => {
        const r = await parseBMS(bmsFromText(base + '#00111:01010101\n#00153:01000100\n#00256:01000001\n#00216:0001\n'));
        expect(r.totalNotes).toBe(7);
        expect(sum(r.notesPerMeasure)).toBe(r.totalNotes);
        expect(sum(r.scratchPerMeasure)).toBe(2); // 皿 LN 1本 + 皿 1つ
    });
});

describe('BPM 変化と STOP', () => {
    it('BPM 変化と STOP 後のノーツ時刻', async () => {
        // BPM 120(1小節 2 秒) → 小節5 の頭で BPM 180 → 2拍目で STOP 1拍(180 で 0.333 秒)
        const r = await parseBMS(bmsFromText('#BPM 120\n#WAV01 a.wav\n#BPM01 180\n#STOP01 48\n#00508:01\n#00509:0001\n#00515:01010101\n'));
        const times = r.objects.filter(o => o.isNote).map(o => +o.time.toFixed(3));
        expect(times).toEqual([10, 10.333, 10.667, 11.333]);
    });
});

const SAMPLE = resolve(__dirname, '../../src/bms/_q_Hybris_05_SPI.bms');
describe.skipIf(!existsSync(SAMPLE))('同梱のサンプル譜面', () => {
    it('解析結果の基本値', async () => {
        const r = await parseBMS(bmsFromPath(SAMPLE));
        expect(r.mode).toBe('SP7');
        expect(r.totalNotes).toBe(3017);
        expect(sum(r.notesPerMeasure)).toBe(r.totalNotes);
        expect(r.randomSelections).toEqual([]);
    });
});
