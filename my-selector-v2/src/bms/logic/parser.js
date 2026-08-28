// src/bms/logic/parser.js
import { LANE_MAP } from '../constants';
import { decodeBmsText, parseInt36 } from './utils';

// ★軽量化: 正規表現はループ内で毎回リテラル評価せず、モジュール定数として1回だけ生成する
const RE_MEASURE_LEN = /^#\d{3}02$/;      // 小節長変更チャンネル (#xxx02)
const RE_CHANNEL_LINE = /^#\d{5}$/;       // 小節データ行 (#mmmcc)
const RE_UNSUPPORTED_CH = /^(2[1-9]|6[1-9])$/; // 2P側チャンネル(未対応)

export const parseBMS = async (file) => {
    const text = await decodeBmsText(file);
    const lines = text.split(/\r?\n/);
    const header = { bpm: 130, wavs: {}, bmps: {}, bpms: {}, stops: {}, title: 'Unknown', artist: 'Unknown', genre: '', playlevel: '', rank: null, difficulty: null, stagefile: null, lnObj: null, player: 1 };
    let rawObjects = [];
    const measureLen = {}; const rawLinesByMeasure = {}; const notesPerMeasure = {}; const scratchPerMeasure = {};
    let maxMeasureIndex = 0;
    let maxLaneIndex = 0;
    let isSupportedMode = true;

    for (const line of lines) {
      if (!line.startsWith('#')) continue;
      let key = "", value = "";
      const sp = line.indexOf(' '); const cl = line.indexOf(':');
      if (sp !== -1 && (cl === -1 || sp < cl)) { key = line.substring(0, sp); value = line.substring(sp + 1); }
      else if (cl !== -1) { key = line.substring(0, cl); value = line.substring(cl + 1); }
      else continue;
      key = key.toUpperCase(); value = value.trim();
      if (key === '#TITLE') header.title = value;
      else if (key === '#ARTIST') header.artist = value;
      else if (key === '#GENRE') header.genre = value;
      else if (key === '#PLAYLEVEL') header.playlevel = value;
      else if (key === '#RANK') header.rank = parseInt(value);
      else if (key === '#DIFFICULTY') header.difficulty = parseInt(value);
      else if (key === '#STAGEFILE') header.stagefile = value;
      else if (key === '#BPM') header.bpm = parseFloat(value) || 130;
      else if (key === '#PLAYER') header.player = parseInt(value); 
      else if (key === '#LNOBJ') header.lnObj = parseInt36(value);
      else if (key.startsWith('#STOP') && key.length > 5) header.stops[parseInt36(key.substring(5))] = parseFloat(value);
      else if (key.startsWith('#WAV')) header.wavs[parseInt36(key.substring(4))] = value;
      else if (key.startsWith('#BMP')) header.bmps[parseInt36(key.substring(4))] = value;
      else if (key.startsWith('#BPM') && key.length > 4) header.bpms[parseInt36(key.substring(4))] = parseFloat(value); 
      else if (RE_MEASURE_LEN.test(key)) measureLen[parseInt(key.substring(1, 4))] = parseFloat(value);
      else if (RE_CHANNEL_LINE.test(key)) {
        const measure = parseInt(key.substring(1, 4));
        if (measure > maxMeasureIndex) maxMeasureIndex = measure;
        const ch = key.substring(4, 6);
        if (!rawLinesByMeasure[measure]) rawLinesByMeasure[measure] = [];
        rawLinesByMeasure[measure].push(line);
        if (value.length % 2 === 0) {
          const total = value.length / 2;
          for (let i = 0; i < total; i++) {
            const val = parseInt36(value.substring(i * 2, i * 2 + 2));
            if (val !== 0) {
              const lane = LANE_MAP[ch];
              if (lane) {
                  if (lane.index > maxLaneIndex) maxLaneIndex = lane.index;
                  if (!lane.isBg) {
                      notesPerMeasure[measure] = (notesPerMeasure[measure] || 0) + 1;
                      if (lane.isScratch) scratchPerMeasure[measure] = (scratchPerMeasure[measure] || 0) + 1;
                  }
              }
              
              if (RE_UNSUPPORTED_CH.test(ch)) isSupportedMode = false;
              if (lane || ch === '01' || ch === '04' || ch === '06' || ch === '07' || ch === '03' || ch === '08' || ch === '09') {
                rawObjects.push({
                    measure, channel: ch, position: i / total, value: val,
                    isNote: !!lane && !lane.isBg,
                    isBackBga: (ch === '04'),
                    isPoorBga: (ch === '06'), isLayerBga: (ch === '07'),
                    isBpm: (ch === '03' || ch === '08'),
                    isStop: (ch === '09'),
                    laneIndex: lane ? lane.index : -1, isLong: lane ? lane.isLong : false 
                });
              }
            }
          }
        }
      }
    }
    
    if(file.name.toLowerCase().endsWith('.pms')) isSupportedMode = false;
    if (maxLaneIndex > 7) isSupportedMode = false;
    if (header.player === 3) isSupportedMode = false;

    let totalNotesCount = 0;
    Object.values(notesPerMeasure).forEach(c => totalNotesCount += c);
    const avgDensity = maxMeasureIndex > 0 ? totalNotesCount / (maxMeasureIndex + 1) : 0;
    rawObjects.sort((a, b) => (a.measure !== b.measure) ? a.measure - b.measure : a.position - b.position);
    const maxMeasure = maxMeasureIndex;
    const measureStartBeats = [0];
    for (let m = 0; m <= maxMeasure; m++) measureStartBeats[m + 1] = measureStartBeats[m] + (4.0 * (measureLen[m] || 1.0));
    const finalObjects = []; const backBgaObjects = []; const layerBgaObjects = []; const poorBgaObjects = []; const bpmEvents = []; const stopEvents = [];
    for (const obj of rawObjects) {
        const beat = measureStartBeats[obj.measure] + (4.0 * (measureLen[obj.measure]||1.0) * obj.position);
        const processedObj = { ...obj, beat: beat };
        if (obj.isBpm) {
            let bpmVal = 0;
            if (obj.channel === '03') { const upper = Math.floor(obj.value / 36); const lower = obj.value % 36;
            bpmVal = upper * 16 + lower; }
            else if (obj.channel === '08') bpmVal = header.bpms[obj.value] || 130; 
            if (bpmVal > 0) bpmEvents.push({ beat: beat, bpm: bpmVal });
        } else if (obj.isStop) {
            const stopUnit = header.stops[obj.value];                // 1/192拍単位
            if (stopUnit) stopEvents.push({ beat: beat, beats: (stopUnit / 192) * 4 });
        } else if (obj.isBackBga) backBgaObjects.push({ ...processedObj, filename: header.bmps[obj.value] || '' });
        else if (obj.isPoorBga) poorBgaObjects.push({ ...processedObj, filename: header.bmps[obj.value] || '' });
        else if (obj.isLayerBga) layerBgaObjects.push({ ...processedObj, filename: header.bmps[obj.value] || '' });
        else {
            if (!obj.isNote) finalObjects.push({ ...processedObj, filename: header.wavs[obj.value] || '' });
            else finalObjects.push({ ...processedObj, filename: header.wavs[obj.value] || '', type: 'note', duration: 0 });
        }
    }

    const timeline = [
    ...bpmEvents.map(e => ({ ...e, kind: 'bpm' })),
    ...stopEvents.map(e => ({ ...e, kind: 'stop' }))
    ].sort((a, b) => a.beat - b.beat);

    const timePoints = [{ time: 0, beat: 0, bpm: header.bpm }];
    let currentBeat = 0; let currentTime = 0; let currentBpmHeader = header.bpm;

    for (const e of timeline) {                 // ← timelineに変更
        const deltaBeat = e.beat - currentBeat;
        if (deltaBeat > 0) {
            currentTime += deltaBeat * (60.0 / currentBpmHeader);
            currentBeat = e.beat;
        }
        if (e.kind === 'bpm') {
            currentBpmHeader = e.bpm;
            // 直前のtimePointと同じ拍なら上書き、違えば新規追加（同一拍の連続BPM変化対策）
            if (timePoints[timePoints.length - 1].beat === currentBeat) {
                timePoints[timePoints.length - 1].bpm = currentBpmHeader;
            } else {
                timePoints.push({ time: currentTime, beat: currentBeat, bpm: currentBpmHeader });
            }
        } else { // stop
            currentTime += e.beats * (60.0 / currentBpmHeader); // 停止時間を加算（拍位置は進めない）
            timePoints.push({ time: currentTime, beat: currentBeat, bpm: currentBpmHeader });
        }
    }
    timePoints.push({ time: Infinity, beat: Infinity, bpm: currentBpmHeader });
    // ★軽量化: 旧 applyTime は「各オブジェクト × 全 timePoints」の線形走査で O(objects * timePoints) だった。
    //   finalObjects / backBgaObjects / ... はいずれも beat 昇順、timePoints も beat 昇順なので、
    //   ポインタを前進させるマージ歩行で O(objects + timePoints) にする（算出される time は従来と完全に同一）。
    const applyTimeSorted = (objs) => {
        let ti = 0;
        for (const obj of objs) {
            while (ti < timePoints.length - 1 && timePoints[ti + 1].beat <= obj.beat) ti++;
            const tp = timePoints[ti];
            obj.time = tp.time + (obj.beat - tp.beat) * (60.0 / tp.bpm);
        }
    };
    applyTimeSorted(finalObjects); applyTimeSorted(backBgaObjects); applyTimeSorted(layerBgaObjects); applyTimeSorted(poorBgaObjects);
    finalObjects.sort((a, b) => a.time - b.time); backBgaObjects.sort((a, b) => a.time - b.time);
    layerBgaObjects.sort((a, b) => a.time - b.time); poorBgaObjects.sort((a, b) => a.time - b.time);

    const resolvedObjects = [];
    const pendingLN = new Array(8).fill(null); const lastNoteByLane = new Array(8).fill(null);
    let maxLNDuration = 0;
    for (const obj of finalObjects) {
        if (!obj.isNote) { resolvedObjects.push(obj); continue; } 
        const lane = obj.laneIndex;
        if (header.lnObj && obj.value === header.lnObj && lastNoteByLane[lane]) {
            const start = lastNoteByLane[lane];
            start.type = 'long'; start.endTime = obj.time; start.duration = obj.time - start.time; start.endBeat = obj.beat;
            if (start.duration > maxLNDuration) maxLNDuration = start.duration; // ★修正: #LNOBJ方式のLNもmaxLNDurationに反映
            lastNoteByLane[lane] = null; continue;
        }
        if (obj.isLong) {
            if (pendingLN[lane]) {
                const start = pendingLN[lane];
                start.type = 'long'; start.endTime = obj.time; start.duration = obj.time - start.time; start.endBeat = obj.beat;
                if (start.duration > maxLNDuration) maxLNDuration = start.duration;
                resolvedObjects.push(start); pendingLN[lane] = null;
            } else pendingLN[lane] = obj;
            lastNoteByLane[lane] = null;
        } else { resolvedObjects.push(obj); lastNoteByLane[lane] = obj; }
    }
    resolvedObjects.sort((a, b) => a.time - b.time);
    // ★軽量化: barLines も measureStartBeats(昇順) × timePoints(昇順) のマージ歩行で O(measures + timePoints)
    const barLines = [];
    let bti = 0;
    for (let m = 0; m <= maxMeasure; m++) {
        const beat = measureStartBeats[m];
        while (bti < timePoints.length - 1 && timePoints[bti + 1].beat <= beat) bti++;
        const tp = timePoints[bti];
        barLines.push({ measure: m, beat: beat, time: tp.time + (beat - tp.beat) * (60.0 / tp.bpm) });
    }
    const lastObjTime = resolvedObjects.length > 0 ? resolvedObjects[resolvedObjects.length-1].time : 0;
    if (maxLNDuration < 20.0) maxLNDuration = 20.0;

    // BPM レンジ: 最低 ～ 最頻(再生秒数が最長の区間) ～ 最大
    let bpmMin = header.bpm, bpmMax = header.bpm;
    const bpmDur = new Map();
    for (let i = 0; i < timePoints.length - 1; i++) {
        const tp = timePoints[i];
        if (!isFinite(tp.bpm) || tp.bpm <= 0) continue;
        const segEnd = isFinite(timePoints[i + 1].time) ? timePoints[i + 1].time : lastObjTime;
        bpmDur.set(tp.bpm, (bpmDur.get(tp.bpm) || 0) + Math.max(0, segEnd - tp.time));
        if (tp.bpm < bpmMin) bpmMin = tp.bpm;
        if (tp.bpm > bpmMax) bpmMax = tp.bpm;
    }
    let bpmMain = header.bpm, bestDur = -1;
    for (const [b, d] of bpmDur) { if (d > bestDur) { bestDur = d; bpmMain = b; } }
    const bpmRange = { min: Math.round(bpmMin), max: Math.round(bpmMax), main: Math.round(bpmMain) };

    // 鍵盤モード (現状 SP 5K/7K のみ対応。使用レーンの最大インデックスで判定)
    const noteCount = resolvedObjects.filter(o => o.isNote).length;
    const keyMode = maxLaneIndex >= 6 ? '7K' : (noteCount > 0 ? '5K' : '—');

    return { header, objects: resolvedObjects, backBgaObjects, layerBgaObjects, poorBgaObjects, barLines, timePoints, totalTime: lastObjTime + 2.0, rawLinesByMeasure, totalNotes: noteCount, notesPerMeasure, scratchPerMeasure, avgDensity, maxLNDuration, isSupportedMode, bpmRange, keyMode };
  };