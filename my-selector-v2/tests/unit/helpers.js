// 単体テスト用の小さな道具
import { readFileSync } from 'fs';

/** parseBMS に渡せるファイル風オブジェクト(name と arrayBuffer() だけ持つ) */
export function bmsFromText(text, name = 'test.bms') {
    return { name, arrayBuffer: async () => new TextEncoder().encode(text).buffer };
}

/** ディスク上の譜面ファイルを parseBMS に渡せる形で読む */
export function bmsFromPath(path, name = 'test.bms') {
    const b = readFileSync(path);
    return { name, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
}

/** オブジェクトの数値を小数第2位で丸める(判定幅の比較用) */
export const round2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
