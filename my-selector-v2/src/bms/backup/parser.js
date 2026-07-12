// src/bms/logic/parser.js
import { LANE_MAP } from '../constants';
import { decodeBmsText, parseInt36 } from './utils';

export const parseBMS = async (file) => {
    const text = await decodeBmsText(file);
    const lines = text.split(/\r?\n/);
    const header = { bpm: 130, wavs: {}, bmps: {}, bpms: {}, stops: {}, title: 'Unknown', artist: 'Unknown', genre: '', playlevel: '', rank: null, difficulty: null, stagefile: null, lnObj: null, player: 1 };
    let rawObjects = [];
    const measureLen = {}; const rawLinesByMeasure = {}; const notesPerMeasure = {}; 
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
      else if (key.match(/^#\d{3}02$/)) measureLen[parseInt(key.substring(1, 4))] = parseFloat(value);
      else if (key.match(/^#\d{5}$/)) {
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
                  if (!lane.isBg) notesPerMeasure[measure] = (notesPerMeasure[measure] || 0) + 1;
              }
              
              if (ch.match(/^(2[1-9]|6[1-9])$/)) isSupportedMode = false;
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

    const timeline = [
        ...bpmEvents.map(e => ({ ...e, kind: 'bpm' })),
        ...stopEvents.map(e => ({ ...e, kind: 'stop' }))
    ].sort((a, b) => {
        // 同一拍にBPM変化とSTOPが重なった場合、BPM変化を先に処理して計算を安定させる
        if (a.beat !== b.beat) return a.beat - b.beat;
        if (a.kind === 'bpm' && b.kind === 'stop') return -1;
        return 1;
    });

    const timePoints = [{ time: 0, beat: 0, bpm: header.bpm }];
    let currentBeat = 0; let currentTime = 0; let currentBpmHeader = header.bpm;

    for (const e of timeline) {
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
            // 1. STOP開始時点（BPM=0）を記録。これで描画時の「行き過ぎ」を防ぐ
            if (timePoints[timePoints.length - 1].beat === currentBeat && timePoints[timePoints.length - 1].time === currentTime) {
                timePoints[timePoints.length - 1].bpm = 0;
            } else {
                timePoints.push({ time: currentTime, beat: currentBeat, bpm: 0 });
            }
            
            // 停止時間分だけcurrentTimeを進める
            currentTime += e.beats * (60.0 / currentBpmHeader);
            
            // 2. STOP終了時点（元のBPMに復帰）を記録。これで描画が再開される
            timePoints.push({ time: currentTime, beat: currentBeat, bpm: currentBpmHeader });
        }
    }
    timePoints.push({ time: Infinity, beat: Infinity, bpm: currentBpmHeader });

    const applyTime = (obj) => {
        let tp = timePoints[0];
        // オブジェクトのbeat以下の最大のtimePointを探す。
        for (let i = 0; i < timePoints.length; i++) {
            if (timePoints[i].beat > obj.beat) break;
            
            // beatが同じtimePointが複数ある場合、最初のもの（STOP開始地点等）を維持する
            if (tp.beat === timePoints[i].beat && obj.beat === timePoints[i].beat) {
                continue;
            }
            tp = timePoints[i];
        }
        
        // BPM0（停止中）の区間にいる場合は時間を進めず、STOP開始時刻で固定する（キー音ズレ防止）
        if (tp.bpm === 0) {
            obj.time = tp.time; 
        } else {
            obj.time = tp.time + (obj.beat - tp.beat) * (60.0 / tp.bpm);
        }
    };
    finalObjects.forEach(applyTime); backBgaObjects.forEach(applyTime); layerBgaObjects.forEach(applyTime); poorBgaObjects.forEach(applyTime);
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
            start.type = 'long'; start.endTime = obj.time; start.duration = obj.time - start.time; start.endBeat = obj.beat; lastNoteByLane[lane] = null; continue;
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
    const barLines = [];
    for (let m = 0; m <= maxMeasure; m++) {
        const beat = measureStartBeats[m];
        let tp = timePoints[0];
        for (let i = 0; i < timePoints.length - 1; i++) { if (beat >= timePoints[i].beat && beat < timePoints[i+1].beat) { tp = timePoints[i]; break; } }
        const time = tp.time + (beat - tp.beat) * (60.0 / tp.bpm);
        barLines.push({ measure: m, beat: beat, time: time });
    }
    const lastObjTime = resolvedObjects.length > 0 ? resolvedObjects[resolvedObjects.length-1].time : 0;
    if (maxLNDuration < 20.0) maxLNDuration = 20.0;
    return { header, objects: resolvedObjects, backBgaObjects, layerBgaObjects, poorBgaObjects, barLines, timePoints, totalTime: lastObjTime + 2.0, rawLinesByMeasure, totalNotes: resolvedObjects.filter(o=>o.isNote).length, notesPerMeasure, avgDensity, maxLNDuration, isSupportedMode };
  };