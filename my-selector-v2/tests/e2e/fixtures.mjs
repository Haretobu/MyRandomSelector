// E2E 用のテスト譜面と音源を生成する(リポジトリには置かず、実行のたびに作る)
import fs from 'fs';
import path from 'path';

// 減衰するサイン波の WAV(16bit / モノラル / 22.05kHz)
function wav(sec, freq) {
    const sr = 22050, n = Math.floor(sr * sec), buf = Buffer.alloc(44 + n * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / sr) * 8000 * Math.exp(-i / sr * 3)), 44 + i * 2);
    return buf;
}

/** dir の下に song/(SP5 のテスト譜面)と song-dp/(DP の小さな譜面)を作る */
export function writeFixtures(dir) {
    const song = path.join(dir, 'song'), dp = path.join(dir, 'song-dp');
    fs.mkdirSync(song, { recursive: true });
    fs.mkdirSync(dp, { recursive: true });
    const key = wav(0.15, 880);
    fs.writeFileSync(path.join(song, 'key.wav'), key);
    fs.writeFileSync(path.join(song, 'bgm.wav'), wav(14, 220));
    // SP5 / BPM 120(1小節 2 秒)。16 ノーツ: 鍵盤・皿・LN(6→7秒)・皿 LN(8→9.5秒)・BPM 変化(10秒)と STOP
    //   曲長 = BGM(2秒開始・14秒)の終わり = 16 秒
    fs.writeFileSync(path.join(song, 'test.bms'), [
        '#PLAYER 1', '#TITLE E2E', '#ARTIST test', '#BPM 120', '#RANK 3', '#WAV01 key.wav', '#WAV02 bgm.wav', '#BPM01 180', '#STOP01 48',
        '#00101:02',
        '#00111:01010101', '#00212:0101', '#00216:0001', '#00313:0101',
        '#00354:01000100', '#00456:01000001', '#00414:0001',
        '#00508:01', '#00509:0001', '#00515:01010101',
    ].join('\n') + '\n');
    // BPM 150 の短い譜面(緑数字の維持のテスト用。test.bms の主BPM は 120)
    fs.writeFileSync(path.join(song, 'fast.bms'), '#PLAYER 1\n#TITLE FAST\n#BPM 150\n#WAV01 key.wav\n#00111:01010101\n#00211:01\n');
    // DP: 1P 鍵1(2秒・3秒)/ 2P 鍵1(2秒)/ 2P 皿(3秒)/ 1P 鍵6(4秒)
    fs.writeFileSync(path.join(dp, 'key.wav'), key);
    fs.writeFileSync(path.join(dp, 'dp.bms'), '#PLAYER 3\n#TITLE DP\n#BPM 120\n#WAV01 key.wav\n#00111:01000100\n#00121:0100\n#00126:0001\n#00218:01\n');
}
