// src/bms/logic/parser.js
import { LANE_MAP, PMS_LANE_MAP, LANE_LAYOUTS, MODE_LABELS } from '../constants';
import { decodeBmsText, parseInt36 } from './utils';

// ★軽量化: 正規表現はループ内で毎回リテラル評価せず、モジュール定数として1回だけ生成する
const RE_MEASURE_LEN = /^#\d{3}02$/;      // 小節長変更チャンネル (#xxx02)
const RE_CHANNEL_LINE = /^#\d{5}$/;       // 小節データ行 (#mmmcc)
// 制御構文 (#RANDOM / #SETRANDOM / #IF / #ELSEIF / #ELSE / #ENDIF(#END IF) / #ENDRANDOM)。値は省略可。
const RE_CONTROL = /^#(SETRANDOM|RANDOM|ELSEIF|ELSE|ENDIF|END\s+IF|ENDRANDOM|IF)(?:\s+(-?\d+))?\s*$/i;

export const parseBMS = async (file) => {
    const isPms = /\.pms$/i.test(file.name);
    const laneMap = isPms ? PMS_LANE_MAP : LANE_MAP;
    const text = await decodeBmsText(file);
    const lines = text.split(/\r?\n/);
    const header = { bpm: 130, wavs: {}, bmps: {}, bpms: {}, stops: {}, title: 'Unknown', artist: 'Unknown', genre: '', playlevel: '', rank: null, difficulty: null, stagefile: null, lnObj: null, player: 1 };
    let rawObjects = [];
    const measureLen = {}; const rawLinesByMeasure = {}; const notesPerMeasure = {}; const scratchPerMeasure = {};
    let maxMeasureIndex = 0;
    let maxLaneIndex = 0;
    let isSupportedMode = true;
    // .pms で PMS_LANE_MAP に無い可視ノーツ/LN チャンネル(11-19,21-29,51-59,61-69 相当)を見つけたら記録
    const unmappedPmsCh = new Set();
    const RE_PMS_PLAYFIELD_CH = /^[1256][1-9]$/;

    // ===== #RANDOM / #IF 制御構文 =====
    // randomStack: 現在有効な乱数値のスタック(#RANDOM / #SETRANDOM で積み、#ENDRANDOM で降ろす)
    // ifStack: { active: このブロックの行を読むか, matched: 同じ #IF 系列で既に成立した分岐があるか,
    //            parentActive: 外側が有効か, randDepth: #IF 開始時点の randomStack の深さ }
    // ★#ENDRANDOM を書かない譜面が多いため、#IF ブロック内で宣言された #RANDOM は #ENDIF で破棄する
    //   (そうしないと内側の乱数が外側の #IF の比較に使われてしまう)。
    const randomStack = [];
    const ifStack = [];
    const randomSelections = []; // 実際に選ばれた乱数 { max, value } (表示・デバッグ用)
    const isActive = () => ifStack.length === 0 || ifStack[ifStack.length - 1].active;
    const currentRandom = () => (randomStack.length ? randomStack[randomStack.length - 1] : null);

    for (const rawLine of lines) {
      const line = rawLine.trim(); // #IF ブロック内はインデントされていることが多い
      if (!line.startsWith('#')) continue;

      const ctl = RE_CONTROL.exec(line);
      if (ctl) {
        const cmd = ctl[1].toUpperCase().replace(/\s+/g, '');
        const n = ctl[2] !== undefined ? parseInt(ctl[2], 10) : NaN;
        const top = ifStack[ifStack.length - 1];
        if (cmd === 'RANDOM' || cmd === 'SETRANDOM') {
          if (!isActive()) { randomStack.push(null); continue; } // 無効ブロック内でも対応を取るため積む
          let v;
          if (cmd === 'SETRANDOM') v = Number.isFinite(n) ? n : null;
          else {
            const max = Number.isFinite(n) && n >= 1 ? n : 1;
            v = Math.floor(Math.random() * max) + 1;
            randomSelections.push({ max, value: v });
          }
          randomStack.push(v);
        } else if (cmd === 'ENDRANDOM') {
          const minDepth = top ? top.randDepth : 0; // 外側の #IF より前に宣言された乱数は降ろさない
          if (randomStack.length > minDepth) randomStack.pop();
        } else if (cmd === 'IF') {
          const parentActive = isActive();
          const cond = parentActive && Number.isFinite(n) && currentRandom() === n;
          ifStack.push({ active: cond, matched: cond, parentActive, randDepth: randomStack.length });
        } else if (cmd === 'ELSEIF') {
          if (!top) continue;
          if (top.matched) top.active = false;
          else {
            top.active = top.parentActive && Number.isFinite(n) && currentRandom() === n;
            top.matched = top.active;
          }
        } else if (cmd === 'ELSE') {
          if (!top) continue;
          top.active = top.parentActive && !top.matched;
          top.matched = true;
        } else { // ENDIF
          if (!top) continue;
          ifStack.pop();
          randomStack.length = Math.min(randomStack.length, top.randDepth);
        }
        continue;
      }
      if (!isActive()) continue;

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
              const lane = laneMap[ch];
              if (lane) {
                  if (lane.index > maxLaneIndex) maxLaneIndex = lane.index;
                  if (!lane.isBg) {
                      notesPerMeasure[measure] = (notesPerMeasure[measure] || 0) + 1;
                      if (lane.isScratch) scratchPerMeasure[measure] = (scratchPerMeasure[measure] || 0) + 1;
                  }
              } else if (isPms && RE_PMS_PLAYFIELD_CH.test(ch)) {
                  unmappedPmsCh.add(ch); // 未対応チャンネルの可視ノーツ → あとで警告
              }

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
            // ★STOP中の逆算(getBeatFromTime/getBpmFromTime、描画・HUDが使う)対策:
            //   停止「終了」の timePoint しか無いと、停止中の任意の時刻に対する beat 逆算は
            //   直前の(停止前の)timePointを使って停止前のBPMのまま拍を進め続けてしまい、
            //   停止終了の瞬間に本来の拍まで一気に巻き戻る(ノーツ/LNが停止中も流れ続け、
            //   停止明けに巻き戻って再度流れてくるように見える原因)。
            //   停止「開始」の timePoint を bpm=0 で追加する。(time-point.time)/(60/0=Infinity) は
            //   常に0になるため、この区間は拍が一切進まなくなる(#STOP中はBPM=0、という実際の仕様通り)。
            if (timePoints[timePoints.length - 1].beat === currentBeat) {
                timePoints[timePoints.length - 1].bpm = 0;
            } else {
                timePoints.push({ time: currentTime, beat: currentBeat, bpm: 0 });
            }
            currentTime += e.beats * (60.0 / currentBpmHeader); // 停止時間を加算（拍位置は進めない）
            timePoints.push({ time: currentTime, beat: currentBeat, bpm: currentBpmHeader }); // 停止終了、元のBPMへ復帰
        }
    }
    timePoints.push({ time: Infinity, beat: Infinity, bpm: currentBpmHeader });
    // ★軽量化: 旧 applyTime は「各オブジェクト × 全 timePoints」の線形走査で O(objects * timePoints) だった。
    //   finalObjects / backBgaObjects / ... はいずれも beat 昇順、timePoints も beat 昇順なので、
    //   ポインタを前進させるマージ歩行で O(objects + timePoints) にする（算出される time は従来と完全に同一）。
    // ★STOP1つにつき同じ beat の timePoint が2つ(開始bpm=0 / 終了)並ぶため、その beat にちょうど
    //   一致するオブジェクト(STOPと同じ行にある通常のノーツ・BGM等)は「終了」側まで読み進めてしまうと
    //   本来より停止時間ぶん遅れて発音してしまう(停止直後に音がまとめて鳴る/ズレて聞こえる原因)。
    //   beat が厳密に小さい点までだけ読み進め、次の点がちょうど同じ beat ならその「最初の」点(開始側)
    //   に1つだけ進めて止める(＝同じ beat の2点なら常に開始側を使う)。beat が厳密に大きい通常の
    //   ケースは従来どおり(結果は完全に同一)。
    const findTimePointIndex = (ti, beat) => {
        // ★重要: 同じ beat を持つオブジェクトが複数(STOPと同じ行の複数レーン等)連続する場合、
        //   このtiは呼び出しをまたいで使い回される(効率化のため)。ここで「既にその beat の
        //   最初の点にいるか」を確認せずに毎回1つ先まで進めてしまうと、同じ行の2つ目以降の
        //   オブジェクトが「開始」側ではなく「終了」側にどんどんズレていってしまっていた
        //   (STOP行の一部の音だけ正しく、残りが停止時間ぶん遅れて鳴る不具合の原因)。
        if (timePoints[ti].beat === beat) return ti;
        while (ti < timePoints.length - 1 && timePoints[ti + 1].beat < beat) ti++;
        if (ti < timePoints.length - 1 && timePoints[ti + 1].beat === beat) ti++;
        return ti;
    };
    // bpm=0(停止開始点)に一致した場合、beat差は必ず0のはずだが 0 * (60/0=Infinity) は
    // NaN になってしまう(0×∞は不定形)。この場合は素直に tp.time を使う。
    const beatToTime = (tp, beat) => tp.bpm > 0 ? tp.time + (beat - tp.beat) * (60.0 / tp.bpm) : tp.time;
    const applyTimeSorted = (objs) => {
        let ti = 0;
        for (const obj of objs) {
            ti = findTimePointIndex(ti, obj.beat);
            obj.time = beatToTime(timePoints[ti], obj.beat);
        }
    };
    applyTimeSorted(finalObjects); applyTimeSorted(backBgaObjects); applyTimeSorted(layerBgaObjects); applyTimeSorted(poorBgaObjects);
    finalObjects.sort((a, b) => a.time - b.time); backBgaObjects.sort((a, b) => a.time - b.time);
    layerBgaObjects.sort((a, b) => a.time - b.time); poorBgaObjects.sort((a, b) => a.time - b.time);

    const resolvedObjects = [];
    const pendingLN = new Array(16).fill(null); const lastNoteByLane = new Array(16).fill(null);
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
    // ★終端の無い LN(5x/6x チャンネルの開始だけで終わっている)は、以前はノーツごと消えていた。
    //   ノーツが欠けないよう、通常ノーツとして残す。
    for (const start of pendingLN) {
        if (start) resolvedObjects.push(start);
    }
    resolvedObjects.sort((a, b) => a.time - b.time);
    // ★軽量化: barLines も measureStartBeats(昇順) × timePoints(昇順) のマージ歩行で O(measures + timePoints)
    const barLines = [];
    let bti = 0;
    for (let m = 0; m <= maxMeasure; m++) {
        const beat = measureStartBeats[m];
        bti = findTimePointIndex(bti, beat); // ★STOPと同じ小節境界にある場合も「開始」側を使う(上のコメント参照)
        barLines.push({ measure: m, beat: beat, time: beatToTime(timePoints[bti], beat) });
    }
    // ★曲の終端は「最後に始まるオブジェクト」ではなく「最後に終わるオブジェクト」で決める。
    //   以前は開始時刻だけを見ていたため、最後の LN の終点がそれより後ろにあると曲が途中で打ち切られていた。
    let lastObjTime = 0;
    for (const o of resolvedObjects) {
        const end = o.type === 'long' && o.endTime !== undefined ? o.endTime : o.time;
        if (end > lastObjTime) lastObjTime = end;
    }
    if (maxLNDuration < 20.0) maxLNDuration = 20.0;

    // BPM レンジ: 最低 ～ 最頻(再生秒数が最長の区間) ～ 最大。
    // ヘッダBPMの 0 秒区間などが混ざらないよう、0.05 秒以上鳴る区間だけで集計する。
    const bpmDur = new Map();
    for (let i = 0; i < timePoints.length - 1; i++) {
        const tp = timePoints[i];
        if (!isFinite(tp.bpm) || tp.bpm <= 0) continue;
        const segEnd = isFinite(timePoints[i + 1].time) ? timePoints[i + 1].time : lastObjTime;
        const d = Math.max(0, segEnd - tp.time);
        if (d > 0.05) bpmDur.set(tp.bpm, (bpmDur.get(tp.bpm) || 0) + d);
    }
    let bpmEntries = [...bpmDur.entries()];
    if (!bpmEntries.length) bpmEntries = [[header.bpm || 130, 1]];
    let bpmMin = Infinity, bpmMax = -Infinity, bpmMain = bpmEntries[0][0], bestDur = -1;
    for (const [b, d] of bpmEntries) {
        if (b < bpmMin) bpmMin = b;
        if (b > bpmMax) bpmMax = b;
        if (d > bestDur) { bestDur = d; bpmMain = b; }
    }
    const distinctBpm = new Set(bpmEntries.map(([b]) => Math.round(b))).size || 1;
    const bpmRange = { min: Math.round(bpmMin), max: Math.round(bpmMax), main: Math.round(bpmMain), count: distinctBpm };

    // 鍵盤モード判定
    const noteCount = resolvedObjects.filter(o => o.isNote).length;
    let hasSide2 = false, has1P67 = false, has2P67 = false;
    for (const o of resolvedObjects) {
        if (!o.isNote) continue;
        const li = o.laneIndex;
        if (li >= 8) hasSide2 = true;
        if (li === 6 || li === 7) has1P67 = true;
        if (li === 14 || li === 15) has2P67 = true;
    }
    let mode;
    if (isPms) mode = 'PMS9';
    else if (noteCount === 0) mode = 'SP7';
    else if (hasSide2 || header.player === 2 || header.player === 3) mode = (has1P67 || has2P67) ? 'DP14' : 'DP10';
    else mode = has1P67 ? 'SP7' : 'SP5';

    const lanes = LANE_LAYOUTS[mode] || LANE_LAYOUTS.SP7;
    const keyMode = MODE_LABELS[mode] || '—';
    // SP5 / SP7 / DP14 / DP10 / PMS9(9K) を描画・再生対応。想定外の巨大 index のみ非対応。
    if (maxLaneIndex > 15) isSupportedMode = false;
    // 9K: 標準チャンネル(11-15/22-25/LN 51-55/62-65)以外を使う .pms は一部ノーツが欠ける
    const unmappedPmsChannels = [...unmappedPmsCh].sort();

    return { header, objects: resolvedObjects, backBgaObjects, layerBgaObjects, poorBgaObjects, barLines, timePoints, totalTime: lastObjTime + 2.0, rawLinesByMeasure, totalNotes: noteCount, notesPerMeasure, scratchPerMeasure, avgDensity, maxLNDuration, isSupportedMode, unmappedPmsChannels, randomSelections, bpmRange, keyMode, mode, lanes };
  };