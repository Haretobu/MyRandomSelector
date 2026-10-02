// 素材の読み込み(src/bms/logic/songLoader.js)と ZIP 展開(src/bms/logic/utils.js)
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { collectSongAssets, buildFileMap, findFile, decodeSongAudio, computeSongTiming } from '../../src/bms/logic/songLoader';
import { extractZipFiles } from '../../src/bms/logic/utils';

const f = (name, size = 10) => ({ name, size, arrayBuffer: async () => name });
const bms = f('song.bms');
const files = [bms, f('Kick.ogg', 30), f('snare.wav', 20), f('snare.ogg', 50), f('bga.png'), f('movie.mp4')];
const parsed = {
    header: { wavs: { 1: 'kick.wav', 2: 'SNARE.wav', 3: 'missing.wav' }, bmps: { 1: 'bga.bmp' }, stagefile: null },
    objects: [{ value: 1, time: 0, isNote: true, laneIndex: 1 }, { value: 2, time: 5, isNote: true, laneIndex: 1 }, { value: 3, time: 6, isNote: false, laneIndex: -1 }],
    backBgaObjects: [{ value: 1 }], layerBgaObjects: [], poorBgaObjects: [], totalTime: 8,
};

describe('songLoader', () => {
    const assets = collectSongAssets(parsed);
    const map = buildFileMap(files, bms);

    it('譜面が参照するファイル名を集める', () => {
        expect([...assets.audio]).toEqual(['kick.wav', 'SNARE.wav', 'missing.wav']);
        expect([...assets.images]).toEqual(['bga.bmp']);
    });

    it('ファイルの対応付け: 拡張子違いを拾い、完全一致を優先、譜面ファイル自身は除外', () => {
        expect(findFile(map, 'song.bms')).toBe(null);
        expect(findFile(map, 'kick.wav').name).toBe('Kick.ogg');
        expect(findFile(map, 'SNARE.wav').name).toBe('snare.wav');
        expect(findFile(map, 'bga.bmp').name).toBe('bga.png');
    });

    it('デコード済みは読み直さない・見つからないものは無視・進捗を通知', async () => {
        const buffers = new Map([['snare.wav', { duration: 1 }]]);
        const decoded = []; const progress = []; let started = null;
        const ok = await decodeSongAudio(map, assets.audio, buffers,
            async (name) => { decoded.push(name); return { duration: name === 'Kick.ogg' ? 3 : 1 }; },
            { onStart: (n) => { started = n; }, onProgress: (p) => progress.push(p) });
        expect({ ok, started, decoded, progress }).toEqual({ ok: true, started: 1, decoded: ['Kick.ogg'], progress: [100] });
        expect([...buffers.keys()].sort()).toEqual(['kick.wav', 'snare.wav']);

        const t = computeSongTiming(parsed, buffers);
        expect([t.duration, t.maxSoundDuration]).toEqual([8, 3]);    // 譜面の長さ 8 秒 > 音の終わり 6 秒
        expect(computeSongTiming({ ...parsed, totalTime: 2 }, buffers).duration).toBe(6); // 音が長ければ曲も延びる
        expect(t.lastNotesByLane[1].time).toBe(5);
    });

    it('新しい読み込みが始まったら、最初のまとまり(6個)で打ち切る', async () => {
        let stale = false;
        const many = Array.from({ length: 13 }, (_, i) => f(`s${i}.wav`));
        const decoded = [];
        const ok = await decodeSongAudio(buildFileMap(many), new Set(many.map(x => x.name)), new Map(),
            async (n) => { decoded.push(n); stale = true; return { duration: 1 }; }, { isStale: () => stale });
        expect({ ok, count: decoded.length }).toEqual({ ok: false, count: 6 });
    });
});

describe('ZIP 展開のファイル名', () => {
    it('Shift-JIS のファイル名(UTF-8 フラグなし)を正しく読む。UTF-8 / ASCII 名もそのまま', async () => {
        // 日本語 Windows の圧縮ツールが作る ZIP を再現: ASCII の仮名で書き出し、ヘッダ内の名前バイトを Shift-JIS に差し替える
        const zip = new JSZip();
        zip.file('song/QQQQQQ.wav', 'x');
        zip.file('song/スネア.wav', 'y');
        zip.file('song/kick.bms', 'z');
        const raw = await zip.generateAsync({ type: 'nodebuffer' });
        const sjis = Buffer.from([0x83, 0x4c, 0x83, 0x62, 0x83, 0x4e]); // "キック"
        for (let i = raw.indexOf('QQQQQQ'); i !== -1; i = raw.indexOf('QQQQQQ', i + 1)) sjis.copy(raw, i);
        const names = (await extractZipFiles(raw)).map(x => x.name).sort();
        expect(names).toEqual(['kick.bms', 'キック.wav', 'スネア.wav'].sort());
    });
});
