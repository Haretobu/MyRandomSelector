// src/bms/logic/utils.js
import { DIFFICULTY_MAP } from '../constants';

export const parseInt36 = (str) => parseInt(str, 36);

export const getBaseName = (n) => { 
    const p=n.split('.'); 
    if(p.length>1) p.pop(); 
    return p.join('.').toLowerCase(); 
};

export const guessDifficulty = (header, fileName) => {
    const f = fileName.toLowerCase();
    if (header.difficulty) { const d = parseInt(header.difficulty); if(DIFFICULTY_MAP[d]) return DIFFICULTY_MAP[d]; }
    if (f.includes('beg')||f.includes('spb')) return DIFFICULTY_MAP[1];
    if (f.includes('nor')||f.includes('spn')||f.includes('5keys')) return DIFFICULTY_MAP[2];
    if (f.includes('hyp')||f.includes('sph')||f.includes('7keys')) return DIFFICULTY_MAP[3];
    if (f.includes('ano')||f.includes('spa')) return DIFFICULTY_MAP[4];
    if (f.includes('ins')||f.includes('spi')||f.includes('leg')||f.includes('spl')) return DIFFICULTY_MAP[5];
    return { label: 'UNK', color: 'bg-gray-600' };
};

export const findStartIndex = (objects, time) => {
  let low = 0, high = objects.length - 1;
  while (low <= high) { const mid = (low + high) >>> 1;
  if (objects[mid].time < time) low = mid + 1; else high = mid - 1; }
  return low;
};

export const getBeatFromTime = (timePoints, time) => {
    let low = 0, high = timePoints.length - 1;
    while (low <= high) { const mid = (low + high) >>> 1;
    if (timePoints[mid].time <= time) low = mid + 1; else high = mid - 1;
    }
    const index = Math.max(0, low - 1); const point = timePoints[index];
    return point.beat + (time - point.time) / (60.0 / point.bpm);
};

export const getBpmFromTime = (timePoints, time) => {
    let low = 0, high = timePoints.length - 1;
    while (low <= high) { const mid = (low + high) >>> 1;
    if (timePoints[mid].time <= time) low = mid + 1; else high = mid - 1;
    }
    return timePoints[Math.max(0, low - 1)].bpm;
};

export const createHitSound = (ctx) => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < buffer.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.6;
  }
  return buffer;
};

export const decodeBmsText = async (file) => {
    const buffer = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); } 
    catch (e) { return new TextDecoder('shift-jis').decode(buffer); }
};

export const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

export const generateLaneMap = (option) => {
    let lanes = [1, 2, 3, 4, 5, 6, 7];
    if (option === 'MIRROR') lanes = [7, 6, 5, 4, 3, 2, 1];
    else if (option === 'RANDOM') lanes = shuffleArray(lanes);
    else if (option === 'R-RANDOM') { const shift = Math.floor(Math.random() * 7);
    for(let i=0; i<shift; i++) lanes.unshift(lanes.pop()); }
    return [0, ...lanes];
};

import JSZip from 'jszip';

export const extractZipFiles = async (file) => {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);
    const files = [];
    
    // ZIP内の全ファイルを走査
    for (const relativePath of Object.keys(loadedZip.files)) {
        const zipEntry = loadedZip.files[relativePath];
        if (zipEntry.dir) continue; // ディレクトリは無視

        // ファイルデータをBlobとして取得
        const blob = await zipEntry.async('blob');
        
        // Fileオブジェクトに変換 (nameプロパティを持たせるため)
        // relativePath (フォルダ構造) を name に含めることで、getBaseName等が正しく動くようにする
        const extractedFile = new File([blob], relativePath, { type: blob.type });
        files.push(extractedFile);
    }
    return files;
};