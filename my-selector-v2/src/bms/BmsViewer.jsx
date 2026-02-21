// src/bms/BmsViewer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FolderOpen, Settings, Play, Pause, ChevronFirst } from 'lucide-react';

import { LANE_MAP, VISIBILITY_MODES, LOOKAHEAD, SCHEDULE_INTERVAL, MAX_SHORT_POLYPHONY, MOBILE_BREAKPOINT, DEFAULT_BGA_OPACITY } from './constants';
import { findStartIndex, getBeatFromTime, getBpmFromTime, createHitSound, generateLaneMap, guessDifficulty, extractZipFiles, getBaseName, getFileName } from './logic/utils';
import { parseBMS } from './logic/parser';

import SettingsModal from './components/SettingsModal';
import ControllerPanel from './components/ControllerPanel';
import InfoPanel from './components/InfoPanel';
import LogPanel from './components/LogPanel';
import ControlBar from './components/ControlBar';
import BgaLayer from './components/BgaLayer';

export default function BmsViewer() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [bgaOpacity, setBgaOpacity] = useState(DEFAULT_BGA_OPACITY);
  
  // ボード全体の不透明度 (スマホデフォルト0 = BGA丸見え)
  const [boardOpacity, setBoardOpacity] = useState(window.innerWidth < MOBILE_BREAKPOINT ? 0.0 : 0.85);
  // 各レーンの不透明度 (スマホデフォルト0.3 = 薄い)
  const [laneOpacity, setLaneOpacity] = useState(window.innerWidth < MOBILE_BREAKPOINT ? 0.3 : 1.0);

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
  const [muteDebugAutoPlay, setMuteDebugAutoPlay] = useState(true); 
  const muteDebugAutoPlayRef = useRef(true);
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
  const isMobileRef = useRef(isMobile); 
  
  const boardOpacityRef = useRef(boardOpacity);
  const laneOpacityRef = useRef(laneOpacity);

  useEffect(() => { 
      const handleResize = () => {
          const mobile = window.innerWidth < MOBILE_BREAKPOINT;
          setIsMobile(mobile);
          isMobileRef.current = mobile;
          if (mobile) {
              setBoardOpacity(0.0);
              setLaneOpacity(0.3);
          } else {
              setBoardOpacity(0.85);
              setLaneOpacity(1.0);
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  useEffect(() => { boardOpacityRef.current = boardOpacity; }, [boardOpacity]); 
  useEffect(() => { laneOpacityRef.current = laneOpacity; }, [laneOpacity]);
  useEffect(() => { 
      isInputDebugModeRef.current = isInputDebugMode;
      if (isInputDebugMode && !animationRef.current) {
          lastFrameTimeRef.current = performance.now();
          animationRef.current = requestAnimationFrame(renderLoop);
      }
  }, [isInputDebugMode]);
  useEffect(() => { muteDebugAutoPlayRef.current = muteDebugAutoPlay; }, [muteDebugAutoPlay]);

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
            
              kbEl.style.transition = 'none';

              kbEl.style.backgroundColor = isScratch ? '#ef4444' : '#3b82f6';
              kbEl.style.color = '#ffffff';
              kbEl.style.borderColor = isScratch ? '#f87171' : '#60a5fa';
              kbEl.style.boxShadow = isScratch ? '0 0 10px #ef4444' : '0 0 10px #3b82f6';
          } else {

              kbEl.style.transition = 'none';

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
      if (volume > 0) { setLastVolume(volume); setVolume(0); } else { setVolume(lastVolume || 0.8); }
  };

  const resetGameStatus = () => {
    stopPlayback(true);
    if (audioContextRef.current) activeNodesRef.current.forEach(n => { try { n.node.stop(); n.node.disconnect(); } catch(e){} });
    activeNodesRef.current = []; activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]); imageAssetsRef.current.clear(); 
    setParsedSong(null); setDisplayObjects([]); setCurrentBackBga(null); setCurrentLayerBga(null); setCurrentPoorBga(null); setStageFileImage(null);
    setShowMissLayer(false); setNextBpmInfo(null); setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: 0 });
    scratchAngleRef.current = 0; lastFrameTimeRef.current = 0; lastScratchTimeRef.current = 0; lastScratchTypeRef.current = 'REVERSE'; scratchDirectionRef.current = -1;
    activeInputLanesRef.current.clear(); isShiftHeldRef.current = false; isCtrlHeldRef.current = false; setHasVideo(false); setPlayBgaVideo(true);
    setPolyphonyCount(0); setMaxPolyphonyCount(0); setAveragePolyphony(0); polyphonyHistoryRef.current = []; maxPolyRef.current = 0;
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
        switch(e.code) { case 'KeyZ': lane = 1; break; case 'KeyS': lane = 2; break; case 'KeyX': lane = 3; break; case 'KeyD': lane = 4; break; case 'KeyC': lane = 5; break; case 'KeyF': lane = 6; break; case 'KeyV': lane = 7; break; }
        if (lane !== -1) { 
            activeInputLanesRef.current.add(lane); 
            setLaneActive(lane, true); 

            if (isInputDebugModeRef.current && parsedSong && audioContextRef.current) {
                const ctxTime = audioContextRef.current.currentTime;
                const bmsTime = isPlayingRef.current 
                    ? (ctxTime - startTimeRef.current) 
                    : pauseTimeRef.current;

                // 修正: 未来の予約位置(nextNoteIndexRef)ではなく、現在時刻から近い場所を探す
                // findStartIndexを使って現在時刻付近のインデックスを取得
                const centerIndex = findStartIndex(displayObjects, bmsTime);
                
                // 前後を探して、このレーンで一番近い未処理のノーツ(または直近のノーツ)を探す
                // 範囲は適当に前後20個くらいで十分
                const searchStart = Math.max(0, centerIndex - 20);
                const searchEnd = Math.min(displayObjects.length, centerIndex + 50);

                let targetObj = null;
                let minDiff = 9999;

                for (let i = searchStart; i < searchEnd; i++) {
                    const obj = displayObjects[i];
                    if (obj.laneIndex === lane && obj.isNote) {
                        // 時間差を計算
                        const diff = Math.abs(obj.time - bmsTime);
                        // 0.5秒以内の範囲で、一番近い音を採用する
                        if (diff < 0.5 && diff < minDiff) {
                            minDiff = diff;
                            targetObj = obj;
                        }
                    }
                }

                if (targetObj) {
                    const wavName = parsedSong.header.wavs[targetObj.value];
                    if (wavName) {
                        const buffer = audioBuffersRef.current.get(wavName.toLowerCase());
                        if (buffer) {
                            const src = audioContextRef.current.createBufferSource();
                            src.buffer = buffer;
                            const gain = audioContextRef.current.createGain();
                            gain.gain.value = volumeRef.current; 
                            src.connect(gain);
                            gain.connect(gainNodeRef.current);
                            src.start(0);
                        }
                    }
                }
            }
        }
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
  
  const handleZipSelect = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsLoading(true); setLoadingMessage('ZIPファイルを解凍中...');
      try {
          const extractedFiles = await extractZipFiles(file);
          processFiles(extractedFiles);
      } catch(err) {
          alert('ZIPファイルの読み込みに失敗しました。');
          console.error(err);
          setIsLoading(false);
      }
  };

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
  const handleKeyHitSoundReset = () => { if (audioContextRef.current) { keyHitSoundBufferRef.current = createHitSound(audioContextRef.current); setCustomKeyHitSound(null); } };
  const handleScratchHitSoundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !audioContextRef.current) return;
    const buf = await file.arrayBuffer();
    scratchHitSoundBufferRef.current = await audioContextRef.current.decodeAudioData(buf);
    setCustomScratchHitSound(file.name);
  };
  const handleScratchHitSoundReset = () => { if (audioContextRef.current) { scratchHitSoundBufferRef.current = createHitSound(audioContextRef.current); setCustomScratchHitSound(null); } };

  const refreshRandom = () => { if (!parsedSong) return; stopPlayback(true); setDisplayObjects(applyOptions(parsedSong.objects, playOption)); };
  useEffect(() => { if (parsedSong) setDisplayObjects(applyOptions(parsedSong.objects, playOption)); }, [parsedSong, playOption]);
  
  useEffect(() => { if (selectedBmsIndex >= 0 && bmsList[selectedBmsIndex]) loadBmsAndAudio(bmsList[selectedBmsIndex].file); }, [selectedBmsIndex, bmsList]);

  const loadBmsAndAudio = async (bmsFile) => {
    if (isPlayingRef.current) stopPlayback(true);
    setParsedSong(null); setDisplayObjects([]); setCurrentBackBga(null); setCurrentLayerBga(null); setCurrentPoorBga(null); setShowMissLayer(false);
    setNextBpmInfo(null); setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: 0 });
    scratchAngleRef.current = 0; lastScratchTimeRef.current = 0; lastScratchTypeRef.current = 'REVERSE'; scratchDirectionRef.current = -1; activeInputLanesRef.current.clear(); isShiftHeldRef.current = false; isCtrlHeldRef.current = false;
    if (audioContextRef.current) activeNodesRef.current.forEach(n => { try { n.node.stop(); n.node.disconnect(); } catch(e){} });
    activeNodesRef.current = []; activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]); imageAssetsRef.current.clear(); audioBuffersRef.current.clear(); 

    setIsLoading(true); setLoadingProgress(0); setLoadingMessage('BMSファイルを解析中...');

    try {
      const parsed = await parseBMS(bmsFile);
      setTimeout(() => { if (!parsed.isSupportedMode) alert("警告：このBMSファイルは5鍵/7鍵盤以外のモード（DPやPMSなど）を含んでいる可能性があります。\n正しく再生されない、または未実装の形式です。"); }, 100);
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
      setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: parsed.avgDensity });
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
                if (obj.isNote) {
                    // ノーツの場合
                    if (!playKeySoundsRef.current) shouldPlay = false;
                    if (isInputDebugModeRef.current && muteDebugAutoPlayRef.current) {
                        shouldPlay = false;
                    }
                } else {
                    // ノーツ以外（BGMなど）の場合
                    if (!playBgSoundsRef.current) shouldPlay = false;
                }
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

    const bgaTime = currentTime + 0.05;

    if (parsedSong) {
        activeNodesRef.current = activeNodesRef.current.filter(n => n.endTime > currentTime);
        if (parsedSong.backBgaObjects && nextBackBgaIndexRef.current < parsedSong.backBgaObjects.length) {
            const bgaObj = parsedSong.backBgaObjects[nextBackBgaIndexRef.current];
            if (bgaObj.time <= bgaTime) {
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
            if (bgaObj.time <= bgaTime) {
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
            if (bgaObj.time <= bgaTime) {
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

        if (parsedSong) {
            activeNodesRef.current = activeNodesRef.current.filter(n => n.endTime > currentTime);
        }

        // 2. 再生時間の表示更新：解析用に毎フレーム実行する（高精度維持）
        // ここをif文の外に出すことで、滑らかな数値変化に戻ります
        setPlaybackTimeDisplay(currentTime);

        // 3. その他の重い処理（小節線の計算やログ表示用のリスト更新など）
        // これらは毎フレームやる必要がないので、ここだけ間引いて軽量化します
        if (now - lastStateUpdateRef.current > 100) { // 100ms(秒間10回)程度に設定
            if (parsedSong) {
                 // 小節情報の更新などはここで行う
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
            lastStateUpdateRef.current = now; // 時間更新タイミングを記録
        }

        const isFinished = currentTime > duration + 0.5 && activeNodesRef.current.length === 0;
        if (isFinished && isPlayingRef.current) { stopPlayback(true); return; }
    }

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const KEY_W = Math.min(40, width / 12);
    const SCRATCH_W = KEY_W * 1.5;
    const BOARD_W = SCRATCH_W + (KEY_W * 7) + 10;
    const BOARD_X = (width - BOARD_W) / 2;
    
    const visMode = visibilityModeRef.current;
    const isLiftEnabled = visMode === VISIBILITY_MODES.LIFT || visMode === VISIBILITY_MODES.LIFT_SUD_PLUS;
    const liftOffset = isLiftEnabled ? liftValRef.current : 0; 
    // ★修正: スマホの判定ラインをさらに上げる (ナビゲーションバー対策)
    const BASE_JUDGE_Y = height - (isMobileRef.current ? 180 : 100); 
    const JUDGE_Y = BASE_JUDGE_Y - liftOffset;
    const is2P = playSide === '2P';
    const SCRATCH_X = is2P ? BOARD_X + (KEY_W * 7) + 10 : BOARD_X; const KEYS_X = is2P ? BOARD_X : BOARD_X + SCRATCH_W + 10;

    // ★修正: ボード全体の不透明度
    const bOpacity = boardOpacityRef.current;
    // ★修正: 各レーンの不透明度
    const lOpacity = laneOpacityRef.current;
    
    // ボード全体の背景
    ctx.fillStyle = isMobileRef.current ? `rgba(2, 6, 23, ${bOpacity})` : `rgba(2, 6, 23, ${bOpacity})`;
    ctx.fillRect(BOARD_X, 0, BOARD_W, height); 
    
    for(let i=0; i<7; i++) { 
        const laneHeight = isLiftEnabled ? JUDGE_Y : height;
        // 各レーンの背景
        const baseColor = [1,3,5].includes(i) ? [15, 23, 42] : [30, 41, 59];
        const color = isMobileRef.current 
            ? `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${lOpacity})` 
            : `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${lOpacity})`;
        ctx.fillStyle = color;
        ctx.fillRect(KEYS_X + i * KEY_W, 0, KEY_W, laneHeight);
    }
    
    ctx.strokeStyle = isMobileRef.current ? `rgba(51, 65, 85, ${lOpacity})` : '#334155';
    ctx.lineWidth = 1; ctx.beginPath();
    for(let i=0; i<=7; i++) { const x = KEYS_X + i * KEY_W; ctx.moveTo(x, 0); ctx.lineTo(x, isLiftEnabled ? JUDGE_Y : height); }
    
    // スクラッチレーンも
    ctx.fillStyle = isMobileRef.current ? `rgba(15, 23, 42, ${lOpacity})` : '#0f172a';
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
                    const effectHeight = 300; // エフェクトの高さを固定
                    const topY = JUDGE_Y - effectHeight; // 上端のY座標を計算
                    const grad = ctx.createLinearGradient(x, JUDGE_Y, x, topY);
                    grad.addColorStop(0, `rgba(100, 200, 255, 0.3)`); 
                    grad.addColorStop(1, `rgba(0,0,0,0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, topY, w, effectHeight);
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
                        grad.addColorStop(0, `rgba(${color}, ${alpha * 0.6})`); 
                        grad.addColorStop(1, `rgba(0,0,0,0)`);
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
      
      <SettingsModal
        showSettings={showSettings} setShowSettings={setShowSettings} isMobile={isMobile}
        visibilityMode={visibilityMode} setVisibilityMode={setVisibilityMode}
        suddenPlusVal={suddenPlusVal} setSuddenPlusVal={setSuddenPlusVal} hiddenPlusVal={hiddenPlusVal} setHiddenPlusVal={setHiddenPlusVal} liftVal={liftVal} setLiftVal={setLiftVal}
        playSide={playSide} setPlaySide={setPlaySide} playOption={playOption} setPlayOption={setPlayOption} currentLaneOrder={currentLaneOrder} refreshRandom={refreshRandom}
        comboPos={comboPos} setComboPos={setComboPos} 
        customKeyHitSound={customKeyHitSound} handleKeyHitSoundUpload={handleKeyHitSoundUpload} handleKeyHitSoundReset={handleKeyHitSoundReset}
        customScratchHitSound={customScratchHitSound} handleScratchHitSoundUpload={handleScratchHitSoundUpload} handleScratchHitSoundReset={handleScratchHitSoundReset}
        volume={volume} setVolume={setVolume} monitorUpdateInterval={monitorUpdateInterval} setMonitorUpdateInterval={setMonitorUpdateInterval}
        hasVideo={hasVideo} playBgaVideo={playBgaVideo} setPlayBgaVideo={setPlayBgaVideo} hitSoundVolume={hitSoundVolume} setHitSoundVolume={setHitSoundVolume}
        showReady={showReady} setShowReady={setShowReady} playKeySounds={playKeySounds} setPlayKeySounds={setPlayKeySounds} playLongAudio={playLongAudio} setPlayLongAudio={setPlayLongAudio}
        playBgSounds={playBgSounds} setPlayBgSounds={setPlayBgSounds} showMutedMonitor={showMutedMonitor} setShowMutedMonitor={setShowMutedMonitor}
        showAbortedMonitor={showAbortedMonitor} setShowAbortedMonitor={setShowAbortedMonitor} scratchRotationEnabled={scratchRotationEnabled} setScratchRotationEnabled={setScratchRotationEnabled}
        isInputDebugMode={isInputDebugMode} setIsInputDebugMode={setIsInputDebugMode}
        muteDebugAutoPlay={muteDebugAutoPlay} setMuteDebugAutoPlay={setMuteDebugAutoPlay}
        // Mobile Controls
        handleFileSelect={handleFileSelect} handleZipSelect={handleZipSelect} bmsList={bmsList} selectedBmsIndex={selectedBmsIndex} setSelectedBmsIndex={setSelectedBmsIndex}
        isPlaying={isPlaying} startPlayback={startPlayback} pausePlayback={pausePlayback} stopPlayback={stopPlayback}
        hiSpeed={hiSpeed} setHiSpeed={setHiSpeed} bgaOpacity={bgaOpacity} setBgaOpacity={setBgaOpacity}
        laneOpacity={laneOpacity} setLaneOpacity={setLaneOpacity}
        boardOpacity={boardOpacity} setBoardOpacity={setBoardOpacity}
        parsedSong={parsedSong}
      />

      {/* メインエリア: PCとスマホで構造を分ける */}
      <div className="flex-1 relative min-h-0 overflow-hidden flex justify-center">
         
         {/* スマホ用: 背景BGA */}
         {isMobile && (
             <div className="absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none" style={{ opacity: bgaOpacity }}>
                <BgaLayer bgaState={currentBackBga} zIndex={0} isPlaying={isPlaying} currentTime={playbackTimeDisplay} isVideoEnabled={playBgaVideo} />
                <BgaLayer bgaState={currentLayerBga} zIndex={10} blendMode="screen" isPlaying={isPlaying} currentTime={playbackTimeDisplay} isVideoEnabled={playBgaVideo} />
                {showMissLayer && currentPoorBga && (
                    <div className="absolute inset-0 w-full h-full z-50 bg-black/50 flex items-center justify-center">
                        <BgaLayer bgaState={currentPoorBga} zIndex={50} isPlaying={isPlaying} currentTime={playbackTimeDisplay} isVideoEnabled={playBgaVideo} />
                    </div>
                )}
             </div>
         )}

         {/* PCレイアウト: 4カラム構成 */}
         {!isMobile && (
             <div className="flex w-full h-full">
                 {/* 左: コントローラー */}
                 <ControllerPanel
                    controllerRefs={controllerRefs} keyboardRefs={keyboardRefs} noteCounts={noteCounts}
                    is2P={is2P} parsedSong={parsedSong} difficultyInfo={difficultyInfo}
                    currentMeasure={currentMeasure}
                 />
                 
                 {/* 中央左: 情報・BGA */}
                 <InfoPanel
                    setShowSettings={setShowSettings} playOption={playOption}
                    currentBackBga={currentBackBga} currentLayerBga={currentLayerBga} currentPoorBga={currentPoorBga}
                    showMissLayer={showMissLayer} isPlaying={isPlaying} playbackTimeDisplay={playbackTimeDisplay}
                    playBgaVideo={playBgaVideo} readyAnimState={readyAnimState}
                    currentMeasureLines={currentMeasureLines} combo={combo} totalNotes={totalNotes}
                    currentMeasureNotes={currentMeasureNotes} realtimeBpm={realtimeBpm} nextBpmInfo={nextBpmInfo} hiSpeed={hiSpeed}
                 />

                 {/* 中央右: レーン (Canvas) */}
                 <div className="flex-1 bg-black relative flex justify-center border-r border-blue-900/30 overflow-hidden">
                    <canvas ref={canvasRef} className="h-full w-full max-w-[600px] shadow-[0_0_50px_rgba(0,0,0,0.5)]" />
                    {!parsedSong && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-blue-900/20"><div className="text-center animate-pulse"><FolderOpen size={64} className="mx-auto mb-4 opacity-50"/><p className="text-xl font-bold tracking-widest">DROP FILE HERE</p></div></div>}
                    {!showSettings && parsedSong && <div className="absolute bottom-[100px] w-full h-[2px] bg-red-500/60 pointer-events-none z-20 shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{maxWidth:'600px'}}/>}
                 </div>

                 {/* 右: ログパネル */}
                 <LogPanel 
                    backingTracks={backingTracks} 
                    activeShortSounds={activeShortSoundsRef.current} 
                    lastPlayedSoundPerLane={lastPlayedSoundPerLaneRef.current}
                    longAudioProgressRefs={longAudioProgressRefs}
                    maxPolyphonyCount={maxPolyphonyCount}
                    polyphonyCount={polyphonyCount}
                    averagePolyphony={averagePolyphony}
                 />
             </div>
         )}

         {/* スマホのみ: Canvas (全画面) */}
         {isMobile && (
             <div className="relative z-10 w-full h-full">
                <canvas ref={canvasRef} className="w-full h-full" />
                {!parsedSong && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/50">
                        <div className="text-center animate-pulse">
                            <FolderOpen size={64} className="mx-auto mb-4 opacity-50"/>
                            <p className="text-xl font-bold tracking-widest">OPEN SETTINGS</p>
                        </div>
                    </div>
                )}
                {!showSettings && parsedSong && <div className="absolute bottom-[100px] w-full h-[2px] bg-red-500/60 pointer-events-none z-20 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />}
             </div>
         )}

         {/* スマホ用: フローティング設定ボタン */}
         {isMobile && (
             <button 
                onClick={() => setShowSettings(true)}
                className="absolute top-4 right-4 z-50 p-3 bg-blue-600/80 rounded-full text-white shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
             >
                 <Settings size={24} />
             </button>
         )}

         {/* スマホ用: 下部コントロールバー (常駐) - ★修正: 位置を bottom-12 に下げる */}
         {isMobile && parsedSong && (
             <div className="absolute bottom-12 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto pb-safe">
                 <input type="range" min="0" max={duration || 100} step="0.01" value={playbackTimeDisplay} onChange={handleSeek} className="w-full h-2 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500 backdrop-blur-sm" />
                 <div className="flex items-center justify-between gap-3">
                     <div className="flex gap-2 flex-1">
                        <button onClick={() => stopPlayback(true)} className="bg-gray-800/80 backdrop-blur-sm text-white p-3 rounded-full shadow-lg border border-white/10 active:scale-95"><ChevronFirst size={24}/></button>
                        <button onClick={isPlaying ? pausePlayback : startPlayback} className={`flex-1 p-3 rounded-full shadow-lg border border-white/10 font-bold flex items-center justify-center gap-2 backdrop-blur-sm active:scale-95 ${isPlaying ? 'bg-yellow-600/90' : 'bg-green-600/90'}`}>
                            {isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}
                        </button>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {/* PC用コントロールバー (スマホでは非表示) */}
      {!isMobile && (
          <ControlBar
            handleFileSelect={handleFileSelect} selectedBmsIndex={selectedBmsIndex} setSelectedBmsIndex={setSelectedBmsIndex} bmsList={bmsList}
            stopPlayback={stopPlayback} isPlaying={isPlaying} pausePlayback={pausePlayback} startPlayback={startPlayback}
            duration={duration} playbackTimeDisplay={playbackTimeDisplay} handleSeek={handleSeek}
            hiSpeed={hiSpeed} setHiSpeed={setHiSpeed} volume={volume} setVolume={setVolume} toggleMute={toggleMute}
          />
      )}
    </div>
  );
}