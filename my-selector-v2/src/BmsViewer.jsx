import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, SkipBack, FolderOpen, Music, Loader2, Info, Gamepad2, Keyboard, Settings, RotateCw, X, Layers, Speaker, Volume2, VolumeX, FileCode, Code, Monitor, RefreshCw, FileInput, ChevronFirst, ChevronLast, Image as ImageIcon, Flag, AlertTriangle, AlignJustify, Eye, EyeOff, FileX, ChevronDown, ChevronRight, RefreshCcw, Video, Film, ChevronsUp, Disc } from 'lucide-react';

// --- 定数 ---
const LANE_MAP = {
  '16':{index:0,isScratch:true,isLong:false},'11':{index:1,isScratch:false,isLong:false},'12':{index:2,isScratch:false,isLong:false},'13':{index:3,isScratch:false,isLong:false},
  '14':{index:4,isScratch:false,isLong:false},'15':{index:5,isScratch:false,isLong:false},'18':{index:6,isScratch:false,isLong:false},'19':{index:7,isScratch:false,isLong:false},
  '56':{index:0,isScratch:true,isLong:true},'51':{index:1,isScratch:false,isLong:true},'52':{index:2,isScratch:false,isLong:true},'53':{index:3,isScratch:false,isLong:true},
  '54':{index:4,isScratch:false,isLong:true},'55':{index:5,isScratch:false,isLong:true},'58':{index:6,isScratch:false,isLong:true},'59':{index:7,isScratch:false,isLong:true},
  '01':{index:-1,isBg:true}, '04':{index:-1,isBg:true}, '06':{index:-1,isBg:true}, '07':{index:-1,isBg:true}
};

const KEY_CONFIG_ROWS = [
    [{label:'Shift',keyIndex:0,width:'w-14',isScratch:true},{label:'S',keyIndex:2,width:'w-10'},{label:'D',keyIndex:4,width:'w-10'},{label:'F',keyIndex:6,width:'w-10'}],
    [{label:'',keyIndex:-1,width:'w-14',isSpacer:true},{label:'Z',keyIndex:1,width:'w-10'},{label:'X',keyIndex:3,width:'w-10'},{label:'C',keyIndex:5,width:'w-10'},{label:'V',keyIndex:7,width:'w-10'}]
];

const DIFFICULTY_MAP = {
    1:{label:'BEGINNER',color:'bg-green-600'},2:{label:'NORMAL',color:'bg-blue-600'},3:{label:'HYPER',color:'bg-yellow-500 text-black'},
    4:{label:'ANOTHER',color:'bg-red-600'},5:{label:'LEGGENDARIA',color:'bg-purple-600'} 
};

const VISIBILITY_MODES = {
    OFF: 'OFF',
    SUDDEN_PLUS: 'SUDDEN+',
    HIDDEN_PLUS: 'HIDDEN+',
    SUD_HID_PLUS: 'SUD+ & HID+',
    LIFT: 'LIFT',
    LIFT_SUD_PLUS: 'LIFT & SUD+'
};

// --- ユーティリティ ---
const parseInt36 = (str) => parseInt(str, 36);
const getBaseName = (n) => { const p=n.split('.'); if(p.length>1)p.pop(); return p.join('.').toLowerCase(); };

const guessDifficulty = (header, fileName) => {
    const f = fileName.toLowerCase();
    if (header.difficulty) { const d = parseInt(header.difficulty); if(DIFFICULTY_MAP[d]) return DIFFICULTY_MAP[d]; }
    if (f.includes('beg')||f.includes('spb')) return DIFFICULTY_MAP[1];
    if (f.includes('nor')||f.includes('spn')||f.includes('5keys')) return DIFFICULTY_MAP[2];
    if (f.includes('hyp')||f.includes('sph')||f.includes('7keys')) return DIFFICULTY_MAP[3];
    if (f.includes('ano')||f.includes('spa')) return DIFFICULTY_MAP[4];
    if (f.includes('ins')||f.includes('spi')||f.includes('leg')||f.includes('spl')) return DIFFICULTY_MAP[5];
    return { label: 'UNK', color: 'bg-gray-600' };
};

const findStartIndex = (objects, time) => {
  let low = 0, high = objects.length - 1;
  while (low <= high) { const mid = (low + high) >>> 1;
  if (objects[mid].time < time) low = mid + 1; else high = mid - 1; }
  return low;
};

const getBeatFromTime = (timePoints, time) => {
    let low = 0, high = timePoints.length - 1;
    while (low <= high) { const mid = (low + high) >>> 1;
    if (timePoints[mid].time <= time) low = mid + 1; else high = mid - 1;
    }
    const index = Math.max(0, low - 1); const point = timePoints[index];
    return point.beat + (time - point.time) / (60.0 / point.bpm);
};

const getBpmFromTime = (timePoints, time) => {
    let low = 0, high = timePoints.length - 1;
    while (low <= high) { const mid = (low + high) >>> 1;
    if (timePoints[mid].time <= time) low = mid + 1; else high = mid - 1;
    }
    return timePoints[Math.max(0, low - 1)].bpm;
};

const createHitSound = (ctx) => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < buffer.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.6;
  }
  return buffer;
};

const decodeBmsText = async (file) => {
    const buffer = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); } 
    catch (e) { return new TextDecoder('shift-jis').decode(buffer);
    }
};

const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

const generateLaneMap = (option) => {
    let lanes = [1, 2, 3, 4, 5, 6, 7];
    if (option === 'MIRROR') lanes = [7, 6, 5, 4, 3, 2, 1];
    else if (option === 'RANDOM') lanes = shuffleArray(lanes);
    else if (option === 'R-RANDOM') { const shift = Math.floor(Math.random() * 7);
    for(let i=0; i<shift; i++) lanes.unshift(lanes.pop()); }
    return [0, ...lanes];
};

// BGA Layer Component
const BgaLayer = ({ bgaState, zIndex, blendMode = 'normal', opacity = 1, isPlaying, currentTime, isVideoEnabled = true }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        if (bgaState?.type === 'video' && videoRef.current) {
             const video = videoRef.current;
             const targetTime = Math.max(0, currentTime - (bgaState.startTime || 0));
             
             if (isPlaying) {
                 if (video.paused) video.play().catch(() => {});
                 if (Math.abs(video.currentTime - targetTime) > 0.2) {
                     video.currentTime = targetTime;
                 }
             } else {
                 if (!video.paused) video.pause();
                 if (Math.abs(video.currentTime - targetTime) > 0.05) {
                     video.currentTime = targetTime;
                 }
             }
        }
    }, [bgaState, isPlaying, currentTime]);

    if (!bgaState) return null;

    if (bgaState.type === 'video') {
        if (!isVideoEnabled) return null;
        return (
          <video 
              ref={videoRef}
              src={bgaState.url || bgaState.src} 
              className="absolute inset-0 w-full h-full object-contain" 
              style={{ zIndex, mixBlendMode: blendMode, opacity }}
              muted 
              playsInline
              loop={false}
          />
        );
    }
    
    return (
      <img 
          src={bgaState.src || bgaState.url} 
          className="absolute inset-0 w-full h-full object-contain" 
          style={{ zIndex, mixBlendMode: blendMode, opacity }} 
          alt="BGA" 
      />
    );
};

const LOOKAHEAD = 0.1; 
const SCHEDULE_INTERVAL = 25; 
const MAX_SHORT_POLYPHONY = 256;

export default function BmsViewer() {
  const [files, setFiles] = useState([]);
  const [bmsList, setBmsList] = useState([]);
  const [selectedBmsIndex, setSelectedBmsIndex] = useState(-1);
  const [parsedSong, setParsedSong] = useState(null);
  const [displayObjects, setDisplayObjects] = useState([]);
  const [currentMeasureLines, setCurrentMeasureLines] = useState([]);
  const [currentMeasureNotes, setCurrentMeasureNotes] = useState({ processed: 0, total: 0, average: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTimeDisplay, setPlaybackTimeDisplay] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [hiSpeed, setHiSpeed] = useState(2.0);
  const [volume, setVolume] = useState(0.8);
  const [lastVolume, setLastVolume] = useState(0.8);
  const [hitSoundVolume, setHitSoundVolume] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [customKeyHitSound, setCustomKeyHitSound] = useState(null);
  const [customScratchHitSound, setCustomScratchHitSound] = useState(null);
  const [difficultyInfo, setDifficultyInfo] = useState({ label: '-', color: 'bg-gray-600' });
  const [visibilityMode, setVisibilityMode] = useState(VISIBILITY_MODES.OFF);
  const [suddenPlusVal, setSuddenPlusVal] = useState(250);
  const [hiddenPlusVal, setHiddenPlusVal] = useState(200);
  const [liftVal, setLiftVal] = useState(150);

  const [currentBackBga, setCurrentBackBga] = useState(null);
  const [currentLayerBga, setCurrentLayerBga] = useState(null);
  const [currentPoorBga, setCurrentPoorBga] = useState(null); 
  const [stageFileImage, setStageFileImage] = useState(null);

  const [showMissLayer, setShowMissLayer] = useState(false); 
  const [polyphonyCount, setPolyphonyCount] = useState(0);
  const [maxPolyphonyCount, setMaxPolyphonyCount] = useState(0);
  const [averagePolyphony, setAveragePolyphony] = useState(0); 
  const [realtimeBpm, setRealtimeBpm] = useState(0); 
  const [currentMeasure, setCurrentMeasure] = useState(0);
  const [nextBpmInfo, setNextBpmInfo] = useState(null);
  const [playSide, setPlaySide] = useState('1P'); 
  const [playOption, setPlayOption] = useState('OFF'); 
  const [currentLaneOrder, setCurrentLaneOrder] = useState([1,2,3,4,5,6,7]);
  const [combo, setCombo] = useState(0);
  const [comboPos, setComboPos] = useState('CENTER'); 
  const [noteCounts, setNoteCounts] = useState(new Array(8).fill(0)); 
  const [totalNotes, setTotalNotes] = useState(0);
  const [currentBpm, setCurrentBpm] = useState(130); 
  const [showReady, setShowReady] = useState(true);
  const [readyAnimState, setReadyAnimState] = useState(null); 
  const [backingTracks, setBackingTracks] = useState([]);
  const [playKeySounds, setPlayKeySounds] = useState(true);
  const [playBgSounds, setPlayBgSounds] = useState(true);      
  const [playLongAudio, setPlayLongAudio] = useState(true);
  const [scratchRotationEnabled, setScratchRotationEnabled] = useState(true);
  const [isInputDebugMode, setIsInputDebugMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [showMutedMonitor, setShowMutedMonitor] = useState(true);
  const [showAbortedMonitor, setShowAbortedMonitor] = useState(true); 
  const [monitorUpdateInterval, setMonitorUpdateInterval] = useState(50);
  const [playBgaVideo, setPlayBgaVideo] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);

  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioBuffersRef = useRef(new Map());
  const imageAssetsRef = useRef(new Map()); 
  const schedulerTimerRef = useRef(null);
  const nextNoteIndexRef = useRef(0);        
  const activeNodesRef = useRef([]);        
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const keyHitSoundBufferRef = useRef(null);
  const scratchHitSoundBufferRef = useRef(null);
  const controllerRefs = useRef([]); 
  const keyboardRefs = useRef([]);
  const activeInputLanesRef = useRef(new Set()); 
  const activeShortSoundsRef = useRef([]);
  const activeLongSoundsRef = useRef([]); 
  const nextBackBgaIndexRef = useRef(0);
  const nextLayerBgaIndexRef = useRef(0);
  const nextPoorBgaIndexRef = useRef(0);
  const lastPlayedSoundPerLaneRef = useRef(new Array(8).fill(null));
  const comboRef = useRef(0);
  const noteCountsRef = useRef(new Array(8).fill(0)); 
  const lastStateUpdateRef = useRef(0);
  const currentMeasureRef = useRef(-1);
  const longAudioProgressRefs = useRef(new Map());
  const missLayerTimerRef = useRef(null); 
  
  const polyphonyHistoryRef = useRef([]);
  const maxPolyRef = useRef(0);
  
  const scratchAngleRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastScratchTimeRef = useRef(0);
  const lastScratchTypeRef = useRef('REVERSE');
  const scratchDirectionRef = useRef(-1);
  const isShiftHeldRef = useRef(false);
  const isCtrlHeldRef = useRef(false);

  const hiSpeedRef = useRef(hiSpeed);
  const isPlayingRef = useRef(isPlaying);
  const playKeySoundsRef = useRef(playKeySounds);
  const playBgSoundsRef = useRef(playBgSounds);
  const playLongAudioRef = useRef(playLongAudio);
  const scratchRotationEnabledRef = useRef(scratchRotationEnabled);
  const comboPosRef = useRef(comboPos);
  const volumeRef = useRef(volume);
  const hitSoundVolumeRef = useRef(hitSoundVolume);
  const readyAnimStateRef = useRef(null); 
  const isInputDebugModeRef = useRef(isInputDebugMode);
  const playSideRef = useRef(playSide);
  const showMutedMonitorRef = useRef(showMutedMonitor);
  const showAbortedMonitorRef = useRef(showAbortedMonitor);
  const monitorUpdateIntervalRef = useRef(monitorUpdateInterval);
  const visibilityModeRef = useRef(visibilityMode);
  const suddenPlusValRef = useRef(suddenPlusVal);
  const hiddenPlusValRef = useRef(hiddenPlusVal);
  const liftValRef = useRef(liftVal);

  useEffect(() => { hiSpeedRef.current = hiSpeed; }, [hiSpeed]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playKeySoundsRef.current = playKeySounds; }, [playKeySounds]);
  useEffect(() => { playBgSoundsRef.current = playBgSounds; }, [playBgSounds]);
  useEffect(() => { playLongAudioRef.current = playLongAudio; }, [playLongAudio]);
  useEffect(() => { scratchRotationEnabledRef.current = scratchRotationEnabled; }, [scratchRotationEnabled]);
  useEffect(() => { comboPosRef.current = comboPos; }, [comboPos]);
  useEffect(() => { volumeRef.current = volume; if (gainNodeRef.current) gainNodeRef.current.gain.value = volume; }, [volume]);
  useEffect(() => { hitSoundVolumeRef.current = hitSoundVolume; }, [hitSoundVolume]);
  useEffect(() => { readyAnimStateRef.current = readyAnimState; }, [readyAnimState]);
  useEffect(() => { playSideRef.current = playSide; }, [playSide]);
  useEffect(() => { showMutedMonitorRef.current = showMutedMonitor; }, [showMutedMonitor]);
  useEffect(() => { showAbortedMonitorRef.current = showAbortedMonitor; }, [showAbortedMonitor]);
  useEffect(() => { monitorUpdateIntervalRef.current = monitorUpdateInterval; }, [monitorUpdateInterval]);
  useEffect(() => { visibilityModeRef.current = visibilityMode; }, [visibilityMode]);
  useEffect(() => { suddenPlusValRef.current = suddenPlusVal; }, [suddenPlusVal]);
  useEffect(() => { hiddenPlusValRef.current = hiddenPlusVal; }, [hiddenPlusVal]);
  useEffect(() => { liftValRef.current = liftVal; }, [liftVal]);
  useEffect(() => { 
      isInputDebugModeRef.current = isInputDebugMode;
      if (isInputDebugMode && !animationRef.current) {
          lastFrameTimeRef.current = performance.now();
          animationRef.current = requestAnimationFrame(renderLoop);
      }
  }, [isInputDebugMode]);
  
  const setLaneActive = (idx, active) => {
      const ctrlEl = controllerRefs.current[idx];
      if (ctrlEl) {
          if (idx === 0) { 
             ctrlEl.style.boxShadow = active ? '0 0 25px #ff3333' : 'none';
             ctrlEl.style.borderColor = active ? '#ff3333' : '#333';
          } else { 
             const isBlue = [2, 4, 6].includes(idx);
             const activeColor = isBlue ? '#3b82f6' : '#ffffff';
             ctrlEl.style.backgroundColor = active ? activeColor : (isBlue ? '#111' : '#222');
             ctrlEl.style.boxShadow = active ? `0 0 20px ${activeColor}` : 'none';
          }
      }
      const kbEl = keyboardRefs.current[idx];
      if (kbEl) {
          const isScratch = idx === 0;
          if (active) {
              kbEl.style.backgroundColor = isScratch ? '#ef4444' : '#3b82f6';
              kbEl.style.color = '#ffffff';
              kbEl.style.borderColor = isScratch ? '#f87171' : '#60a5fa';
              kbEl.style.boxShadow = isScratch ? '0 0 10px #ef4444' : '0 0 10px #3b82f6';
          } else {
              kbEl.style.backgroundColor = '#0f172a';
              kbEl.style.color = isScratch ? '#fca5a5' : '#475569';
              kbEl.style.borderColor = isScratch ? '#7f1d1d' : '#1e293b';
              kbEl.style.boxShadow = 'none';
          }
      }
  };
  const clearActiveLanes = () => { for(let i=0; i<8; i++) setLaneActive(i, false); };

  const triggerMiss = () => {
      comboRef.current = 0;
      setCombo(0);
      setShowMissLayer(true);
      if (missLayerTimerRef.current) clearTimeout(missLayerTimerRef.current);
      missLayerTimerRef.current = setTimeout(() => {
          setShowMissLayer(false);
      }, 500);
  };

  const applyOptions = (objects, option) => {
    const map = generateLaneMap(option);
    setCurrentLaneOrder(map.slice(1));
    return objects.map(o => ({
        ...o, processed: false,
        laneIndex: (o.isNote && o.laneIndex !== 0) ? (option === 'S-RANDOM' ? Math.floor(Math.random() * 7) + 1 : map[o.laneIndex]) : o.laneIndex
    }));
  };

  const toggleMute = () => {
      if (volume > 0) {
          setLastVolume(volume);
          setVolume(0);
      } else {
          setVolume(lastVolume || 0.8);
      }
  };

  const resetGameStatus = () => {
    stopPlayback(true);
    if (audioContextRef.current) activeNodesRef.current.forEach(n => { try { n.node.stop(); n.node.disconnect(); } catch(e){} });
    activeNodesRef.current = [];
    activeShortSoundsRef.current = [];
    activeLongSoundsRef.current = [];
    setBackingTracks([]);
    imageAssetsRef.current.clear(); 
    setParsedSong(null);
    setDisplayObjects([]);
    setCurrentBackBga(null);
    setCurrentLayerBga(null);
    setCurrentPoorBga(null); 
    setStageFileImage(null);
    setShowMissLayer(false);
    setNextBpmInfo(null);
    setCurrentMeasureLines([]);
    setCurrentMeasureNotes({ processed: 0, total: 0, average: 0 });
    scratchAngleRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastScratchTimeRef.current = 0;
    lastScratchTypeRef.current = 'REVERSE';
    scratchDirectionRef.current = -1;
    activeInputLanesRef.current.clear();
    isShiftHeldRef.current = false;
    isCtrlHeldRef.current = false;
    setHasVideo(false);
    setPlayBgaVideo(true);
    
    setPolyphonyCount(0);
    setMaxPolyphonyCount(0);
    setAveragePolyphony(0);
    polyphonyHistoryRef.current = [];
    maxPolyRef.current = 0;
  };

  const resetAllState = () => { resetGameStatus(); audioBuffersRef.current.clear(); setBmsList([]); };

  useEffect(() => {
    if (!isInputDebugMode) { activeInputLanesRef.current.clear(); clearActiveLanes(); return; }
    const handleKeyDown = (e) => {
        if (e.repeat) return;
        let lane = -1;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { isShiftHeldRef.current = true; lane = 0; } 
        else if (e.code === 'ControlLeft' || e.code === 'ControlRight') { isCtrlHeldRef.current = true; lane = 0; }
        else if (e.code === 'KeyM') { triggerMiss(); } 
        
        switch(e.code) {
            case 'KeyZ': lane = 1; break; case 'KeyS': lane = 2; break; case 'KeyX': lane = 3; break; case 'KeyD': lane = 4; break;
            case 'KeyC': lane = 5; break; case 'KeyF': lane = 6; break; case 'KeyV': lane = 7; break;
        }
     
        if (lane !== -1) { activeInputLanesRef.current.add(lane); setLaneActive(lane, true); }
        if (!animationRef.current) { lastFrameTimeRef.current = performance.now(); animationRef.current = requestAnimationFrame(renderLoop); }
    };
    const handleKeyUp = (e) => {
        let lane = -1;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { isShiftHeldRef.current = false; lane = 0; } 
        else if (e.code === 'ControlLeft' || e.code === 'ControlRight') { isCtrlHeldRef.current = false; lane = 0; }
        switch(e.code) {
            case 'KeyZ': lane = 1; break; case 'KeyS': lane = 2; break; case 'KeyX': lane = 3; break; case 'KeyD': lane = 4; break;
            case 'KeyC': lane = 5; break; case 'KeyF': lane = 6; break; case 'KeyV': lane = 7; break;
        }
        if (lane === 0) {
            if (!isShiftHeldRef.current && !isCtrlHeldRef.current) { activeInputLanesRef.current.delete(0); setLaneActive(0, false); }
        } else if (lane !== -1) { activeInputLanesRef.current.delete(lane); setLaneActive(lane, false); }
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    if (!animationRef.current) { lastFrameTimeRef.current = performance.now(); animationRef.current = requestAnimationFrame(renderLoop); }
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [isInputDebugMode, playSide]);

  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContext({ latencyHint: 'interactive' });
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.gain.value = volume;
    gainNodeRef.current.connect(audioContextRef.current.destination);
    
    const defaultHitSound = createHitSound(audioContextRef.current);
    keyHitSoundBufferRef.current = defaultHitSound;
    scratchHitSoundBufferRef.current = defaultHitSound;

    const resumeAudio = () => { if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume(); };
    window.addEventListener('click', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const processFiles = (fileList) => {
    const validFiles = fileList.filter(f => /\.(bms|bme|bml|pms|wav|ogg|mp3|bmp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(f.name));
    if (validFiles.length === 0) { alert("BMS関連ファイルが見つかりませんでした。"); return; }
    resetAllState(); 
    setFiles(validFiles);
    const bmsFiles = validFiles.filter(f => /\.(bms|bme|bml|pms)$/i.test(f.name)).map((f, i) => ({ file: f, index: i, name: f.name }));
    setBmsList(bmsFiles);
    if (bmsFiles.length > 0) setSelectedBmsIndex(0);
  };

  const handleFileSelect = (e) => processFiles(Array.from(e.target.files));
  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.items) processFiles(Array.from(e.dataTransfer.files)); }, []);

  const handleKeyHitSoundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !audioContextRef.current) return;
    const buf = await file.arrayBuffer();
    keyHitSoundBufferRef.current = await audioContextRef.current.decodeAudioData(buf);
    setCustomKeyHitSound(file.name);
  };
  const handleKeyHitSoundReset = () => {
      if (audioContextRef.current) {
          keyHitSoundBufferRef.current = createHitSound(audioContextRef.current);
          setCustomKeyHitSound(null);
      }
  };

  const handleScratchHitSoundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !audioContextRef.current) return;
    const buf = await file.arrayBuffer();
    scratchHitSoundBufferRef.current = await audioContextRef.current.decodeAudioData(buf);
    setCustomScratchHitSound(file.name);
  };
  const handleScratchHitSoundReset = () => {
      if (audioContextRef.current) {
          scratchHitSoundBufferRef.current = createHitSound(audioContextRef.current);
          setCustomScratchHitSound(null);
      }
  };

  const refreshRandom = () => { if (!parsedSong) return; stopPlayback(true); setDisplayObjects(applyOptions(parsedSong.objects, playOption)); };
  useEffect(() => { if (parsedSong) setDisplayObjects(applyOptions(parsedSong.objects, playOption)); }, [parsedSong, playOption]);
  
  const parseBMS = async (file) => {
    const text = await decodeBmsText(file);
    const lines = text.split(/\r?\n/);
    const header = { bpm: 130, wavs: {}, bmps: {}, bpms: {}, title: 'Unknown', artist: 'Unknown', genre: '', playlevel: '', rank: null, difficulty: null, stagefile: null, lnObj: null, player: 1 };
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
              if (lane || ch === '01' || ch === '04' || ch === '06' || ch === '07' || ch === '03' || ch === '08') {
                rawObjects.push({ measure, channel: ch, position: i / total, value: val, isNote: !!lane && !lane.isBg, isBackBga: (ch === '04'), isPoorBga: (ch === '06'), isLayerBga: (ch === '07'), isBpm: (ch === '03' || ch === '08'), laneIndex: lane ? lane.index : -1, isLong: lane ? lane.isLong : false });
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
    const finalObjects = []; const backBgaObjects = []; const layerBgaObjects = []; const poorBgaObjects = []; const bpmEvents = [];
    for (const obj of rawObjects) {
        const beat = measureStartBeats[obj.measure] + (4.0 * (measureLen[obj.measure]||1.0) * obj.position);
        const processedObj = { ...obj, beat: beat };
        if (obj.isBpm) {
            let bpmVal = 0;
            if (obj.channel === '03') { const upper = Math.floor(obj.value / 36); const lower = obj.value % 36;
            bpmVal = upper * 16 + lower; }
            else if (obj.channel === '08') bpmVal = header.bpms[obj.value] || 130; 
            if (bpmVal > 0) bpmEvents.push({ beat: beat, bpm: bpmVal });
        } else if (obj.isBackBga) backBgaObjects.push({ ...processedObj, filename: header.bmps[obj.value] || '' });
        else if (obj.isPoorBga) poorBgaObjects.push({ ...processedObj, filename: header.bmps[obj.value] || '' });
        else if (obj.isLayerBga) layerBgaObjects.push({ ...processedObj, filename: header.bmps[obj.value] || '' });
        else {
            if (!obj.isNote) finalObjects.push({ ...processedObj, filename: header.wavs[obj.value] || '' });
            else finalObjects.push({ ...processedObj, filename: header.wavs[obj.value] || '', type: 'note', duration: 0 });
        }
    }
    bpmEvents.sort((a, b) => a.beat - b.beat);
    const timePoints = [{ time: 0, beat: 0, bpm: header.bpm }]; 
    let currentBeat = 0; let currentTime = 0;
    let currentBpmHeader = header.bpm;
    for (const e of bpmEvents) {
        if (e.beat <= currentBeat) { currentBpmHeader = e.bpm; timePoints[timePoints.length - 1].bpm = currentBpmHeader; continue; }
        const deltaBeat = e.beat - currentBeat;
        const deltaTime = deltaBeat * (60.0 / currentBpmHeader);
        currentTime += deltaTime; currentBeat = e.beat; currentBpmHeader = e.bpm;
        timePoints.push({ time: currentTime, beat: currentBeat, bpm: currentBpmHeader });
    }
    timePoints.push({ time: Infinity, beat: Infinity, bpm: currentBpmHeader });
    const applyTime = (obj) => {
        let tp = timePoints[0];
        for (let i = 0; i < timePoints.length - 1; i++) { if (obj.beat >= timePoints[i].beat && obj.beat < timePoints[i+1].beat) { tp = timePoints[i]; break; } }
        obj.time = tp.time + (obj.beat - tp.beat) * (60.0 / tp.bpm);
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

  useEffect(() => { if (selectedBmsIndex >= 0 && bmsList[selectedBmsIndex]) loadBmsAndAudio(bmsList[selectedBmsIndex].file); }, [selectedBmsIndex]);
  
  const loadBmsAndAudio = async (bmsFile) => {
    if (isPlayingRef.current) stopPlayback(true);
    setParsedSong(null); setDisplayObjects([]); setCurrentBackBga(null); setCurrentLayerBga(null); setCurrentPoorBga(null); setShowMissLayer(false);
    setNextBpmInfo(null);
    setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: 0 });
    scratchAngleRef.current = 0; lastScratchTimeRef.current = 0; lastScratchTypeRef.current = 'REVERSE';
    scratchDirectionRef.current = -1; activeInputLanesRef.current.clear(); isShiftHeldRef.current = false; isCtrlHeldRef.current = false;
    if (audioContextRef.current) activeNodesRef.current.forEach(n => { try { n.node.stop(); n.node.disconnect(); } catch(e){} });
    activeNodesRef.current = []; activeShortSoundsRef.current = [];
    activeLongSoundsRef.current = [];
    setBackingTracks([]); imageAssetsRef.current.clear(); audioBuffersRef.current.clear(); 

    setIsLoading(true); setLoadingProgress(0); setLoadingMessage('BMSファイルを解析中...');

    try {
      const parsed = await parseBMS(bmsFile);
      setTimeout(() => {
        if (!parsed.isSupportedMode) {
            alert("警告：このBMSファイルは5鍵/7鍵盤以外のモード（DPやPMSなど）を含んでいる可能性があります。\n正しく再生されない、または未実装の形式です。");
        }
      }, 100);
      const diffInfo = guessDifficulty(parsed.header, bmsFile.name);
      setDifficultyInfo(diffInfo); setRealtimeBpm(parsed.header.bpm); setCurrentBpm(parsed.header.bpm); 

      const neededAudio = new Set(); const neededImages = new Set();
      parsed.objects.forEach(o => { if (parsed.header.wavs[o.value]) neededAudio.add(parsed.header.wavs[o.value]); });
      parsed.backBgaObjects.forEach(o => { if (parsed.header.bmps[o.value]) neededImages.add(parsed.header.bmps[o.value]); });
      parsed.layerBgaObjects.forEach(o => { if (parsed.header.bmps[o.value]) neededImages.add(parsed.header.bmps[o.value]); });
      parsed.poorBgaObjects.forEach(o => { if (parsed.header.bmps[o.value]) neededImages.add(parsed.header.bmps[o.value]); });
      if (parsed.header.stagefile) neededImages.add(parsed.header.stagefile);
      const fileMap = {};
      files.forEach(f => {
        if (f === bmsFile) return;
        const base = getBaseName(f.name);
        if (!fileMap[base]) fileMap[base] = [];
        fileMap[base].push(f);
      });
      const imageQueue = [];
      neededImages.forEach(raw => {
          const base = getBaseName(raw).toLowerCase(); const candidates = fileMap[base];
          if (candidates?.length) {
              let best = candidates[0]; const exact = candidates.find(c => c.name.toLowerCase() === raw.toLowerCase());
              if (exact) best = exact;
              imageQueue.push({ key: raw.toLowerCase(), file: best });
           }
      });
      for (const item of imageQueue) {
          try {
              const url = URL.createObjectURL(item.file);
              const isVideo = /\.(mp4|webm|mov)$/i.test(item.file.name);
              
              if (isVideo) {
                  imageAssetsRef.current.set(item.key, { type: 'video', url: url });
              } else {
                  const img = new Image();
                  img.src = url;
                  imageAssetsRef.current.set(item.key, img);
              }
              
              if (parsed.header.stagefile && item.key === parsed.header.stagefile.toLowerCase()) {
                  if (!isVideo) setCurrentBackBga(imageAssetsRef.current.get(item.key));
              }
          } catch(e) { console.warn("Asset load failed", item.key); }
      }
      
      if (parsed.header.stagefile && !currentBackBga) { 
          const asset = imageAssetsRef.current.get(parsed.header.stagefile.toLowerCase());
          if(asset && asset.type !== 'video') setCurrentBackBga(asset); 
      }

      const queue = [];
      neededAudio.forEach(raw => {
        const base = getBaseName(raw).toLowerCase(); const candidates = fileMap[base];
        if (candidates?.length) {
          let best = candidates[0]; const exact = candidates.find(c => c.name.toLowerCase() === raw.toLowerCase());
          if (exact) best = exact;
          queue.push({ key: raw.toLowerCase(), file: best });
        }
      });
      queue.sort((a, b) => b.file.size - a.file.size);

      if (queue.length > 0) setLoadingMessage(`音声ファイルを読み込み中... (${queue.length}個)`);
      const CONCURRENCY = 6;
      for (let i = 0; i < queue.length; i += CONCURRENCY) {
        await Promise.all(queue.slice(i, i + CONCURRENCY).map(async (item) => {
          try {
            const buf = await item.file.arrayBuffer(); const audioBuf = await audioContextRef.current.decodeAudioData(buf);
            audioBuffersRef.current.set(item.key, audioBuf);
          } catch (e) {} finally { setLoadingProgress(Math.round(((i) / queue.length) * 100)); }
        }));
      }
      
      let calculatedMaxDuration = parsed.totalTime;
      parsed.objects.forEach(obj => {
          const filename = parsed.header.wavs[obj.value];
          if (filename) {
              const buffer = audioBuffersRef.current.get(filename.toLowerCase());
              if (buffer) { const endTime = obj.time + buffer.duration; if (endTime > calculatedMaxDuration) calculatedMaxDuration = endTime; }
          }
      });
      setDuration(calculatedMaxDuration); setParsedSong(parsed); setTotalNotes(parsed.totalNotes);
      setPlaybackTimeDisplay(0); pauseTimeRef.current = 0; setCombo(0); comboRef.current = 0;
      lastPlayedSoundPerLaneRef.current.fill(null); noteCountsRef.current.fill(0); setNoteCounts(new Array(8).fill(0));
      setCurrentMeasureLines([]);
      setCurrentMeasureNotes({ processed: 0, total: 0, average: parsed.avgDensity });
      setLoadingMessage('準備完了'); setIsLoading(false);
    } catch (e) { console.error(e); setIsLoading(false); }
  };

  const scheduleAudio = () => {
      if (!parsedSong || !isPlayingRef.current || !audioContextRef.current) return;
      const ctx = audioContextRef.current; const currentTime = ctx.currentTime; const scheduleUntil = currentTime + LOOKAHEAD; 
      let index = nextNoteIndexRef.current;
      const objects = displayObjects;
      
      activeNodesRef.current = activeNodesRef.current.filter(n => n.endTime > currentTime);
      const shortNodes = activeNodesRef.current.filter(n => !n.isLong);
      if (shortNodes.length > MAX_SHORT_POLYPHONY) {
          const sortedShorts = shortNodes.sort((a, b) => a.startTime - b.startTime);
          const toKill = sortedShorts.slice(0, shortNodes.length - MAX_SHORT_POLYPHONY);
          toKill.forEach(n => { try { n.node.stop(); } catch(e){} });
          const killedIds = new Set(toKill.map(n => n.id));
          activeNodesRef.current = activeNodesRef.current.filter(n => !killedIds.has(n.id));
      }
      setPolyphonyCount(activeNodesRef.current.length);
      while (index < objects.length) {
          const obj = objects[index];
          const absolutePlayTime = startTimeRef.current + obj.time;
          if (absolutePlayTime > scheduleUntil) break;
          if (absolutePlayTime < currentTime - 0.1) { index++; continue; }

          if (parsedSong.header.wavs[obj.value]) {
              const buffer = audioBuffersRef.current.get(parsedSong.header.wavs[obj.value].toLowerCase());
              if (buffer) {
                const isLong = buffer.duration > 10.0;
                let shouldPlay = true;
                if (obj.isNote && !playKeySoundsRef.current) shouldPlay = false;
                else if (!obj.isNote && !playBgSoundsRef.current) shouldPlay = false;
                if (isLong && !playLongAudioRef.current) shouldPlay = false;
                
                const isBgmMonitor = buffer.duration > 5.0 && !obj.isNote;
                const item = { 
                    id: Math.random(), 
                    name: obj.filename, 
                    startTime: obj.time, 
                    endTime: obj.time + buffer.duration, 
                    displayDuration: buffer.duration, 
                    isLong: isBgmMonitor, 
                    isMissing: false, 
                    isSkipped: false,
                    isMuted: !shouldPlay 
                };
                if (shouldPlay) {
                    const src = ctx.createBufferSource();
                    src.buffer = buffer; src.connect(gainNodeRef.current);
                    if (absolutePlayTime >= currentTime) src.start(absolutePlayTime);
                    else { const offset = currentTime - absolutePlayTime;
                    if (offset < buffer.duration) src.start(currentTime, offset); }
                    
                    const endTime = absolutePlayTime + buffer.duration;
                    const nodeData = { node: src, startTime: absolutePlayTime, endTime: endTime, isLong: isLong, id: item.id };
                    activeNodesRef.current.push(nodeData);
                }

                if (shouldPlay || showMutedMonitorRef.current) {
                    if (isBgmMonitor) { 
                        activeLongSoundsRef.current.push(item);
                        setBackingTracks(prev => [...prev, item]); 
                    }
                    else { 
                        activeShortSoundsRef.current.push(item);
                    }
                }
              }
          }
          if (obj.isNote) {
               const hitTime = Math.max(currentTime, absolutePlayTime);
               const buffer = obj.laneIndex === 0 ? scratchHitSoundBufferRef.current : keyHitSoundBufferRef.current;
               
               if (buffer) {
                   const src = ctx.createBufferSource();
                   src.buffer = buffer;
                   const gain = ctx.createGain(); 
                   gain.gain.value = 0.6 * hitSoundVolumeRef.current;
                   src.connect(gain); 
                   gain.connect(gainNodeRef.current); 
                   src.start(hitTime);
               }
          }
          index++;
      }
      nextNoteIndexRef.current = index;
  };
  
  const startPlayback = () => {
    if (!parsedSong || isLoading) return;
    if (!parsedSong.isSupportedMode) {
        setTimeout(() => alert("未実装：この形式（5/7鍵盤以外）のBMS再生はサポートされていません。"), 10);
        return;
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
    
    stopAudioNodes(); activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]);
    const offset = pauseTimeRef.current; startTimeRef.current = audioContextRef.current.currentTime - offset;
    setIsPlaying(true); lastFrameTimeRef.current = performance.now();
    nextNoteIndexRef.current = findStartIndex(displayObjects, offset - (parsedSong.maxLNDuration || 20.0));
    nextBackBgaIndexRef.current = 0;
    nextLayerBgaIndexRef.current = 0; nextPoorBgaIndexRef.current = 0;

    if (showReady && offset === 0) {
        setReadyAnimState('READY');
        setTimeout(() => setReadyAnimState('GO'), 1000); setTimeout(() => setReadyAnimState(null), 1800); 
        if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = setInterval(scheduleAudio, SCHEDULE_INTERVAL);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(renderLoop);
    } else {
        setReadyAnimState(null);
        if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = setInterval(scheduleAudio, SCHEDULE_INTERVAL);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(renderLoop);
    }
    
    if (parsedSong.backBgaObjects) {
        for (let i=0; i < parsedSong.backBgaObjects.length; i++) {
            if (parsedSong.backBgaObjects[i].time >= offset) { nextBackBgaIndexRef.current = i; break; }
            const obj = parsedSong.backBgaObjects[i];
            if (parsedSong.header.bmps[obj.value]) { 
                const asset = imageAssetsRef.current.get(parsedSong.header.bmps[obj.value].toLowerCase());
                if(asset) {
                    if (asset.type === 'video') {
                        setCurrentBackBga({ ...asset, startTime: obj.time });
                    } else {
                        setCurrentBackBga(asset);
                    }
                }
            }
        }
    }
    if (parsedSong.layerBgaObjects) {
        for (let i=0; i < parsedSong.layerBgaObjects.length; i++) {
             if (parsedSong.layerBgaObjects[i].time >= offset) { nextLayerBgaIndexRef.current = i; break; }
             const obj = parsedSong.layerBgaObjects[i];
             if (parsedSong.header.bmps[obj.value]) { 
                 const asset = imageAssetsRef.current.get(parsedSong.header.bmps[obj.value].toLowerCase());
                 if(asset) {
                    if (asset.type === 'video') {
                        setCurrentLayerBga({ ...asset, startTime: obj.time });
                    } else {
                        setCurrentLayerBga(asset);
                    }
                 }
             } 
             else if (obj.value === 0) setCurrentLayerBga(null);
        }
    }
    if (parsedSong.poorBgaObjects) {
        for (let i=0; i < parsedSong.poorBgaObjects.length; i++) {
            if (parsedSong.poorBgaObjects[i].time >= offset) { nextPoorBgaIndexRef.current = i; break; }
            const obj = parsedSong.poorBgaObjects[i];
            if (parsedSong.header.bmps[obj.value]) { 
                const asset = imageAssetsRef.current.get(parsedSong.header.bmps[obj.value].toLowerCase());
                if(asset) {
                    if (asset.type === 'video') {
                        setCurrentPoorBga({ ...asset, startTime: obj.time });
                    } else {
                        setCurrentPoorBga(asset);
                    }
                }
            }
        }
    }
  };

  const stopAudioNodes = () => {
      activeNodesRef.current.forEach(n => { 
          try { n.node.stop(); n.node.disconnect(); } catch(e){} 
      });
      activeNodesRef.current = [];
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
  };

  const pausePlayback = () => {
    setIsPlaying(false); stopAudioNodes();
    pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
    setReadyAnimState(null);
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
    if (isInputDebugModeRef.current) requestAnimationFrame(renderLoop);
  };

  const stopPlayback = (reset = true) => {
    const wasPlaying = isPlayingRef.current;
    setIsPlaying(false); 
    stopAudioNodes();
    if (reset) {
        if (wasPlaying && showAbortedMonitorRef.current) {
            const currentTime = pauseTimeRef.current > 0 ? pauseTimeRef.current : playbackTimeDisplay;
            setBackingTracks(prev => prev.map(t => {
                if (t.endTime > currentTime) { return { ...t, isAborted: true }; }
                return t;
            }));
            activeLongSoundsRef.current.forEach(t => { if (t.endTime > currentTime) t.isAborted = true; });
        } else {
            setBackingTracks([]); activeLongSoundsRef.current = [];
        }

        pauseTimeRef.current = 0; setPlaybackTimeDisplay(0); setCombo(0); comboRef.current = 0;
        lastPlayedSoundPerLaneRef.current.fill(null); noteCountsRef.current.fill(0); setNoteCounts(new Array(8).fill(0));
        if (parsedSong) displayObjects.forEach(o => o.processed = false);
        setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: parsedSong?.avgDensity || 0 });
        currentMeasureRef.current = -1; setRealtimeBpm(parsedSong?.header.bpm || 130); setReadyAnimState(null);
        setCurrentLayerBga(null); setCurrentPoorBga(null); setShowMissLayer(false); setNextBpmInfo(null);
        scratchAngleRef.current = 0; lastScratchTimeRef.current = 0; lastScratchTypeRef.current = 'REVERSE';
        scratchDirectionRef.current = -1;
        activeInputLanesRef.current.clear(); isShiftHeldRef.current = false; isCtrlHeldRef.current = false;
        if (parsedSong?.header.stagefile) { 
            const asset = imageAssetsRef.current.get(parsedSong.header.stagefile.toLowerCase());
            if (asset && asset.type !== 'video') setCurrentBackBga(asset); 
            else setCurrentBackBga(null);
        } else { 
            setCurrentBackBga(null);
        }
    } else {
        activeShortSoundsRef.current = [];
    }

    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
    longAudioProgressRefs.current.forEach(el => el.style.width = '0%');
    setTimeout(() => {
        if (isInputDebugModeRef.current || !animationRef.current) { lastFrameTimeRef.current = performance.now(); animationRef.current = requestAnimationFrame(renderLoop); }
    }, 0);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value); pauseTimeRef.current = val; setPlaybackTimeDisplay(val); setCombo(0);
    comboRef.current = 0;
    const targetObjects = displayObjects; for(const obj of targetObjects) obj.processed = obj.time < val;
    if (parsedSong) {
        const currentBar = parsedSong.barLines.find(b => b.time > val);
        const newMeasure = currentBar ? currentBar.measure - 1 : parsedSong.barLines.length - 1;
        const totalInMeasure = parsedSong.notesPerMeasure[newMeasure] || 0;
        const mStart = parsedSong.barLines[newMeasure]?.time || 0; const mEnd = parsedSong.barLines[newMeasure+1]?.time || 99999;
        const processedInMeasure = displayObjects.filter(o => o.isNote && o.processed && o.time >= mStart && o.time < mEnd).length;
        setCurrentMeasureNotes({ processed: processedInMeasure, total: totalInMeasure, average: parsedSong.avgDensity });
        setBackingTracks([]); activeLongSoundsRef.current = [];
    }
    clearActiveLanes(); if (isPlaying) startPlayback();
    else requestAnimationFrame(renderLoop);
  };

  const renderLoop = () => {
    if (!canvasRef.current) return;
    const now = performance.now(); const dt = (now - lastFrameTimeRef.current) / 1000; lastFrameTimeRef.current = now;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) { canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr; ctx.scale(dpr, dpr); } 
    else ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const currentTime = isPlayingRef.current && audioContextRef.current ? audioContextRef.current.currentTime - startTimeRef.current : pauseTimeRef.current;
    if (parsedSong) {
        activeNodesRef.current = activeNodesRef.current.filter(n => n.endTime > currentTime);
        if (parsedSong.backBgaObjects && nextBackBgaIndexRef.current < parsedSong.backBgaObjects.length) {
            const bgaObj = parsedSong.backBgaObjects[nextBackBgaIndexRef.current];
            if (bgaObj.time <= currentTime) {
                const filename = parsedSong.header.bmps[bgaObj.value];
                if (filename) { 
                    const asset = imageAssetsRef.current.get(filename.toLowerCase());
                    if (asset) {
                         if (asset.type === 'video') setCurrentBackBga({ ...asset, startTime: bgaObj.time });
                        else setCurrentBackBga(asset);
                    }
                }
                nextBackBgaIndexRef.current++;
            }
        }
        if (parsedSong.layerBgaObjects && nextLayerBgaIndexRef.current < parsedSong.layerBgaObjects.length) {
            const bgaObj = parsedSong.layerBgaObjects[nextLayerBgaIndexRef.current];
            if (bgaObj.time <= currentTime) {
                if (bgaObj.value === 0) setCurrentLayerBga(null);
                else { 
                    const filename = parsedSong.header.bmps[bgaObj.value];
                    if (filename) { 
                        const asset = imageAssetsRef.current.get(filename.toLowerCase());
                        if (asset) {
                            if (asset.type === 'video') setCurrentLayerBga({ ...asset, startTime: bgaObj.time });
                            else setCurrentLayerBga(asset);
                        }
                    } 
                }
                nextLayerBgaIndexRef.current++;
            }
        }
        if (parsedSong.poorBgaObjects && nextPoorBgaIndexRef.current < parsedSong.poorBgaObjects.length) {
            const bgaObj = parsedSong.poorBgaObjects[nextPoorBgaIndexRef.current];
            if (bgaObj.time <= currentTime) {
                const filename = parsedSong.header.bmps[bgaObj.value];
                if (filename) { 
                    const asset = imageAssetsRef.current.get(filename.toLowerCase());
                    if (asset) {
                        if (asset.type === 'video') setCurrentPoorBga({ ...asset, startTime: bgaObj.time });
                        else setCurrentPoorBga(asset);
                    }
                }
                nextPoorBgaIndexRef.current++;
            }
        }

        if (now - lastStateUpdateRef.current > 50) { 
            setPlaybackTimeDisplay(currentTime);
            const currentBar = parsedSong.barLines.find(b => b.time > currentTime);
            const newMeasure = currentBar ? currentBar.measure - 1 : parsedSong.barLines.length - 1;
            if (newMeasure !== currentMeasureRef.current) {
                currentMeasureRef.current = newMeasure;
                setCurrentMeasure(newMeasure);
                if (parsedSong.rawLinesByMeasure[newMeasure]) setCurrentMeasureLines(parsedSong.rawLinesByMeasure[newMeasure].map(l => ({ text: l, isCurrent: true })));
                else setCurrentMeasureLines([]);
                const totalInMeasure = parsedSong.notesPerMeasure[newMeasure] || 0;
                const mStart = parsedSong.barLines[newMeasure]?.time || 0; const mEnd = parsedSong.barLines[newMeasure+1]?.time || 99999;
                const processedInMeasure = displayObjects.filter(o => o.isNote && o.processed && o.time >= mStart && o.time < mEnd).length;
                setCurrentMeasureNotes({ processed: processedInMeasure, total: totalInMeasure, average: parsedSong.avgDensity });
            } else {
                const mStart = parsedSong.barLines[newMeasure]?.time || 0; const mEnd = parsedSong.barLines[newMeasure+1]?.time || 99999;
                const processedInMeasure = displayObjects.filter(o => o.isNote && o.processed && o.time >= mStart && o.time < mEnd).length;
                setCurrentMeasureNotes(prev => ({ ...prev, processed: processedInMeasure }));
            }
            
            const currentBpmVal = getBpmFromTime(parsedSong.timePoints, currentTime);
            setRealtimeBpm(currentBpmVal);
            const futureTime = currentTime + 2.0; 
            const nextTp = parsedSong.timePoints.find(tp => tp.time > currentTime && tp.time <= futureTime && tp.bpm !== currentBpmVal);
            setNextBpmInfo(nextTp ? { value: nextTp.bpm, direction: nextTp.bpm > currentBpmVal ? 'up' : 'down', old: currentBpmVal } : null);
            lastStateUpdateRef.current = now;
            
            activeLongSoundsRef.current = activeLongSoundsRef.current.filter(s => {
                if (s.isAborted) return true; 
                return currentTime < s.endTime;
            });
            const visibleTracks = activeLongSoundsRef.current.filter(s => s.isAborted || s.startTime <= currentTime);
            if (visibleTracks.length !== backingTracks.length || (visibleTracks.length > 0 && visibleTracks[0].id !== backingTracks[0].id) || (visibleTracks.length > 0 && visibleTracks[visibleTracks.length-1].id !== backingTracks[backingTracks.length-1]?.id)) {
                setBackingTracks([...visibleTracks]);
            }
            
            activeLongSoundsRef.current.forEach(s => {
                const ref = longAudioProgressRefs.current.get(s.id);
                if (ref && !s.isAborted) {
                    const duration = s.displayDuration || 1; const elapsed = currentTime - s.startTime;
                    const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));
                    ref.style.width = `${progress}%`;
                }
            });
        }

        const isFinished = currentTime > duration + 0.5 && activeNodesRef.current.length === 0;
        if (isFinished && isPlayingRef.current) { stopPlayback(true); return; }
    }

    const width = rect.width;
    const height = rect.height;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    const KEY_W = Math.min(40, width / 12);
    const SCRATCH_W = KEY_W * 1.5;
    const BOARD_W = SCRATCH_W + (KEY_W * 7) + 10;
    const BOARD_X = (width - BOARD_W) / 2;
    
    const visMode = visibilityModeRef.current;
    const isLiftEnabled = visMode === VISIBILITY_MODES.LIFT || visMode === VISIBILITY_MODES.LIFT_SUD_PLUS;
    const liftOffset = isLiftEnabled ? liftValRef.current : 0;
    const BASE_JUDGE_Y = height - 100;
    const JUDGE_Y = BASE_JUDGE_Y - liftOffset;

    const is2P = playSide === '2P';
    const SCRATCH_X = is2P ? BOARD_X + (KEY_W * 7) + 10 : BOARD_X; const KEYS_X = is2P ? BOARD_X : BOARD_X + SCRATCH_W + 10;

    ctx.fillStyle = '#020617';
    ctx.fillRect(BOARD_X, 0, BOARD_W, height); 
    
    for(let i=0; i<7; i++) { 
        const laneHeight = isLiftEnabled ? JUDGE_Y : height;
        ctx.fillStyle = [1,3,5].includes(i) ? '#0f172a' : '#1e293b'; 
        ctx.fillRect(KEYS_X + i * KEY_W, 0, KEY_W, laneHeight);
    }
    
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1; ctx.beginPath();
    for(let i=0; i<=7; i++) { 
        const x = KEYS_X + i * KEY_W;
        ctx.moveTo(x, 0); ctx.lineTo(x, isLiftEnabled ? JUDGE_Y : height); 
    }
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(SCRATCH_X, 0, SCRATCH_W, isLiftEnabled ? JUDGE_Y : height);
    
    ctx.moveTo(SCRATCH_X, 0);
    ctx.lineTo(SCRATCH_X, isLiftEnabled ? JUDGE_Y : height); 
    ctx.moveTo(SCRATCH_X + SCRATCH_W, 0); ctx.lineTo(SCRATCH_X + SCRATCH_W, isLiftEnabled ? JUDGE_Y : height);
    ctx.stroke();
    if (!showSettings && parsedSong) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(BOARD_X, JUDGE_Y); ctx.lineTo(BOARD_X + BOARD_W, JUDGE_Y); ctx.stroke();
    }

    const currentActiveLanes = new Array(8).fill(false);
    let hitsThisFrame = new Array(8).fill(0);

    if (parsedSong) {
        const currentBeat = getBeatFromTime(parsedSong.timePoints, currentTime);
        const visibleDuration = 4.0 / hiSpeedRef.current; const visibleEndBeat = currentBeat + visibleDuration;

        ctx.strokeStyle = '#64748b'; ctx.textAlign = 'left';
        ctx.font = '10px Arial';
        for(const bar of parsedSong.barLines) {
            if (bar.beat < currentBeat - 0.5) continue;
            if (bar.beat > visibleEndBeat) break;
            const y = JUDGE_Y - ((bar.beat - currentBeat) / visibleDuration * BASE_JUDGE_Y);
            if (y < -10) continue;
            ctx.beginPath(); ctx.moveTo(BOARD_X, y); ctx.lineTo(BOARD_X + BOARD_W, y);
            ctx.stroke();
            ctx.fillStyle = '#94a3b8'; ctx.fillText(`#${bar.measure}`, BOARD_X + BOARD_W + 5, y + 3);
        }
        
        let startIndex = findStartIndex(displayObjects, currentTime - (parsedSong.maxLNDuration || 10.0));
        for (let i = startIndex; i < displayObjects.length; i++) {
            const obj = displayObjects[i];
            if (obj.beat > visibleEndBeat) break; if (!obj.isNote) continue;
            let x, w; if (obj.laneIndex === 0) { x = SCRATCH_X;
            w = SCRATCH_W; } else { x = KEYS_X + (obj.laneIndex - 1) * KEY_W; w = KEY_W;
            }
            const beatDelta = obj.beat - currentBeat;
            const timeDelta = obj.time - currentTime;
            
            if (!obj.processed) {
                if (timeDelta <= 0 && timeDelta > -0.03) {
                    obj.processed = true;
                    comboRef.current++; noteCountsRef.current[obj.laneIndex]++; hitsThisFrame[obj.laneIndex] = 1; lastPlayedSoundPerLaneRef.current[obj.laneIndex] = obj.filename;
                    if (obj.laneIndex === 0) {
                        let dist = 999;
                        for(let k = i + 1; k < displayObjects.length; k++) {
                            const nextObj = displayObjects[k];
                            if (nextObj.laneIndex === 0) { dist = nextObj.time - obj.time; break; }
                            if (nextObj.time - obj.time > 5.0) break;
                        }
                        if (dist < 0.6) { lastScratchTypeRef.current = 'ACCEL';
                        scratchDirectionRef.current = scratchDirectionRef.current * -1; } 
                        else { lastScratchTypeRef.current = 'REVERSE';
                        scratchDirectionRef.current = -1; }
                        if (isPlayingRef.current) lastScratchTimeRef.current = now;
                    }
                }
                else if (timeDelta <= -0.2) {
                     obj.processed = true;
                     triggerMiss();
                }
            }

            const yBase = JUDGE_Y - (beatDelta / visibleDuration * BASE_JUDGE_Y);
            if (obj.type === 'long') {
                const endBeatDelta = obj.endBeat - currentBeat;
                const yEnd = JUDGE_Y - (endBeatDelta / visibleDuration * BASE_JUDGE_Y);
                if (beatDelta <= 0 && endBeatDelta > 0) {
                    currentActiveLanes[obj.laneIndex] = true;
                    const grad = ctx.createLinearGradient(x, JUDGE_Y, x, 0); grad.addColorStop(0, `rgba(100, 200, 255, 0.3)`); grad.addColorStop(1, `rgba(0,0,0,0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, 0, w, JUDGE_Y);
                }
                const drawBottom = Math.min(JUDGE_Y, yBase);
                const drawTop = yEnd;
                if (drawTop <= height) {
                    const h = drawBottom - drawTop;
                    if (h > 0 && drawBottom > -50) { ctx.fillStyle = obj.laneIndex === 0 ? '#ef4444' : '#f59e0b';
                    ctx.fillRect(x + 1, drawTop, w - 2, h); }
                }
            } else {
                if (obj.processed) {
                    if (timeDelta > -0.05 && timeDelta > -0.2) { 
                        currentActiveLanes[obj.laneIndex] = true;
                        const alpha = 1.0 - (timeDelta / -0.05);
                        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`; ctx.fillRect(x, JUDGE_Y - 5, w, 10);
                        const grad = ctx.createLinearGradient(x, JUDGE_Y, x, JUDGE_Y - 200);
                        const color = obj.laneIndex === 0 ? '239, 68, 68' : '59, 130, 246'; 
                        grad.addColorStop(0, `rgba(${color}, ${alpha * 0.6})`); grad.addColorStop(1, `rgba(0,0,0,0)`);
                        ctx.fillStyle = grad;
                        ctx.fillRect(x, JUDGE_Y - 200, w, 200);
                    }
                    continue;
                }
                const y = yBase;
                const isScratch = obj.laneIndex === 0; const isBlue = [2,4,6].includes(obj.laneIndex);
                ctx.fillStyle = isScratch ? '#ef4444' : (isBlue ? '#3b82f6' : '#f1f5f9'); ctx.fillRect(x + 1, y - 6, w - 2, 12);
            }
        }
    }

    const isSudden = visMode === VISIBILITY_MODES.SUDDEN_PLUS || visMode === VISIBILITY_MODES.SUD_HID_PLUS || visMode === VISIBILITY_MODES.LIFT_SUD_PLUS;
    const isHidden = visMode === VISIBILITY_MODES.HIDDEN_PLUS || visMode === VISIBILITY_MODES.SUD_HID_PLUS;
    if (isSudden) {
        const h = suddenPlusValRef.current;
        ctx.fillStyle = '#000000';
        ctx.fillRect(BOARD_X, 0, BOARD_W, h);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(BOARD_X, h - 2, BOARD_W, 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`SUDDEN+ (${h})`, BOARD_X + BOARD_W/2, h - 10);
    }

    if (isHidden) {
        const h = hiddenPlusValRef.current;
        const yPos = JUDGE_Y - h;
        ctx.fillStyle = '#000000';
        ctx.fillRect(BOARD_X, yPos, BOARD_W, h);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(BOARD_X, yPos, BOARD_W, 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`HIDDEN+ (${h})`, BOARD_X + BOARD_W/2, yPos + 15);
    }

    const safeDt = Math.min(dt, 0.1); 
    const baseSpeed = ((realtimeBpm || 130) / 60) * 135;
    const timeSinceLast = now - lastScratchTimeRef.current;
    const effectDuration = 200; 
    let speedMultiplier = 0;
    const sideFactor = playSideRef.current === '2P' ? -1 : 1;

    if (isInputDebugModeRef.current && (isShiftHeldRef.current || isCtrlHeldRef.current)) {
        if (isShiftHeldRef.current) {
            speedMultiplier = -1.0;
        } else if (isCtrlHeldRef.current) {
            speedMultiplier = 2.5;
        }
    } 
    else if (isPlayingRef.current) {
        if (currentActiveLanes[0]) {
             speedMultiplier = -1.0;
        } else if (timeSinceLast < effectDuration) {
             if (lastScratchTypeRef.current === 'ACCEL') {
                 speedMultiplier = 1.5 * scratchDirectionRef.current;
             } else {
                 speedMultiplier = -1.0;
             }
        } else {
             speedMultiplier = 1.0;
        }
    }
    else {
        speedMultiplier = 1.0;
    }
    
    if (!scratchRotationEnabledRef.current && Math.abs(speedMultiplier) === 1.0) {
        if (!currentActiveLanes[0] && timeSinceLast >= effectDuration && !isShiftHeldRef.current) {
             speedMultiplier = 0;
        }
    }

    scratchAngleRef.current += baseSpeed * speedMultiplier * sideFactor * safeDt;
    const scratchCtrl = controllerRefs.current[0];
    if (scratchCtrl) scratchCtrl.style.transform = `rotate(${scratchAngleRef.current}deg)`;

    for(let lane=0; lane<8; lane++) { setLaneActive(lane, currentActiveLanes[lane] || activeInputLanesRef.current.has(lane));
    }
    if (hitsThisFrame.some(v => v > 0)) { setCombo(comboRef.current); setNoteCounts([...noteCountsRef.current]);
    }

    if (showReady && readyAnimStateRef.current) {
        ctx.save(); ctx.translate(width/2, height/2);
        if (readyAnimStateRef.current === 'GO') {
             ctx.shadowColor = '#ff0000';
             ctx.shadowBlur = 30; ctx.fillStyle = '#ff3333'; ctx.font = 'bold italic 80px sans-serif';
             ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
             ctx.fillText("GO!!", 0, 0);
        } else {
             ctx.shadowColor = '#00ccff';
             ctx.shadowBlur = 20; ctx.fillStyle = '#ffffff'; ctx.font = 'bold italic 60px sans-serif';
             ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
             ctx.fillText("READY...", 0, 0);
        }
        ctx.restore();
    }

    if (isPlayingRef.current || showReady || isInputDebugModeRef.current) { animationRef.current = requestAnimationFrame(renderLoop);
    } 
    else { animationRef.current = null; }
  };

  const is2P = playSide === '2P';
  return (
    <div className={`flex flex-col h-screen bg-neutral-950 text-white font-sans overflow-hidden ${isDragOver ? 'ring-4 ring-blue-500' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <div className="bg-[#080808] w-[700px] border-2 border-blue-900/50 shadow-2xl p-6 relative text-blue-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 relative z-50">
                     <div className="text-2xl font-bold text-blue-400 flex items-center gap-2"><Settings /> 設定</div>
                    <button onClick={() => setShowSettings(false)} className="text-blue-400 hover:text-white transition absolute right-0 top-0 z-50 p-2"><X size={28} /></button>
                </div>
                <div className="flex flex-col gap-6">
                     {/* LANE COVER SETTINGS */}
                    <div className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 relative">
                        <div className="text-xs text-blue-400 mb-3 font-bold uppercase tracking-wider border-b border-blue-900/30 pb-2 flex items-center gap-2">
                            <ChevronsUp size={14} /> 譜面の表示エリア (LANE COVER)
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-3 gap-2">
                                 {[
                                    { mode: VISIBILITY_MODES.OFF, label: 'OFF' },
                                    { mode: VISIBILITY_MODES.SUDDEN_PLUS, label: 'SUDDEN+' },
                                    { mode: VISIBILITY_MODES.HIDDEN_PLUS, label: 'HIDDEN+' },
                                    { mode: VISIBILITY_MODES.SUD_HID_PLUS, label: 'SUD+ & HID+' },
                                     { mode: VISIBILITY_MODES.LIFT, label: 'LIFT' },
                                    { mode: VISIBILITY_MODES.LIFT_SUD_PLUS, label: 'LIFT & SUD+' }
                                 ].map(opt => (
                                    <button 
                                        key={opt.mode}
                                        onClick={() => setVisibilityMode(opt.mode)}
                                        className={`py-2 px-3 text-xs font-bold rounded border transition-all ${visibilityMode === opt.mode 
                                            ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_10px_rgba(234,88,12,0.5)]' 
                                            : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                                    >
                                         {opt.label}
                                    </button>
                                ))}
                             </div>
                            
                             <div className="flex flex-col gap-2 mt-1 bg-black/20 p-2 rounded">
                                {(visibilityMode === VISIBILITY_MODES.SUDDEN_PLUS || visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS || visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-blue-300 w-16">SUDDEN+</span>
                                        <input type="range" min="0" max="1000" value={suddenPlusVal} onChange={e => setSuddenPlusVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                        <span className="text-[10px] font-mono w-8 text-right">{suddenPlusVal}</span>
                                    </div>
                                 )}
                                {(visibilityMode === VISIBILITY_MODES.HIDDEN_PLUS || visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-blue-300 w-16">HIDDEN+</span>
                                         <input type="range" min="0" max="1000" value={hiddenPlusVal} onChange={e => setHiddenPlusVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                        <span className="text-[10px] font-mono w-8 text-right">{hiddenPlusVal}</span>
                                     </div>
                                )}
                                {(visibilityMode === VISIBILITY_MODES.LIFT || visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) && (
                                     <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-blue-300 w-16">LIFT</span>
                                         <input type="range" min="0" max="500" value={liftVal} onChange={e => setLiftVal(Number(e.target.value))} className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                                        <span className="text-[10px] font-mono w-8 text-right">{liftVal}</span>
                                     </div>
                                )}
                                {visibilityMode === VISIBILITY_MODES.OFF && <span className="text-[10px] text-gray-500 text-center italic py-1">表示オプションなし</span>}
                             </div>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                         <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex justify-between items-center">
                             <span className="font-bold text-sm text-blue-300">プレイサイド</span>
                             <button onClick={() => setPlaySide(p => p==='1P'?'2P':'1P')} className="bg-blue-600/20 border border-blue-500/50 px-6 py-1 text-blue-100 hover:bg-blue-600/40 transition rounded w-32 font-mono">{playSide}</button>
                          </div>
                         <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex flex-col gap-2 relative">
                             <div className="flex justify-between items-center">
                                  <span className="font-bold text-sm text-blue-300">レーンオプション</span>
                                 <div className="flex items-center gap-2">
                                     <div className="relative bg-blue-600/20 border border-blue-500/50 rounded hover:bg-blue-600/30 transition">
                                          <select value={playOption} onChange={e => setPlayOption(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full">
                                            <option value="OFF" className="bg-black text-white">正規 (OFF)</option><option value="MIRROR" className="bg-black text-white">MIRROR</option>
                                             <option value="RANDOM" className="bg-black text-white">RANDOM</option><option value="R-RANDOM" className="bg-black text-white">R-RANDOM</option>
                                            <option value="S-RANDOM" className="bg-black text-white">S-RANDOM</option>
                                          </select>
                                         <div className="px-4 py-1 text-blue-100 font-bold flex items-center gap-2 min-w-[140px] justify-between">{playOption}</div>
                                      </div>
                                     <button onClick={refreshRandom} className="bg-blue-600/20 border border-blue-500/50 p-1 text-blue-300 hover:text-white hover:bg-blue-600/40 active:scale-95 transition rounded"><RotateCw size={20} /></button>
                                   </div>
                             </div>
                             <div className="text-[10px] font-mono text-blue-400/70 text-right tracking-widest">
                                  {currentLaneOrder.join(' ')}
                             </div>
                         </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex justify-between items-center">
                             <span className="font-bold text-sm text-blue-300">コンボ表示位置</span>
                             <div className="relative bg-blue-600/20 border border-blue-500/50 rounded hover:bg-blue-600/30 transition">
                                  <select value={comboPos} onChange={e => setComboPos(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full">
                                     <option value="CENTER" className="bg-black text-white">中央 (CENTER)</option><option value="LEFT" className="bg-black text-white">左側 (LEFT)</option><option value="OFF" className="bg-black text-white">非表示 (OFF)</option>
                                  </select>
                                 <div className="px-3 py-1 text-blue-100 text-sm min-w-[100px] text-center">{comboPos}</div>
                             </div>
                         </div>
                         <div className="flex-1 border border-blue-900/50 p-3 bg-[#0f172a] rounded-lg flex flex-col gap-2">
                             <div className="flex justify-between items-center relative">
                                  <span className="font-bold text-sm text-blue-300">鍵盤 打鍵音</span>
                                 <div className="flex items-center gap-2">
                                     <div className="text-blue-400 text-sm underline cursor-pointer relative hover:text-blue-200 transition max-w-[100px] truncate">
                                         {customKeyHitSound ? '設定済み' : 'デフォルト'}
                                         <input type="file" accept="audio/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleKeyHitSoundUpload} />
                                     </div>
                                      {customKeyHitSound && <button onClick={handleKeyHitSoundReset} className="text-blue-400 hover:text-white"><RefreshCcw size={14} /></button>}
                                 </div>
                             </div>
                             <div className="flex justify-between items-center relative border-t border-blue-900/20 pt-1">
                                 <span className="font-bold text-sm text-blue-300 flex items-center gap-1"><Disc size={12}/> 皿 打鍵音</span>
                                  <div className="flex items-center gap-2">
                                     <div className="text-blue-400 text-sm underline cursor-pointer relative hover:text-blue-200 transition max-w-[100px] truncate">
                                         {customScratchHitSound ? '設定済み' : 'デフォルト'}
                                         <input type="file" accept="audio/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleScratchHitSoundUpload} />
                                     </div>
                                      {customScratchHitSound && <button onClick={handleScratchHitSoundReset} className="text-blue-400 hover:text-white"><RefreshCcw size={14} /></button>}
                                 </div>
                             </div>
                          </div>
                    </div>
                    <details className="bg-[#0f172a] p-4 rounded-lg border border-blue-900/50 mt-2 group" open>
                        <summary className="text-xs text-blue-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer list-none">
                            <span>サウンド・表示設定</span>
                            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-900 scrollbar-track-black/20">
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                                <span className="text-sm text-blue-300">マスター音量</span>
                                 <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                            </div>
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                                  <span className="text-sm text-blue-300">モニター更新間隔 ({monitorUpdateInterval}ms)</span>
                                <input type="range" min="10" max="1000" step="10" value={monitorUpdateInterval} onChange={e => setMonitorUpdateInterval(Number(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                            </div>
                             <label className={`flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer transition border border-transparent ${!hasVideo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/40 hover:border-blue-500/30'}`}>
                                <div className="flex items-center gap-3"><Film className="text-blue-400" size={18}/><span className="text-sm">BGA動画を再生</span></div>
                                <input type="checkbox" checked={playBgaVideo} onChange={e=>setPlayBgaVideo(e.target.checked)} disabled={!hasVideo} className="accent-blue-500"/>
                             </label>
                            <div className="border-t border-blue-900/30 my-2"></div>
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                                 <span className="text-sm text-blue-300">打鍵音の音量</span>
                                <input type="range" min="0" max="2" step="0.1" value={hitSoundVolume} onChange={e => setHitSoundVolume(parseFloat(e.target.value))} className="w-32 accent-blue-500 cursor-pointer"/>
                            </div>
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Flag className="text-blue-400" size={18}/><span className="text-sm">開始時のREADY演出</span></div>
                                <input type="checkbox" checked={showReady} onChange={e=>setShowReady(e.target.checked)} className="accent-blue-500"/>
                             </label>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Music className="text-blue-400" size={18}/><span className="text-sm">キー音を再生</span></div>
                                 <input type="checkbox" checked={playKeySounds} onChange={e=>setPlayKeySounds(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Layers className="text-blue-400" size={18}/><span className="text-sm">BGMを再生</span></div>
                                <input type="checkbox" checked={playLongAudio} onChange={e=>setPlayLongAudio(e.target.checked)} className="accent-blue-500"/>
                             </label>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Speaker className="text-blue-400" size={18}/><span className="text-sm">バックサウンドを再生</span></div>
                                 <input type="checkbox" checked={playBgSounds} onChange={e=>setPlayBgSounds(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            <div className="border-t border-blue-900/30 my-2"></div>
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><EyeOff className="text-blue-400" size={18}/><span className="text-sm">ミュート音源をモニターに表示</span></div>
                                <input type="checkbox" checked={showMutedMonitor} onChange={e=>setShowMutedMonitor(e.target.checked)} className="accent-blue-500"/>
                               </label>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><FileX className="text-blue-400" size={18}/><span className="text-sm">停止時に音源情報を残す</span></div>
                                 <input type="checkbox" checked={showAbortedMonitor} onChange={e=>setShowAbortedMonitor(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            <div className="border-t border-blue-900/30 my-2"></div>
                             <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><RotateCw className="text-blue-400" size={18}/><span className="text-sm">スクラッチの定常回転</span></div>
                                 <input type="checkbox" checked={scratchRotationEnabled} onChange={e=>setScratchRotationEnabled(e.target.checked)} className="accent-blue-500"/>
                            </label>
                            <div className="border-t border-blue-900/30 my-2"></div>
                            <label className="flex items-center justify-between bg-black/20 p-2 rounded cursor-pointer hover:bg-black/40 transition border border-transparent hover:border-blue-500/30">
                                <div className="flex items-center gap-3"><Keyboard className="text-red-400" size={18}/><span className="text-sm font-bold text-red-200">デバッグ用キー入力</span></div>
                                <input type="checkbox" checked={isInputDebugMode} onChange={e=>setIsInputDebugMode(e.target.checked)} className="accent-red-500"/>
                             </label>
                        </div>
                    </details>
                </div>
            </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden bg-neutral-950">
         <div className="w-64 flex flex-col border-r border-blue-900/30 bg-[#080808] p-2 gap-2 shrink-0 overflow-y-auto scrollbar-hide text-blue-100">
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center gap-1"><Gamepad2 size={10}/> CONTROLLER</div>
                <div className={`relative h-48 bg-black rounded border border-blue-900/30 shadow-inner transform transition-transform`}>
                    <div ref={el => controllerRefs.current[0] = el} className={`absolute top-2 ${is2P ? 'right-2' : 'left-2'} w-20 h-20 rounded-full border-4 border-[#1e293b] bg-neutral-900 shadow flex items-center justify-center z-20 overflow-hidden`}>
                         <div className="absolute w-full h-0.5 bg-gray-700/50 rotate-0"></div><div className="absolute w-full h-0.5 bg-gray-700/50 rotate-45"></div>
                         <div className="absolute w-full h-0.5 bg-gray-700/50 rotate-90"></div><div className="absolute w-full h-0.5 bg-gray-700/50 rotate-135"></div>
                          <div className="absolute w-16 h-16 rounded-full border border-gray-600/30"></div><span className="text-[9px] text-blue-500/50 font-bold relative z-10">SCR</span>
                    </div>
                    <div className={`absolute top-4 ${is2P ? 'left-4' : 'left-28'} flex gap-2 transition-all`}>
                        {[2,4,6].map(i => (<div key={i} className="flex flex-col items-center"><div className="text-[9px] text-blue-400/70 mb-1 font-mono">{noteCounts[i]}</div><div ref={el => controllerRefs.current[i] = el} className="w-5 h-16 bg-black border border-blue-900/50 rounded-sm transition-transform duration-75 shadow-[0_0_10px_rgba(0,0,0,0.5)]" /></div>))}
                    </div>
                    <div className={`absolute top-24 ${is2P ? 'left-0' : 'left-24'} flex gap-2 transition-all`}>
                         {[1,3,5,7].map(i => (<div key={i} className="flex flex-col items-center"><div ref={el => controllerRefs.current[i] = el} className="w-6 h-14 bg-[#e2e8f0] border-b-4 border-[#94a3b8] rounded-sm transition-transform duration-75 shadow-[0_0_10px_rgba(255,255,255,0.1)]" /><div className="text-[9px] text-blue-400/70 mt-1 font-mono">{noteCounts[i]}</div></div>))}
                    </div>
                    <div className={`absolute top-24 ${is2P ? 'right-4' : 'left-4'} text-center w-16`}><div className="text-[9px] text-blue-400/70 mt-1 font-mono">{noteCounts[0]}</div></div>
                </div>
            </div>
            <div className="bg-[#112233]/50 rounded p-2 border border-blue-900/30">
                <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center gap-1"><Keyboard size={10}/> KEY MAPPING</div>
                <div className="flex flex-col gap-1 items-center">
                     <div className="flex gap-1 w-full justify-center">
                        <div ref={el=> keyboardRefs.current[KEY_CONFIG_ROWS[0][0].isScratch ? 0 : -1]=el} className={`${KEY_CONFIG_ROWS[0][0].width} h-8 bg-[#0f172a] border border-blue-900/40 rounded text-[10px] flex items-center justify-center text-blue-300 transition-all duration-75 shadow-sm border-red-900/50 text-red-300`}>{KEY_CONFIG_ROWS[0][0].label}</div>
                        {KEY_CONFIG_ROWS[0].slice(1).map((k, i) => (<div key={i} ref={el=> keyboardRefs.current[k.keyIndex]=el} className={`${k.width} h-8 bg-[#0f172a] border border-blue-900/40 rounded text-[10px] flex items-center justify-center text-blue-300 transition-all duration-75 shadow-sm`}>{k.label}</div>))}
                    </div>
                    <div className="flex gap-1 w-full justify-center">
                        <div className="w-14 h-8 invisible"></div>
                        {KEY_CONFIG_ROWS[1].slice(1).map((k, i) => (<div key={i} ref={el=> keyboardRefs.current[k.keyIndex]=el} className={`${k.width} h-8 bg-[#0f172a] border border-blue-900/40 rounded text-[10px] flex items-center justify-center text-blue-300 transition-all duration-75 shadow-sm`}>{k.label}</div>))}
                    </div>
                </div>
            </div>
            <div className="bg-[#0f172a] p-4 rounded mt-auto border border-blue-900/30 min-h-[120px] flex flex-col justify-center items-center text-center shadow-lg relative overflow-hidden group">
                 <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
                 {parsedSong ? (
                      <>
                        <div className="text-sm font-bold text-white break-words w-full leading-tight mb-1 drop-shadow-md">{parsedSong.header.title}</div>
                        <div className="text-xs text-blue-300 truncate w-full mb-3 opacity-80">{parsedSong.header.artist}</div>
                        <div className="flex flex-wrap justify-center gap-2 text-[10px] font-bold w-full">
                            <div className="bg-black/40 px-2 py-1 rounded border border-blue-500/20 flex-1 min-w-[60px]"><span className="text-blue-400 block text-[8px] leading-none mb-0.5">LEVEL</span><span className="text-white">{parsedSong.header.playlevel}</span></div>
                            <div className="bg-black/40 px-2 py-1 rounded border border-blue-500/20 flex-1 min-w-[60px]"><span className="text-blue-400 block text-[8px] leading-none mb-0.5">BPM</span><span className="text-white">{parsedSong.header.bpm}</span></div>
                         </div>
                        <div className={`mt-2 w-full text-center text-[10px] font-bold text-white py-0.5 rounded shadow-sm ${difficultyInfo.color}`}>{difficultyInfo.label}</div>
                      </>
                 ) : <span className="text-blue-500/50 text-xs">NO DATA LOADED</span>}
            </div>
         </div>

         <div className="w-64 flex flex-col border-r border-blue-900/30 bg-[#0a0a0a] p-2 gap-2 shrink-0">
            <div className="bg-[#112233] border border-blue-500/30 text-blue-100 p-2 rounded flex items-center gap-2 text-xs font-bold shrink-0 cursor-pointer hover:bg-[#1e3a5f] transition shadow-sm group" onClick={() => setShowSettings(true)}>
                 <Settings size={14} className="text-blue-400 group-hover:rotate-90 transition-transform duration-500"/>
                  <div className="flex-1 flex flex-col"><span className="text-blue-200 group-hover:text-white transition-colors">{playOption}</span><span className="text-[8px] text-blue-500/70 font-mono tracking-tighter mt-0.5">設定を開く</span></div>
            </div>
            <div className="aspect-video w-full bg-black border border-blue-900/30 flex items-center justify-center text-blue-900/50 text-xs shrink-0 overflow-hidden relative shadow-inner rounded-sm">
                <BgaLayer bgaState={currentBackBga} zIndex={0} isPlaying={isPlaying} currentTime={playbackTimeDisplay} isVideoEnabled={playBgaVideo} />
                <BgaLayer bgaState={currentLayerBga} zIndex={10} blendMode="screen" isPlaying={isPlaying} currentTime={playbackTimeDisplay} isVideoEnabled={playBgaVideo} />
                {showMissLayer && currentPoorBga ? (
                    <div className="absolute inset-0 w-full h-full z-50 bg-black flex items-center justify-center">
                        <BgaLayer bgaState={currentPoorBga} zIndex={50} isPlaying={isPlaying} currentTime={playbackTimeDisplay} isVideoEnabled={playBgaVideo} />
                    </div>
                ) : null}

                 {!currentBackBga && !currentLayerBga && !showMissLayer && <div className="flex flex-col items-center gap-1 z-0"><ImageIcon size={20} /><span className="text-[9px] font-bold tracking-wider">NO SIGNAL</span></div>}
                {readyAnimState === 'GO' && <div className="absolute inset-0 bg-white animate-ping opacity-20 pointer-events-none"></div>}
            </div>
            <div className="bg-[#050505] border border-blue-900/30 p-1 flex-1 min-h-0 overflow-hidden font-mono text-[9px] leading-tight text-blue-300/80 relative shadow-inner rounded-sm flex flex-col">
                 <div className="absolute top-0 right-0 bg-blue-900/20 text-blue-400 px-1 text-[8px] z-10">BMS MONITOR</div>
                <div className="mt-4 flex-1 overflow-hidden flex flex-col justify-center pb-1">
                    {currentMeasureLines.length > 0 ? <div className="flex flex-col gap-0.5">{currentMeasureLines.map((item, i) => (<div key={i} className={`truncate transition-all ${item.isCurrent ? 'text-yellow-300 bg-blue-900/20 font-bold scale-105 pl-1' : 'text-blue-500/50 blur-[0.5px]'}`}>{item.text}</div>))}</div> : <div className="text-center text-blue-900/50 italic">No Data</div>}
                </div>
            </div>
            <div className="bg-[#112233]/30 border border-blue-900/30 p-2 text-xs space-y-2 shrink-0 text-blue-200 font-mono rounded-sm">
                <div className="flex justify-between items-baseline border-b border-blue-900/30 pb-1"><span className="text-[10px] text-blue-400">COMBO</span><span className="text-xl font-bold text-white drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">{combo}</span></div>
                <div className="flex justify-between items-baseline"><span className="text-[10px] text-blue-400">NOTES</span><span><span className="text-white">{combo}</span> <span className="text-blue-500">/</span> {totalNotes}</span></div>
                <div className="flex justify-between items-baseline"><span className="text-[10px] text-blue-400">MEASURE</span><span><span className={`font-bold ${currentMeasureNotes.total >= currentMeasureNotes.average + 5 ? 'text-red-400' : 'text-white'}`}>{currentMeasureNotes.processed}</span><span className="text-blue-500/50 mx-1">/</span><span className={`font-bold ${currentMeasureNotes.total >= currentMeasureNotes.average + 5 ? 'text-red-400' : 'text-white'}`}>{currentMeasureNotes.total}</span></span></div>
                <div className="flex justify-between items-baseline"><span className="text-[10px] text-blue-400">BPM</span><div className="flex items-baseline gap-2">{nextBpmInfo && (<span className={`text-[10px] font-bold ${nextBpmInfo.direction === 'up' ? 'text-red-400' : 'text-blue-400'} animate-pulse`}>{nextBpmInfo.direction === 'up' ? '↑' : '↓'} {nextBpmInfo.value} <span className="text-gray-500">|</span> {nextBpmInfo.old}</span>)}<span className="text-red-400 font-bold text-lg">{Math.round(realtimeBpm)}</span></div></div>
                <div className="mt-2 text-[9px] text-blue-500/70 text-right">GREEN: {(4.0/hiSpeed).toFixed(2)}ms</div>
            </div>
         </div>

         <div className="flex-1 bg-black relative flex justify-center border-r border-blue-900/30 overflow-hidden">
            <canvas ref={canvasRef} className="h-full w-full max-w-[600px] shadow-[0_0_50px_rgba(0,0,0,0.5)]" />
            {!parsedSong && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-blue-900/20"><div className="text-center animate-pulse"><FolderOpen size={64} className="mx-auto mb-4 opacity-50"/><p className="text-xl font-bold tracking-widest">DROP FILE HERE</p></div></div>}
            {!showSettings && parsedSong && <div className="absolute bottom-[100px] w-full h-[2px] bg-red-500/60 pointer-events-none z-20 shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{maxWidth:'600px'}}/>}
         </div>

       <div className="w-60 flex flex-col bg-[#080808] p-2 gap-2 shrink-0 overflow-y-auto scrollbar-hide">
             <div className="bg-[#112233]/20 border border-blue-900/30 h-auto max-h-[25%] min-h-[60px] p-1 relative overflow-hidden flex flex-col shrink-0 rounded-sm">
                 <div className="text-[9px] font-bold mb-0.5 border-b border-blue-900/30 flex justify-between text-blue-300 px-1 shrink-0"><span>BACKING TRACK</span></div>
                 <div className="text-[8px] space-y-1 overflow-y-auto scrollbar-hide flex-1 font-mono px-1">
                     {backingTracks.map(s => (
                        <div key={s.id} className="flex flex-col mb-1">
                            <div className={`truncate flex items-center gap-1 leading-none py-[1px] ${s.isAborted ? 'text-red-500' : (s.isMuted ? 'text-gray-500' : 'text-blue-200')}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.isAborted ? 'bg-red-500' : (s.isSkipped ? 'bg-cyan-500' : (s.isMuted ? 'bg-gray-600' : 'bg-green-500'))} shrink-0 shadow-[0_0_5px_currentColor]`}/>{s.name}
                            </div>
                            <div className="h-[4px] bg-[#1e293b] w-full mt-[1px] overflow-hidden rounded-full relative">
                                <div className={`h-full absolute left-0 top-0 ${s.isAborted ? 'bg-red-500' : (s.isSkipped ? 'bg-cyan-400' : (s.isMuted ? 'bg-gray-500' : 'bg-green-400'))}`} ref={el => { if(el) longAudioProgressRefs.current.set(s.id, el); }} style={{width: '0%'}} />
                            </div>
                        </div>
                    ))}
                 </div>
              </div>
             <div className="bg-[#112233]/20 border border-blue-900/30 flex-1 p-2 relative overflow-hidden flex flex-col rounded-sm min-h-0">
                 <div className="text-[10px] font-bold mb-1 border-b border-blue-900/30 flex justify-between items-center text-blue-300 shrink-0">
                    <span>SOUND MONITOR</span>
                    <div className="flex gap-2">
                         <span className="text-blue-500/70 text-[8px]">M POLY: <span className="text-white">{maxPolyphonyCount}</span></span>
                        <span className="text-blue-500/70">POLY: <span className={`${polyphonyCount > averagePolyphony + 10 ? 'text-red-500' : 'text-white'}`}>{polyphonyCount}</span></span>
                    </div>
                 </div>
                 <div className="flex-1 overflow-hidden flex flex-col justify-end text-[9px] space-y-0.5 font-mono">
                    {activeShortSoundsRef.current.slice(-25).map(s => (
                         <div key={s.id} className={`truncate flex items-center gap-1 leading-none py-[1px] opacity-80 ${s.isMuted ? 'text-gray-600' : 'text-blue-100'}`}>
                            <span className={`w-1 h-1 rounded-full ${s.isSkipped ? 'bg-cyan-400' : (s.isMuted ? 'bg-gray-600' : 'bg-green-400')} shrink-0 shadow-[0_0_4px_currentColor]`}/>{s.name}
                        </div>
                     ))}
                 </div>
             </div>
             <div className="bg-[#0f172a] text-blue-100 p-2 h-48 shrink-0 text-[10px] font-mono border border-blue-900/50 flex flex-col justify-center rounded-sm shadow-lg">
                 <div className="border-b border-blue-900/30 mb-2 pb-1 text-center text-blue-400 font-bold text-[9px] tracking-widest">LANE LOG</div>
                 <div className="grid grid-cols-[20px_1fr] gap-x-2 gap-y-1">{[0,1,2,3,4,5,6,7].map(i => (<React.Fragment key={i}><div className="text-blue-500 text-right font-bold opacity-70">{i===0?'SC':`K${i}`}</div><div className="truncate text-yellow-100 leading-tight opacity-90">{lastPlayedSoundPerLaneRef.current[i] || '-'}</div></React.Fragment>))}</div>
             </div>
         </div>
      </div>

      <div className="h-14 bg-[#0f172a] border-t border-blue-900/30 flex items-center px-4 gap-4 shrink-0 text-blue-100 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-40">
          <div className="flex items-center gap-2">
              <label className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 shadow-lg rounded transition-all active:scale-95 font-bold bg-opacity-90 hover:bg-opacity-100"><FolderOpen size={14}/> フォルダを開く<input type="file" webkitdirectory="" multiple className="hidden" onChange={handleFileSelect} /></label>
              <div className="bg-[#1e293b] text-xs px-3 py-1.5 rounded border border-blue-900/30 flex items-center gap-2"><span className="text-blue-500 text-[10px] font-bold">FILE</span><select className="bg-transparent outline-none max-w-[150px] text-white font-bold" value={selectedBmsIndex} onChange={e => setSelectedBmsIndex(Number(e.target.value))}>{bmsList.length===0 && <option className="text-gray-500">なし</option>}{bmsList.map((b,i) => <option key={i} value={i} className="bg-[#0f172a] text-white">{b.name}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2 border-l border-blue-900/30 pl-4">
              <button onClick={() => stopPlayback(true)} className="p-1.5 hover:bg-white/10 rounded transition text-blue-300"><ChevronFirst size={20}/></button>
              <button onClick={isPlaying ? pausePlayback : startPlayback} className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg hover:shadow-blue-500/30 transition active:scale-95">{isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-0.5"/>}</button>
          </div>
          <div className="flex-1 h-2 bg-black/50 relative rounded-full group cursor-pointer overflow-hidden border border-blue-900/30"><div className="absolute inset-y-0 left-0 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{width: `${duration?(playbackTimeDisplay/duration)*100:0}%`}} /><input type="range" min="0" max={duration||100} step="0.01" value={playbackTimeDisplay} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/></div>
          <div className="flex items-center gap-2 bg-[#1e293b] px-3 py-1 rounded border border-blue-900/30"><span className="text-[10px] font-bold text-blue-500">HI-SPEED</span><input type="number" step="0.1" value={hiSpeed} onChange={e => setHiSpeed(Number(e.target.value))} className="w-10 bg-transparent outline-none text-center font-mono text-white text-sm font-bold"/></div>
           <div className="flex items-center gap-2 bg-[#1e293b] px-3 py-1 rounded border border-blue-900/30 group relative">
              {volume === 0 ? <VolumeX size={14} className="text-gray-500 cursor-pointer" onClick={toggleMute}/> : <Volume2 size={14} className="text-blue-500 cursor-pointer" onClick={toggleMute}/>}
              <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300 flex items-center">
                   <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-20 accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
              </div>
              <span className="text-[10px] font-mono text-blue-300 w-8 text-right">{Math.round(volume*100)}%</span>
          </div>

          <div className="flex flex-col items-end text-[10px] font-mono leading-tight text-blue-300/70 min-w-[80px]"><div>{playbackTimeDisplay.toFixed(2)} <span className="text-blue-500/50">/</span> {duration.toFixed(2)}</div></div>
      </div>
    </div>
  );
}