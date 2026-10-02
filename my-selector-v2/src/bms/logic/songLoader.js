// src/bms/logic/songLoader.js
// 譜面が使う画像(BGA / STAGEFILE)・音声(WAV)を、選んだフォルダのファイルから探して読み込む。React には依存しない。
// ★デコード済み WAV / 画像はフォルダ内で使い回す(キャッシュのクリアは新しいフォルダを開いたときだけ)。
import { getBaseName } from './utils';

const MAX_LANES = 16;
const DECODE_CONCURRENCY = 6;

/** 譜面が参照する画像・音声のファイル名(定義どおりの表記)を集める */
export function collectSongAssets(parsed) {
    const { wavs, bmps, stagefile } = parsed.header;
    const audio = new Set(); const images = new Set();
    parsed.objects.forEach(o => { if (wavs[o.value]) audio.add(wavs[o.value]); });
    for (const list of [parsed.backBgaObjects, parsed.layerBgaObjects, parsed.poorBgaObjects]) {
        list.forEach(o => { if (bmps[o.value]) images.add(bmps[o.value]); });
    }
    if (stagefile) images.add(stagefile);
    return { audio, images };
}

/** 拡張子を除いた小文字のファイル名 → ファイルの一覧(exclude は除外。譜面ファイル自身など) */
export function buildFileMap(files, exclude) {
    const map = {};
    for (const f of files) {
        if (f === exclude) continue;
        const base = getBaseName(f.name);
        (map[base] || (map[base] = [])).push(f);
    }
    return map;
}

/**
 * 定義上のファイル名に対応するファイルを探す。拡張子違い(.wav 定義で実体が .ogg 等)も拾うため、
 * 拡張子を除いた名前で探し、完全一致があればそれを優先する。
 */
export function findFile(fileMap, raw) {
    const candidates = fileMap[getBaseName(raw).toLowerCase()];
    if (!candidates?.length) return null;
    return candidates.find(c => c.name.toLowerCase() === raw.toLowerCase()) || candidates[0];
}

/**
 * 画像・動画のアセットを用意する(未キャッシュのものだけ Blob URL / Image を作る)。
 * @param {Map} cache 小文字ファイル名 → アセット({ type: 'video', url } または HTMLImageElement)
 * @returns {{ stageAsset: object|null, hasVideo: boolean }} stageAsset = 表示する STAGEFILE(動画は除く)
 */
export function prepareImageAssets(parsed, fileMap, images, cache) {
    let hasVideo = false;
    for (const raw of images) {
        const key = raw.toLowerCase();
        const file = findFile(fileMap, raw);
        if (!file) continue;
        try {
            let asset = cache.get(key);
            const isVideo = asset ? asset.type === 'video' : /\.(mp4|webm|mov)$/i.test(file.name);
            if (!asset) {
                const url = URL.createObjectURL(file);
                if (isVideo) asset = { type: 'video', url };
                else { asset = new Image(); asset.src = url; }
                cache.set(key, asset);
            }
            if (isVideo) hasVideo = true;
        } catch (e) { console.warn('Asset load failed', key); }
    }
    const stage = parsed.header.stagefile ? cache.get(parsed.header.stagefile.toLowerCase()) : null;
    return { stageAsset: stage && stage.type !== 'video' ? stage : null, hasVideo };
}

/**
 * 未デコードの音声をデコードしてキャッシュに入れる(大きいファイルから、同時に DECODE_CONCURRENCY 個ずつ)。
 * @param {Map} buffers 小文字ファイル名 → AudioBuffer
 * @param {(ArrayBuffer) => Promise<AudioBuffer>} decode
 * @param {{ onStart?: (count) => void, onProgress?: (percent) => void, isStale?: () => boolean }} hooks
 *   isStale が true を返したら途中で打ち切る(デコード済みの分はキャッシュに残る)
 * @returns {Promise<boolean>} 最後まで処理したら true、打ち切ったら false
 */
export async function decodeSongAudio(fileMap, audio, buffers, decode, { onStart, onProgress, isStale = () => false } = {}) {
    const queue = [];
    for (const raw of audio) {
        const key = raw.toLowerCase();
        if (buffers.has(key)) continue; // デコード済みはスキップ
        const file = findFile(fileMap, raw);
        if (file) queue.push({ key, file });
    }
    queue.sort((a, b) => b.file.size - a.file.size);
    if (queue.length > 0) onStart?.(queue.length);
    for (let i = 0; i < queue.length; i += DECODE_CONCURRENCY) {
        await Promise.all(queue.slice(i, i + DECODE_CONCURRENCY).map(async (item) => {
            try {
                buffers.set(item.key, await decode(await item.file.arrayBuffer()));
            } catch (e) { /* 未対応形式・壊れたファイルは鳴らさない */ }
            finally { onProgress?.(Math.round((Math.min(i + DECODE_CONCURRENCY, queue.length) / queue.length) * 100)); }
        }));
        if (isStale()) return false;
    }
    return !isStale();
}

/**
 * デコード後に分かる曲の情報。
 * @returns {{ duration: number, maxSoundDuration: number, lastNotesByLane: object[] }}
 *   duration = 全オブジェクトの発音終了時刻の最大値(音源の長さ込み)
 *   maxSoundDuration = 最長の音源の長さ(途中再生の探索範囲に使う)
 *   lastNotesByLane = レーン別の最後のノーツ(デバッグ用キー入力で最後のノーツ以降に鳴らす音)
 */
export function computeSongTiming(parsed, buffers) {
    let duration = parsed.totalTime;
    let maxSoundDuration = 0;
    const lastNotesByLane = new Array(MAX_LANES).fill(null);
    for (const obj of parsed.objects) {
        const filename = parsed.header.wavs[obj.value];
        const buffer = filename && buffers.get(filename.toLowerCase());
        if (buffer) {
            if (obj.time + buffer.duration > duration) duration = obj.time + buffer.duration;
            if (buffer.duration > maxSoundDuration) maxSoundDuration = buffer.duration;
        }
        if (obj.isNote && obj.laneIndex >= 0 && obj.laneIndex < MAX_LANES) {
            const last = lastNotesByLane[obj.laneIndex];
            if (!last || obj.time > last.time) lastNotesByLane[obj.laneIndex] = obj;
        }
    }
    return { duration, maxSoundDuration, lastNotesByLane };
}
