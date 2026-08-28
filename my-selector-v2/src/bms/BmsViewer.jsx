// src/bms/BmsViewer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FolderOpen, Settings, Play, Pause, ChevronFirst } from 'lucide-react';

import { VISIBILITY_MODES, LOOKAHEAD, SCHEDULE_INTERVAL, MAX_SHORT_POLYPHONY, MOBILE_BREAKPOINT, DEFAULT_BGA_OPACITY, BGM_MIN_DURATION, LANE_LAYOUTS, PMS_LANE_COLORS, DEFAULT_KEYMAPS } from './constants';
import { findStartIndex, getBeatFromTime, getBpmFromTime, createHitSound, generateLaneMap, guessDifficulty, extractZipFiles, getBaseName, getFileName } from './logic/utils';
import { parseBMS } from './logic/parser';

import SettingsModal from './components/SettingsModal';
import ControllerPanel from './components/ControllerPanel';
import InfoPanel from './components/InfoPanel';
import LogPanel from './components/LogPanel';
import ControlBar from './components/ControlBar';
import BgaLayer from './components/BgaLayer';

// ★軽量化: renderLoop 毎フレームの割り当てを避けるためのモジュールスコープ定数/再利用バッファ
const MAX_LANES = 16;                // 0=1P皿,1-7=1P鍵 / 8=2P皿,9-15=2P鍵 (PMS は 0-8)
const SIDE_GAP_UNITS = 0.7;          // DP の 1P/2P 間の隙間 (KEY_W 単位)
const LANE_GAP_UNITS = 0.05;
const SCRATCH_UNITS = 1.5;

// 参照が安定した関数を返す(常に最新の実装を呼ぶ)。子の React.memo を効かせるために使う。
function useEvent(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useRef((...a) => ref.current(...a)).current;
}
const _activeLanesScratch = new Array(MAX_LANES).fill(false); // renderLoop 内でのみ同期利用
const _laneXScratch = new Array(MAX_LANES).fill(0);   // laneX[index] = 板内での左端X (BOARD_X相対)
const _laneWScratch = new Array(MAX_LANES).fill(0);   // laneW[index] = レーン幅
const DEFAULT_LANES = LANE_LAYOUTS.SP7;

// レーンの見た目の色を返す。lane = { index, kind, side }
function laneKeyNum(lane) { return lane.side === 0 ? lane.index : lane.index - 8; } // 1..7
function laneNoteColor(lane, pmsColors) {
  if (pmsColors) return pmsColors[lane.index] || '#f1f5f9';
  if (lane.kind === 'scratch') return '#ef4444';
  return (laneKeyNum(lane) % 2 === 0) ? '#3b82f6' : '#f1f5f9';
}
function laneBgColor(lane, lOpacity, isMobile, pms) {
  if (pms) return isMobile ? `rgba(20, 20, 28, ${lOpacity})` : '#12121c';
  if (lane.kind === 'scratch') return isMobile ? `rgba(15, 23, 42, ${lOpacity})` : '#0f172a';
  const dark = laneKeyNum(lane) % 2 === 0;
  return dark ? `rgba(15, 23, 42, ${lOpacity})` : `rgba(30, 41, 59, ${lOpacity})`;
}

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
  // ↓ P1-e で imperative 更新に移行。値は未使用、setter は互換のため no-op で残す。
  const setCurrentMeasureNotes = () => {};
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTimeDisplay, setPlaybackTimeDisplay] = useState(0); 
  const [duration, setDuration] = useState(0);
  const [hiSpeed, setHiSpeed] = useState(2.0);
  const [autoHiSpeed, setAutoHiSpeed] = useState(false);  // オートHI-SPEED(主BPMで緑数字を固定)。既定OFF
  const [targetGreen, setTargetGreen] = useState(300);    // 目標グリーンナンバー(ms)
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
  const [currentMeasure, setCurrentMeasure] = useState(0);
  const [playSide, setPlaySide] = useState('1P');
  const [playOption, setPlayOption] = useState('OFF');
  const [currentLaneOrder, setCurrentLaneOrder] = useState([1,2,3,4,5,6,7]);
  const [comboPos, setComboPos] = useState('CENTER');
  const [totalNotes, setTotalNotes] = useState(0);
  const [laneMute, setLaneMute] = useState(() => new Array(MAX_LANES).fill(false)); // レーンごとミュート(0=SC, 1-7=鍵盤)
  const laneMuteRef = useRef(laneMute);
  useEffect(() => { laneMuteRef.current = laneMute; }, [laneMute]);
  // ↓ P1-e で imperative 更新へ移行。値は未使用、setter は互換のため no-op で残す。
  const setPolyphonyCount = () => {}, setMaxPolyphonyCount = () => {}, setAveragePolyphony = () => {};
  const setRealtimeBpm = () => {}, setNextBpmInfo = () => {}, setCombo = () => {}, setNoteCounts = () => {};
  const [currentBpm, setCurrentBpm] = useState(130); 
  const [showReady, setShowReady] = useState(true);
  const [readyAnimState, setReadyAnimState] = useState(null); 
  const [backingTracks, setBackingTracks] = useState([]);
  const [playKeySounds, setPlayKeySounds] = useState(true);
  const [playBgSounds, setPlayBgSounds] = useState(true);      
  const [playLongAudio, setPlayLongAudio] = useState(true);
  const [scratchRotationEnabled, setScratchRotationEnabled] = useState(true);
  const [isInputDebugMode, setIsInputDebugMode] = useState(false);
  // キー割り当て(6-1-d): モード別 lane index -> KeyboardEvent.code。localStorage 永続。
  // ※ 手動プレイの判定入力への接続は P6-2 で実装。現状は表示・保存のみ。
  const [keyMaps, setKeyMaps] = useState(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('bms_keymaps') || '{}') || {}; } catch { saved = {}; }
    const merged = {};
    for (const m of Object.keys(DEFAULT_KEYMAPS)) merged[m] = { ...DEFAULT_KEYMAPS[m], ...(saved[m] || {}) };
    return merged;
  });
  useEffect(() => {
    try { localStorage.setItem('bms_keymaps', JSON.stringify(keyMaps)); } catch { /* quota / privacy mode */ }
  }, [keyMaps]);
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
  const ctxRef = useRef(null); // ★軽量化: canvasの2Dコンテキストをキャッシュ（毎フレームgetContext()しない）
  const keyHitSoundBufferRef = useRef(null);
  const scratchHitSoundBufferRef = useRef(null);
  const controllerRefs = useRef([]); 
  const keyboardRefs = useRef([]);
  const activeInputLanesRef = useRef(new Set()); 
  const activeShortSoundsRef = useRef([]);
  const activeLongSoundsRef = useRef([]); 
  const activeDebugSoundsRef = useRef(new Set());
  const nextBackBgaIndexRef = useRef(0);
  const nextLayerBgaIndexRef = useRef(0);
  const nextPoorBgaIndexRef = useRef(0);
  const lastPlayedSoundPerLaneRef = useRef(new Array(MAX_LANES).fill(null));
  const comboRef = useRef(0);
  const noteCountsRef = useRef(new Array(MAX_LANES).fill(0)); 
  const lastStateUpdateRef = useRef(0);
  const currentMeasureRef = useRef(-1);
  const longAudioProgressRefs = useRef(new Map());
  const missLayerTimerRef = useRef(null); 
  const polyphonyHistoryRef = useRef([]);
  const maxPolyRef = useRef(0);
  const nextSoundIdRef = useRef(1); // 音源ログ/ノードの一意ID(React key・killedIds Set用)。Math.random()の衝突を避ける
  const polyphonyRef = useRef(0);   // 現在の同時発音数(scheduleAudioが毎tick更新、表示は100msブロックで間引き)
  const hudLastRef = useRef({});    // HUDに最後に push した値。変化時のみ setState するための比較用
  const canvasRectRef = useRef(null);   // canvas の CSS サイズ(ResizeObserver でキャッシュ、毎フレーム getBoundingClientRect しない)
  const laneVisualRef = useRef(new Array(MAX_LANES).fill(null)); // 各レーンの見た目 active 状態。変化時のみ DOM 書き込み
  const gradCacheRef = useRef({ key: '', ln: [], hit: [] }); // レーン単位のグラデーションキャッシュ
  const boardLayerRef = useRef({ key: '', canvas: null });   // 静的な板(背景/レーン/区切り線/判定線)のオフスクリーンキャッシュ
  const readyTextCacheRef = useRef(null); // READY/GO 演出をオフスクリーンに1回だけ描画(shadowBlurは最重量級)
  const seekCommitTimerRef = useRef(null); // シークの重い処理を debounce するタイマー
  const lastBgaKeyRef = useRef({});      // 直近に setState した BGA の識別キー。スクラブ中の無駄な setState を防ぐ
  const mobileBackBgaRef = useRef(null); // モバイル BGA の syncTime 呼び出し用
  const mobileLayerBgaRef = useRef(null);
  const mobilePoorBgaRef = useRef(null);
  const scratchAngleRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastScratchTimeRef = useRef(0);
  const lastScratchTypeRef = useRef('REVERSE');
  const scratchDirectionRef = useRef(-1);
  // DP 2P スクラッチ用 (index 8)
  const scratchAngle2Ref = useRef(0);
  const lastScratchTime2Ref = useRef(0);
  const lastScratchType2Ref = useRef('REVERSE');
  const scratchDirection2Ref = useRef(-1);
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
  const lastNotesByLaneRef = useRef(new Array(MAX_LANES).fill(null)); 
  
  const boardOpacityRef = useRef(boardOpacity);
  const laneOpacityRef = useRef(laneOpacity);

  const timeSliderRef = useRef(null);

  const pcControlBarRef = useRef(null);
  const infoPanelRef = useRef(null);
  const controllerPanelRef = useRef(null); // ControllerPanel の updateCounts 呼び出し用
  const logPanelRef = useRef(null);        // LogPanel の updatePoly 呼び出し用
  const realtimeBpmRef = useRef(130);      // renderLoop の皿回転速度が最新BPMを読むための ref

  const [isSeparateHitSound, setIsSeparateHitSound] = useState(false);
  const [tempKeyHitSoundBuffer, setTempKeyHitSoundBuffer] = useState(null);
  const [tempScratchHitSoundBuffer, setTempScratchHitSoundBuffer] = useState(null);
  const [tempKeySoundName, setTempKeySoundName] = useState(null);
  const [tempScratchSoundName, setTempScratchSoundName] = useState(null);

  // --- 描画ループ(requestAnimationFrame)の一元管理: 常に1本だけ生存させる ---
  // 以前は seek/pause 時に animationRef を経由せず rAF を張っており、
  // 停止中にシークするたびループが増殖して FPS が低下していた。
  const renderLoopRef = useRef(null);
  const scheduleAudioRef = useRef(null);
  const _renderTick = () => {
      animationRef.current = null;
      if (renderLoopRef.current) renderLoopRef.current();
  };
  const scheduleRenderLoop = () => {
      if (animationRef.current != null) return;   // 既に予約済みなら何もしない(多重生成の防止)
      animationRef.current = requestAnimationFrame(_renderTick);
  };
  const stopRenderLoop = () => {
      if (animationRef.current != null) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
  };

  // --- BGA用オブジェクトURLの解放(メモリリーク対策) ---
  // Blob URL は revoke しない限り Blob 本体をメモリに固定し続けるため、
  // Map を clear する前に必ず revoke する。
  const releaseImageAssets = () => {
      imageAssetsRef.current.forEach(asset => {
          const u = asset && (asset.url || asset.src);
          if (typeof u === 'string' && u.startsWith('blob:')) {
              try { URL.revokeObjectURL(u); } catch (e) {}
          }
      });
      imageAssetsRef.current.clear();
  };

  useEffect(() => {
      const handleResize = () => {
          const mobile = window.innerWidth < MOBILE_BREAKPOINT;
          // 同じ表示帯(PC/モバイル)にとどまる限りは何もしない。
          // これをしないと、モバイルでアドレスバー開閉のたびにユーザーの不透明度設定が既定値へ戻ってしまう。
          if (mobile === isMobileRef.current) return;
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

  // ★軽量化: canvas の CSS サイズは ResizeObserver で監視してキャッシュし、renderLoop で毎フレーム
  //   getBoundingClientRect()(レイアウト強制)を呼ばないようにする。canvas 要素は PC/モバイルで差し替わるので isMobile を依存に。
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    // canvas 要素は PC/モバイルで差し替わる。古い 2D コンテキスト/キャッシュを破棄して次フレームで取り直させる。
    ctxRef.current = null;
    canvasRectRef.current = null;
    gradCacheRef.current = { key: '', ln: [], hitRed: [], hitBlue: [] };
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) canvasRectRef.current = { width: r.width, height: r.height };
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [isMobile]);

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
      if (isInputDebugMode) scheduleRenderLoop();
  }, [isInputDebugMode]);
  useEffect(() => { muteDebugAutoPlayRef.current = muteDebugAutoPlay; }, [muteDebugAutoPlay]);

  // デバッグ用キー入力の「KeyboardEvent.code → laneIndex」逆引き表(現在モードのキー割り当てに追従)
  const debugKeyLaneRef = useRef({});
  useEffect(() => {
    const m = keyMaps[parsedSong?.mode] || keyMaps.SP7 || {};
    const rev = {};
    for (const idx of Object.keys(m)) rev[m[idx]] = Number(idx);
    debugKeyLaneRef.current = rev;
  }, [keyMaps, parsedSong]);

  const laneMetaRef = useRef([]); // [index] = { isScratch, color } (parsedSong.lanes から)
  useEffect(() => {
    const meta = new Array(MAX_LANES);
    const lns = parsedSong?.lanes || DEFAULT_LANES;
    const pms = parsedSong?.mode === 'PMS9' ? PMS_LANE_COLORS : null;
    for (const lane of lns) meta[lane.index] = { isScratch: lane.kind === 'scratch', color: laneNoteColor(lane, pms) };
    laneMetaRef.current = meta;
  }, [parsedSong]);

  const setLaneActive = (idx, active) => {
      const meta = laneMetaRef.current[idx];
      if (!meta) return;
      const col = meta.color;
      const ctrlEl = controllerRefs.current[idx];
      if (ctrlEl) {
          // 即時反映(transition なし)。密譜面で「光りかけて消える」のを防ぐ。
          if (meta.isScratch) {
             ctrlEl.style.boxShadow = active ? `0 0 20px ${col}` : 'none';
             ctrlEl.style.borderColor = active ? col : '#1e293b';
          } else {
             ctrlEl.style.background = active ? col : '#0b0f1a';
             ctrlEl.style.boxShadow = active ? `0 0 14px ${col}` : 'none';
             ctrlEl.style.borderColor = active ? col : (meta.color + '88');
          }
      }
      const kbEl = keyboardRefs.current[idx];
      if (kbEl && kbEl !== ctrlEl) {
          kbEl.style.background = active ? col : '#0f172a';
          kbEl.style.color = active ? '#0b0f1a' : (meta.isScratch ? '#fca5a5' : '#93a0be');
          kbEl.style.boxShadow = active ? `0 0 8px ${col}` : 'none';
      }
  };
  const clearActiveLanes = () => { for(let i=0; i<MAX_LANES; i++) { if (laneVisualRef.current[i] !== false) { laneVisualRef.current[i] = false; setLaneActive(i, false); } } };

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
    const map = generateLaneMap(option); // 1P鍵1-7 の並び替えマップ (index 1-7)
    setCurrentLaneOrder(map.slice(1));
    // ★6-1: 並び替えは 1P 鍵1-7 のみ。皿(0,8) と 2P鍵(9-15) はそのまま通す。
    //   (DP のサイド別 RANDOM 等は 6-1-e で対応)
    return objects.map(o => ({
        ...o, processed: false,
        laneIndex: (o.isNote && o.laneIndex >= 1 && o.laneIndex <= 7)
            ? (option === 'S-RANDOM' ? Math.floor(Math.random() * 7) + 1 : map[o.laneIndex])
            : o.laneIndex
    }));
  };

  const toggleMute = () => {
      if (volume > 0) { setLastVolume(volume); setVolume(0); } else { setVolume(lastVolume || 0.8); }
  };

  const resetGameStatus = () => {
    stopPlayback(true);
    if (audioContextRef.current) activeNodesRef.current.forEach(n => { try { n.node.stop(); n.node.disconnect(); } catch(e){} });
    activeNodesRef.current = []; activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]); releaseImageAssets();
    lastBgaKeyRef.current = {};
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
        const rev = debugKeyLaneRef.current;
        // 皿の手動回転用フラグ(Shift=逆回転 / Ctrl=高速)。キー割り当てで皿=Shift のときは lane も付く。
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isShiftHeldRef.current = true;
        else if (e.code === 'ControlLeft' || e.code === 'ControlRight') isCtrlHeldRef.current = true;
        else if (e.code === 'KeyM' && rev['KeyM'] === undefined) { triggerMiss(); }
        let lane = rev[e.code];
        if (lane === undefined) lane = -1;
        if (lane !== -1) {
            activeInputLanesRef.current.add(lane); 
            setLaneActive(lane, true); 

            if (isInputDebugModeRef.current && parsedSong && audioContextRef.current) {
                const ctxTime = audioContextRef.current.currentTime;
                const bmsTime = isPlayingRef.current 
                    ? (ctxTime - startTimeRef.current) 
                    : pauseTimeRef.current;

                // ■ 設定に基づいた判定幅 (beatoraja BAD判定基準)
                // Early(早入り/未来): -0.28s まで (280ms)
                // Late (遅入り/過去): +0.22s まで (220ms)
                const EARLY_LIMIT = 0.28; 
                const LATE_LIMIT = 0.22;

                // 1. 近くのノーツを探す (範囲を少し広めに取って検索)
                const centerIndex = findStartIndex(displayObjects, bmsTime - LATE_LIMIT);
                const searchStart = Math.max(0, centerIndex - 10);
                const searchEnd = Math.min(displayObjects.length, centerIndex + 50);

                let targetObj = null;
                let minAbsDiff = 9999; // 最も近いものを選ぶための記録用

                for (let i = searchStart; i < searchEnd; i++) {
                    const obj = displayObjects[i];
                    if (obj.laneIndex === lane && obj.isNote) {
                        const diff = obj.time - bmsTime; // 正なら未来、負なら過去

                        // 判定範囲内かチェック (-0.22 <= diff <= 0.28)
                        // diffが負(過去)の場合は -diff <= 0.22
                        // diffが正(未来)の場合は diff <= 0.28
                        const isLateValid = diff < 0 && -diff <= LATE_LIMIT;
                        const isEarlyValid = diff >= 0 && diff <= EARLY_LIMIT;

                        if (isLateValid || isEarlyValid) {
                            // 範囲内なら、より中心に近いものを優先する
                            const absDiff = Math.abs(diff);
                            if (absDiff < minAbsDiff) {
                                minAbsDiff = absDiff;
                                targetObj = obj;
                            }
                        }
                    }
                }

                // 2. 音を鳴らす処理
                let soundToPlay = null;

                if (targetObj) {
                    // ヒットしたノーツがある場合
                    soundToPlay = targetObj.value;
                } else {
                    // ■ 追加機能: 最後のノーツを過ぎた後の処理
                    // そのレーンの最後のノーツを取得
                    const lastNote = lastNotesByLaneRef.current[lane];
                    
                    // 「最後のノーツが存在し」かつ「現在時刻が最後のノーツのLate判定(-0.22s)より後ろ」なら
                    if (lastNote && bmsTime > lastNote.time + LATE_LIMIT) {
                        soundToPlay = lastNote.value;
                    }
                }

                // 音源再生実行
                if (soundToPlay !== null) {
                    const wavName = parsedSong.header.wavs[soundToPlay];
                    if (wavName) {
                        const buffer = audioBuffersRef.current.get(wavName.toLowerCase());
                        if (buffer) {
                            const src = audioContextRef.current.createBufferSource();
                            src.buffer = buffer;
                            const gain = audioContextRef.current.createGain();
                            gain.gain.value = volumeRef.current; 
                            src.connect(gain);
                            gain.connect(gainNodeRef.current);
                            src.onended = () => {
                                activeDebugSoundsRef.current.delete(src);
                            };
                            activeDebugSoundsRef.current.add(src);

                            src.start(0);
                        }
                    }
                }
            }
        }
        scheduleRenderLoop();
    };
    const handleKeyUp = (e) => {
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isShiftHeldRef.current = false;
        else if (e.code === 'ControlLeft' || e.code === 'ControlRight') isCtrlHeldRef.current = false;
        const lane = debugKeyLaneRef.current[e.code];
        if (lane !== undefined) { activeInputLanesRef.current.delete(lane); setLaneActive(lane, false); }
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    scheduleRenderLoop();
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
      stopRenderLoop();
      releaseImageAssets();
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

// ▼▼▼ 変更: 打鍵音のバリデーションと一時保存、適用ロジック ▼▼▼
  const validateAndDecodeAudio = async (file) => {
    if (!file || !audioContextRef.current) return null;
    try {
        const buf = await file.arrayBuffer();
        const audioBuf = await audioContextRef.current.decodeAudioData(buf);
        // 負荷対策: 2.0秒以上のファイルはエラーを出して弾く
        if (audioBuf.duration >= 2.0) {
            alert(`ファイル「${file.name}」は長すぎます (${audioBuf.duration.toFixed(1)}秒)。\n負荷軽減のため、2.0秒未満の短い打鍵音を選択してください。`);
            return null;
        }
        return audioBuf;
    } catch (err) {
        alert(`ファイル「${file.name}」の読み込みに失敗しました。\n未対応の形式か、ファイルが破損しています。`);
        return null;
    }
  };

  const applyHitSounds = (keyBuf, scratchBuf, isSeparate, keyName, scratchName) => {
    // 1. 通常ノーツの適用
    if (keyBuf) {
        keyHitSoundBufferRef.current = keyBuf;
        setCustomKeyHitSound(keyName);
        // 「分けない」設定なら、スクラッチの箱にも同じものを入れる（重要！）
        if (!isSeparate) {
            scratchHitSoundBufferRef.current = keyBuf;
            setCustomScratchHitSound(keyName);
        }
    }
    // 2. スクラッチ用ノーツの適用（分ける設定の時だけ）
    if (isSeparate && scratchBuf) {
        scratchHitSoundBufferRef.current = scratchBuf;
        setCustomScratchHitSound(scratchName);
    }
  };

  // 分離設定（チェックボックス）が切り替わった時、再生中でなければ即時適用
  useEffect(() => {
      if (!isPlaying) applyHitSounds(tempKeyHitSoundBuffer, tempScratchHitSoundBuffer, isSeparateHitSound, tempKeySoundName, tempScratchSoundName);
  }, [isSeparateHitSound]);

  const handleKeyHitSoundUpload = async (e) => {
    const file = e.target.files[0];
    const buffer = await validateAndDecodeAudio(file);
    if (buffer) {
        setTempKeyHitSoundBuffer(buffer);
        setTempKeySoundName(file.name);
        if (!isPlaying) applyHitSounds(buffer, tempScratchHitSoundBuffer, isSeparateHitSound, file.name, tempScratchSoundName);
    }
  };

  const handleScratchHitSoundUpload = async (e) => {
    const file = e.target.files[0];
    const buffer = await validateAndDecodeAudio(file);
    if (buffer) {
        setTempScratchHitSoundBuffer(buffer);
        setTempScratchSoundName(file.name);
        if (!isPlaying) applyHitSounds(tempKeyHitSoundBuffer, buffer, isSeparateHitSound, tempKeySoundName, file.name);
    }
  };

  const handleKeyHitSoundReset = () => {
    if (audioContextRef.current) {
        const defaultSound = createHitSound(audioContextRef.current);
        setTempKeyHitSoundBuffer(null); setTempKeySoundName(null);
        keyHitSoundBufferRef.current = defaultSound; setCustomKeyHitSound(null);
        if (!isSeparateHitSound) {
            scratchHitSoundBufferRef.current = defaultSound; setCustomScratchHitSound(null);
        }
    }
  };

  const handleScratchHitSoundReset = () => {
    if (audioContextRef.current) {
        setTempScratchHitSoundBuffer(null); setTempScratchSoundName(null);
        scratchHitSoundBufferRef.current = createHitSound(audioContextRef.current);
        setCustomScratchHitSound(null);
    }
  };

  const refreshRandom = () => { if (!parsedSong) return; stopPlayback(true); setDisplayObjects(applyOptions(parsedSong.objects, playOption)); };
  useEffect(() => { if (parsedSong) setDisplayObjects(applyOptions(parsedSong.objects, playOption)); }, [parsedSong, playOption]);

  // オートHI-SPEED: 主BPM(再生秒数が最長の区間)で目標グリーンナンバーになるよう HI-SPEED を自動設定。
  // ロード時 / 目標green / SUD+・LIFT(白数字) / トグルON で再計算。手動変更時は sHiSpeedChange 側で auto を OFF にする。
  useEffect(() => {
    if (!autoHiSpeed || !parsedSong) return;
    const mainBpm = parsedSong.bpmRange?.main || parsedSong.header.bpm || 130;
    let white = 0;
    if (visibilityMode === VISIBILITY_MODES.SUDDEN_PLUS || visibilityMode === VISIBILITY_MODES.SUD_HID_PLUS) white += suddenPlusVal;
    if (visibilityMode === VISIBILITY_MODES.LIFT || visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) {
      white += liftVal;
      if (visibilityMode === VISIBILITY_MODES.LIFT_SUD_PLUS) white += suddenPlusVal;
    }
    white = Math.min(1000, Math.max(0, white));
    const hs = (240000 * ((1000 - white) / 1000)) / (mainBpm * (targetGreen || 300));
    const rounded = Math.max(0.1, Math.round(hs / 0.05) * 0.05);
    setHiSpeed(Number(rounded.toFixed(2)));
  }, [autoHiSpeed, targetGreen, parsedSong, visibilityMode, suddenPlusVal, liftVal]);
  
  useEffect(() => { if (selectedBmsIndex >= 0 && bmsList[selectedBmsIndex]) loadBmsAndAudio(bmsList[selectedBmsIndex].file); }, [selectedBmsIndex, bmsList]);

  const loadBmsAndAudio = async (bmsFile) => {
    if (isPlayingRef.current) stopPlayback(true);
    lastBgaKeyRef.current = {};
    setParsedSong(null); setDisplayObjects([]); setCurrentBackBga(null); setCurrentLayerBga(null); setCurrentPoorBga(null); setShowMissLayer(false);
    setNextBpmInfo(null); setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: 0 });
    scratchAngleRef.current = 0; lastScratchTimeRef.current = 0; lastScratchTypeRef.current = 'REVERSE'; scratchDirectionRef.current = -1; activeInputLanesRef.current.clear(); isShiftHeldRef.current = false; isCtrlHeldRef.current = false;
    if (audioContextRef.current) activeNodesRef.current.forEach(n => { try { n.node.stop(); n.node.disconnect(); } catch(e){} });
    activeNodesRef.current = []; activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]);
    // ★P4: デコード済み WAV / 画像はフォルダ内で使い回す(キャッシュのクリアは processFiles = 新フォルダ時のみ)

    setIsLoading(true); setLoadingProgress(0); setLoadingMessage('BMSファイルを解析中...');

    try {
      const parsed = await parseBMS(bmsFile);
      setTimeout(() => { if (!parsed.isSupportedMode) alert("警告：この形式（9K/pop'n など）はまだ描画に対応していません。"); }, 100);
      const diffInfo = guessDifficulty(parsed.header, bmsFile.name);
      setDifficultyInfo(diffInfo); setRealtimeBpm(parsed.header.bpm); realtimeBpmRef.current = parsed.header.bpm; setCurrentBpm(parsed.header.bpm);

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
      // ★修正: React stateのcurrentBackBga(stale closure)に頼らず、ローカル変数でこの読み込み処理内の割り当て状況を追跡する
      let stageFileAssigned = false;
      let videoDetected = false; // ★修正: 動画アセットを検出したかどうか（hasVideoに反映する）

      for (const item of imageQueue) {
          try {
              let asset = imageAssetsRef.current.get(item.key);
              const isVideo = asset ? asset.type === 'video' : /\.(mp4|webm|mov)$/i.test(item.file.name);
              if (!asset) { // ★P4: 未キャッシュのものだけ生成
                  const url = URL.createObjectURL(item.file);
                  if (isVideo) asset = { type: 'video', url };
                  else { asset = new Image(); asset.src = url; }
                  imageAssetsRef.current.set(item.key, asset);
              }
              if (isVideo) videoDetected = true;
              if (parsed.header.stagefile && item.key === parsed.header.stagefile.toLowerCase()) {
                  if (!isVideo) { setCurrentBackBga(asset); stageFileAssigned = true; }
              }
          } catch(e) { console.warn("Asset load failed", item.key); }
      }

      // ★修正: hasVideoは動画BGAの検出結果をそのまま反映（今まで一度もtrueにならなかった）
      setHasVideo(videoDetected);

      if (parsed.header.stagefile && !stageFileAssigned) { 
          const asset = imageAssetsRef.current.get(parsed.header.stagefile.toLowerCase());
          if(asset && asset.type !== 'video') setCurrentBackBga(asset); 
      }

      const queue = [];
      neededAudio.forEach(raw => {
        const key = raw.toLowerCase();
        if (audioBuffersRef.current.has(key)) return; // ★P4: デコード済みはスキップ
        const base = getBaseName(raw).toLowerCase(); const candidates = fileMap[base];
        if (candidates?.length) {
          let best = candidates[0]; const exact = candidates.find(c => c.name.toLowerCase() === key);
          if (exact) best = exact;
          queue.push({ key, file: best });
        }
      });
      queue.sort((a, b) => b.file.size - a.file.size);

      if (queue.length > 0) setLoadingMessage(`音声ファイルを読み込み中... (新規 ${queue.length}個)`);
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
      const lasts = new Array(MAX_LANES).fill(null);
      parsed.objects.forEach(obj => {
          if (obj.isNote && obj.laneIndex >= 0 && obj.laneIndex <= 7) {
              // より後ろの時間にあるノーツを更新していく
              if (!lasts[obj.laneIndex] || obj.time > lasts[obj.laneIndex].time) {
                  lasts[obj.laneIndex] = obj;
              }
          }
      });
      lastNotesByLaneRef.current = lasts;
      setDuration(calculatedMaxDuration); setParsedSong(parsed); setTotalNotes(parsed.totalNotes);
      setPlaybackTimeDisplay(0); pauseTimeRef.current = 0; setCombo(0); comboRef.current = 0; hudLastRef.current = {};
      lastPlayedSoundPerLaneRef.current.fill(null); noteCountsRef.current.fill(0); setNoteCounts(new Array(MAX_LANES).fill(0));
      setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: parsed.avgDensity });
      lastStateUpdateRef.current = 0; // 次の renderLoop フレームで HUD を即更新させる
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
      const currentPolyCount = activeNodesRef.current.length;
      // ★軽量化: 40Hz の setState をやめ、値は ref に記録するだけ。表示は renderLoop の 100ms ブロックで間引く。
      polyphonyRef.current = currentPolyCount;
      if (currentPolyCount > maxPolyRef.current) maxPolyRef.current = currentPolyCount;
      // ★修正+軽量化: 平均算出用の履歴を積む。無限に伸びないよう一定数でキャップする
      polyphonyHistoryRef.current.push(currentPolyCount);
      if (polyphonyHistoryRef.current.length > 400) polyphonyHistoryRef.current.shift();
      while (index < objects.length) {
          const obj = objects[index];
          const absolutePlayTime = startTimeRef.current + obj.time;
          if (absolutePlayTime > scheduleUntil) break;
          if (absolutePlayTime < currentTime - 0.1) { index++; continue; }

          if (parsedSong.header.wavs[obj.value]) {
              const buffer = audioBuffersRef.current.get(parsedSong.header.wavs[obj.value].toLowerCase());
              if (buffer) {
                // ★P2: 音源を「キー音 / BGM(著しく長い) / バックサウンド」の排他3カテゴリに分類。
                //   各カテゴリを別々のトグルで制御し、判定の重複をなくす。
                const category = obj.isNote ? 'key'
                    : (buffer.duration >= BGM_MIN_DURATION ? 'bgm' : 'back');
                let shouldPlay = true;
                if (category === 'key') {
                    if (!playKeySoundsRef.current) shouldPlay = false;
                    if (laneMuteRef.current[obj.laneIndex]) shouldPlay = false; // ★P5-2 レーンミュート
                    if (isInputDebugModeRef.current && muteDebugAutoPlayRef.current) shouldPlay = false;
                } else if (category === 'bgm') {
                    if (!playLongAudioRef.current) shouldPlay = false;   // 「BGMを再生」トグル
                } else {
                    if (!playBgSoundsRef.current) shouldPlay = false;    // 「バックサウンドを再生」トグル
                }

                const isBgm = category === 'bgm';        // BACKING TRACK パネルに載せるか
                const isLong = buffer.duration > 10.0;   // ポリフォニー上限の対象外にするか(既存挙動を維持)
                const item = {
                    id: nextSoundIdRef.current++,
                    name: obj.filename,
                    startTime: obj.time,
                    endTime: obj.time + buffer.duration,
                    displayDuration: buffer.duration,
                    isLong: isBgm,
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
                    if (isBgm) {
                        activeLongSoundsRef.current.push(item);
                        setBackingTracks(prev => [...prev, item]);
                    }
                    else { 
                        // ★軽量化: LogPanelはslice(-25)しか使わないのに、これまで曲の最初から最後まで無制限に配列が伸び続けていた
                        // (密度の高い譜面だと数千件たまり、メモリ・GC負荷の原因になる)。直近100件だけ保持する。
                        activeShortSoundsRef.current.push(item);
                        if (activeShortSoundsRef.current.length > 100) activeShortSoundsRef.current.shift();
                    }
                }
              }
          }
          if (obj.isNote && !laneMuteRef.current[obj.laneIndex]) { // ★P5-2 ミュートレーンは打鍵音も鳴らさない
               const hitTime = Math.max(currentTime, absolutePlayTime);
               const buffer = (obj.laneIndex === 0 || obj.laneIndex === 8) ? scratchHitSoundBufferRef.current : keyHitSoundBufferRef.current;

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
  // setInterval が常に最新の scheduleAudio クロージャを呼ぶようにする(displayObjects/parsedSong の stale 化を防ぐ)
  scheduleAudioRef.current = scheduleAudio;

  // READY/GO の演出テキスト(shadowBlur付き)をオフスクリーンに1回だけ焼く。
  const buildReadyTextCache = () => {
    const mk = (text, font, fill, glow, blur) => {
      const c = document.createElement('canvas');
      c.width = 480; c.height = 140;
      const cx = c.getContext('2d');
      cx.shadowColor = glow; cx.shadowBlur = blur;
      cx.fillStyle = fill; cx.font = font;
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(text, 240, 70);
      return c;
    };
    return (readyTextCacheRef.current = {
      GO: mk('GO!!', 'bold italic 80px sans-serif', '#ff3333', '#ff0000', 30),
      READY: mk('READY...', 'bold italic 60px sans-serif', '#ffffff', '#00ccff', 20),
    });
  };
  useEffect(() => { buildReadyTextCache(); }, []); // 初回描画時のヒッチを避けるためマウント時に生成

  // 指定時刻(offset 秒)へ「位置」を同期する。startPlayback とシークの軽い処理から共用。
  //  - startTimeRef(再生中の描画基準時刻)
  //  - nextNoteIndexRef(スケジューラ開始位置)
  //  - BGA の各インデックスと、その時点で表示すべき BGA フレーム(変化時のみ setState)
  const applySeekPosition = (offset) => {
    if (isPlayingRef.current && audioContextRef.current) {
      startTimeRef.current = audioContextRef.current.currentTime - offset;
    }
    if (!parsedSong) return;
    nextNoteIndexRef.current = findStartIndex(displayObjects, offset - (parsedSong.maxLNDuration || 20.0));

    const syncBga = (arr, idxRef, setter, keyProp) => {
      if (!arr) return;
      let idx = arr.length;
      let chosenAsset = null;   // null = まだ無し / {..} = 表示すべきアセット / 'CLEAR' = 消灯
      let chosenStart = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].time >= offset) { idx = i; break; }
        const obj = arr[i];
        const fn = parsedSong.header.bmps[obj.value];
        if (fn) {
          const asset = imageAssetsRef.current.get(fn.toLowerCase());
          if (asset) { chosenAsset = asset; chosenStart = obj.time; }
        } else if (obj.value === 0) {
          chosenAsset = 'CLEAR'; chosenStart = 0;
        }
      }
      idxRef.current = idx;
      const key = chosenAsset === null ? 'none'
        : chosenAsset === 'CLEAR' ? 'clear'
        : `${chosenAsset.url || chosenAsset.src || 'img'}|${chosenStart}`;
      if (lastBgaKeyRef.current[keyProp] === key) return; // 表示中の BGA と同じ → setState しない
      lastBgaKeyRef.current[keyProp] = key;
      if (chosenAsset === null) return;
      if (chosenAsset === 'CLEAR') { setter(null); return; }
      setter(chosenAsset.type === 'video' ? { ...chosenAsset, startTime: chosenStart } : chosenAsset);
    };
    syncBga(parsedSong.backBgaObjects, nextBackBgaIndexRef, setCurrentBackBga, 'back');
    syncBga(parsedSong.layerBgaObjects, nextLayerBgaIndexRef, setCurrentLayerBga, 'layer');
    syncBga(parsedSong.poorBgaObjects, nextPoorBgaIndexRef, setCurrentPoorBga, 'poor');
  };

  const startPlayback = () => {
    if (!parsedSong || isLoading) return;
    applyHitSounds(tempKeyHitSoundBuffer, tempScratchHitSoundBuffer, isSeparateHitSound, tempKeySoundName, tempScratchSoundName);
    if (!parsedSong.isSupportedMode) {
        setTimeout(() => alert("未実装：この形式（9K/pop'n など）の再生はまだサポートされていません。"), 10);
        return;
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
    
    stopAudioNodes(); activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]);
    const offset = pauseTimeRef.current;
    setIsPlaying(true); isPlayingRef.current = true; lastFrameTimeRef.current = performance.now();
    applySeekPosition(offset); // startTimeRef / nextNoteIndexRef / BGA インデックス・フレームを同期

    if (showReady && offset === 0) {
        setReadyAnimState('READY');
        setTimeout(() => setReadyAnimState('GO'), 1000); setTimeout(() => setReadyAnimState(null), 1800);
    } else {
        setReadyAnimState(null);
    }
    if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
    schedulerTimerRef.current = setInterval(() => { if (scheduleAudioRef.current) scheduleAudioRef.current(); }, SCHEDULE_INTERVAL);
    stopRenderLoop();
    scheduleRenderLoop();
  };

  const stopAudioNodes = () => {
      activeNodesRef.current.forEach(n => { 
          try { n.node.stop(); n.node.disconnect(); } catch(e){} 
      });
      activeNodesRef.current = [];

      activeDebugSoundsRef.current.forEach(node => {
          try { node.stop(); node.disconnect(); } catch(e){}
      });
      activeDebugSoundsRef.current.clear();
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
  };

  const pausePlayback = () => {
    setIsPlaying(false); isPlayingRef.current = false; stopAudioNodes();
    pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
    setReadyAnimState(null);
    stopRenderLoop();
    if (isInputDebugModeRef.current) scheduleRenderLoop();
  };

  const stopPlayback = (reset = true) => {
    const wasPlaying = isPlayingRef.current;
    setIsPlaying(false); isPlayingRef.current = false;
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

        pauseTimeRef.current = 0; setPlaybackTimeDisplay(0); setCombo(0); comboRef.current = 0; hudLastRef.current = {}; lastBgaKeyRef.current = {};
        lastPlayedSoundPerLaneRef.current.fill(null); noteCountsRef.current.fill(0); setNoteCounts(new Array(MAX_LANES).fill(0));
        if (parsedSong) displayObjects.forEach(o => o.processed = false);
        setCurrentMeasureLines([]); setCurrentMeasureNotes({ processed: 0, total: 0, average: parsedSong?.avgDensity || 0 });
        currentMeasureRef.current = -1; lastStateUpdateRef.current = 0; setRealtimeBpm(parsedSong?.header.bpm || 130); realtimeBpmRef.current = parsedSong?.header.bpm || 130; setReadyAnimState(null);
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

    stopRenderLoop();
    longAudioProgressRefs.current.forEach(el => el.style.width = '0%');
    setTimeout(() => { scheduleRenderLoop(); }, 0);
  };

  // シーク確定(重い処理): setState 群と startPlayback。ドラッグ中は debounce し、止まった時に1回だけ実行。
  const commitSeek = () => {
    seekCommitTimerRef.current = null;
    setPlaybackTimeDisplay(pauseTimeRef.current);
    setBackingTracks([]); activeLongSoundsRef.current = []; activeShortSoundsRef.current = [];
    hudLastRef.current = {}; lastStateUpdateRef.current = 0; // 次フレームで HUD(imperative)を即再評価
    if (isPlayingRef.current) startPlayback();
    else scheduleRenderLoop();
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    pauseTimeRef.current = val;
    // ★シーク時は在再生中の音源(ロングBGMを含む)を必ず停止する。isPlaying に依存せず毎回止めて音の重なりを防ぐ。
    stopAudioNodes();

    // --- 軽い処理: 毎 onChange 実行(描画が毎フレーム参照するため) ---
    // オートプレイのコンボ = ここまでに通過したノーツ総数。0クリアせず再計算する。
    const targetObjects = displayObjects;
    noteCountsRef.current.fill(0);
    let passedNotes = 0;
    for (const obj of targetObjects) {
        obj.processed = obj.time < val;
        if (obj.isNote && obj.processed) {
            passedNotes++;
            if (obj.laneIndex >= 0 && obj.laneIndex <= 7) noteCountsRef.current[obj.laneIndex]++;
        }
    }
    comboRef.current = passedNotes;
    hudLastRef.current = {}; lastStateUpdateRef.current = 0; // スクラブ中も HUD(imperative)を追従させる
    clearActiveLanes();
    // 位置の同期(startTimeRef / nextNoteIndexRef / BGA インデックス・フレーム)は必ず同期実行する。
    // 遅延させると描画の再生位置と processed フラグがズレ、ノーツが消えたり BGA が空回りする。
    applySeekPosition(val);
    scheduleRenderLoop(); // 停止中でもスクラブ位置を描き直す

    // --- 重い処理(setState群・スケジューラ再開): ドラッグが止まってから1回だけ ---
    if (seekCommitTimerRef.current) clearTimeout(seekCommitTimerRef.current);
    seekCommitTimerRef.current = setTimeout(commitSeek, 100);
  };

  const renderLoop = () => {
    if (!canvasRef.current) return;
    const now = performance.now(); const dt = (now - lastFrameTimeRef.current) / 1000; lastFrameTimeRef.current = now;
    const canvas = canvasRef.current;
    // ★軽量化: getContext()は初回だけ呼び、以降はキャッシュを使い回す（毎フレーム呼ぶとブラウザによっては無駄なオーバーヘッドになる）
    // ★BGA修正: alpha:trueにして、canvasの透明部分から背面のBGAレイヤーが透けるようにする
    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d', { alpha: true });
    const ctx = ctxRef.current;
    const dpr = window.devicePixelRatio || 1;
    // ★軽量化: getBoundingClientRect() はレイアウト強制。ResizeObserver のキャッシュを使い、
    //   未取得の初回のみ実測する。
    const rect = canvasRectRef.current || (() => {
      const r = canvas.getBoundingClientRect();
      const v = { width: r.width, height: r.height };
      if (v.width > 0 && v.height > 0) canvasRectRef.current = v; // 0 サイズはキャッシュせず次フレーム再測定
      return v;
    })();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) { canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr; ctx.scale(dpr, dpr); }
    else ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const currentTime = isPlayingRef.current && audioContextRef.current ? audioContextRef.current.currentTime - startTimeRef.current : pauseTimeRef.current;

    const bgaTime = currentTime + 0.05;

    if (parsedSong) {
        // ★重大バグ修正: ここで activeNodesRef をフィルタしていたが、
        //   n.endTime は「AudioContext の絶対時刻」なのに currentTime は「曲の相対時刻」で、時間軸が不一致だった。
        //   セッション開始直後や長い曲の後半へシークして startTimeRef が小さい/負になると、
        //   まだ鳴っている音源(ロングBGM含む)が activeNodesRef から誤って除去され、
        //   stopAudioNodes() が止められなくなって「シークのたびにロング音源が重なる」原因になっていた。
        //   activeNodesRef の掃除は scheduleAudio() 側(絶対時刻で正しく比較)に一本化する。
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

        // ★軽量化: activeNodesRef のフィルタは scheduleAudio() 側で毎tick行っているため、
        // ここ(renderLoop、毎フレーム)での重複フィルタ処理は削除

        // 2. 再生時間の表示更新：解析用に毎フレーム実行する（高精度維持）
        // ここをif文の外に出すことで、滑らかな数値変化に戻ります
        //setPlaybackTimeDisplay(currentTime);

        if (timeSliderRef.current) {
            timeSliderRef.current.value = currentTime;
        }

        if (pcControlBarRef.current) {
            pcControlBarRef.current.updateTime(currentTime);
        }
        if (infoPanelRef.current) {
            // 時間だけでなく、コンボ数なども渡せます
            infoPanelRef.current.updateInfo(currentTime, comboRef.current);
        }
        // モバイルは InfoPanel が無いので BGA の syncTime をここで直接呼ぶ(動画BGAの位置合わせ)
        if (isMobileRef.current) {
            mobileBackBgaRef.current?.syncTime(currentTime);
            mobileLayerBgaRef.current?.syncTime(currentTime);
            mobilePoorBgaRef.current?.syncTime(currentTime);
        }

        // 3. その他の重い処理（小節線の計算やログ表示用のリスト更新など）
        // これらは毎フレームやる必要がないので、ここだけ間引いて軽量化します
        if (now - lastStateUpdateRef.current > 100) { // 100ms(秒間10回)程度に設定
            const H = hudLastRef.current;
            // ★軽量化(Part2): 高頻度で変わる HUD 値は setState せず、memo 化した子へ imperative 更新する。
            //   これで定BPM再生中の BmsViewer 本体の再レンダリングは「小節が変わったとき(〜0.5Hz)」だけになる。

            // POLY / M POLY / AVG POLY → LogPanel(imperative)
            let avgPoly = H.avgPoly || 0;
            if (polyphonyHistoryRef.current.length > 0) {
                const sum = polyphonyHistoryRef.current.reduce((a, b) => a + b, 0);
                avgPoly = Math.round(sum / polyphonyHistoryRef.current.length);
            }
            if (polyphonyRef.current !== H.poly || maxPolyRef.current !== H.maxPoly || avgPoly !== H.avgPoly) {
                H.poly = polyphonyRef.current; H.maxPoly = maxPolyRef.current; H.avgPoly = avgPoly;
                logPanelRef.current?.updatePoly(H.poly, H.maxPoly, H.avgPoly);
            }
            // レーン別ノーツ数 → ControllerPanel(imperative)。comboRef を dirty シグナルに。
            if (comboRef.current !== H.combo) {
                H.combo = comboRef.current;
                controllerPanelRef.current?.updateCounts(noteCountsRef.current);
            }
            if (parsedSong) {
                const currentBar = parsedSong.barLines.find(b => b.time > currentTime);
                const newMeasure = currentBar ? currentBar.measure - 1 : parsedSong.barLines.length - 1;
                const mStart = parsedSong.barLines[newMeasure]?.time || 0;
                const mEnd = parsedSong.barLines[newMeasure + 1]?.time || 99999;
                const processedInMeasure = displayObjects.filter(o => o.isNote && o.processed && o.time >= mStart && o.time < mEnd).length;
                const totalInMeasure = parsedSong.notesPerMeasure[newMeasure] || 0;

                if (newMeasure !== currentMeasureRef.current) {
                    // ここだけ setState(〜0.5Hz)。currentMeasure は DensityGraph のオートスクロール、
                    // currentMeasureLines は BMS MONITOR の表示に使う。
                    currentMeasureRef.current = newMeasure;
                    setCurrentMeasure(newMeasure);
                    if (parsedSong.rawLinesByMeasure[newMeasure]) setCurrentMeasureLines(parsedSong.rawLinesByMeasure[newMeasure].map(l => ({ text: l, isCurrent: true })));
                    else setCurrentMeasureLines([]);
                }

                const currentBpmVal = getBpmFromTime(parsedSong.timePoints, currentTime);
                realtimeBpmRef.current = currentBpmVal; // 皿回転速度が最新BPMを読めるように
                const futureTime = currentTime + 2.0;
                const nextTp = parsedSong.timePoints.find(tp => tp.time > currentTime && tp.time <= futureTime && tp.bpm !== currentBpmVal);
                const nextBpmKey = nextTp ? `${nextTp.bpm}_${currentBpmVal}` : null;

                // MEASURE / BPM / 次BPM / WHT・GRN → InfoPanel(imperative)
                if (processedInMeasure !== H.measProc || totalInMeasure !== H.measTotal || currentBpmVal !== H.bpm || nextBpmKey !== H.nextBpmKey) {
                    H.measProc = processedInMeasure; H.measTotal = totalInMeasure; H.bpm = currentBpmVal; H.nextBpmKey = nextBpmKey;
                    const vm = visibilityModeRef.current;
                    let white = 0;
                    if (vm === VISIBILITY_MODES.SUDDEN_PLUS || vm === VISIBILITY_MODES.SUD_HID_PLUS) white += suddenPlusValRef.current;
                    if (vm === VISIBILITY_MODES.LIFT || vm === VISIBILITY_MODES.LIFT_SUD_PLUS) {
                        white += liftValRef.current;
                        if (vm === VISIBILITY_MODES.LIFT_SUD_PLUS) white += suddenPlusValRef.current;
                    }
                    white = Math.min(1000, Math.max(0, white));
                    const green = Math.round((240000 / ((currentBpmVal || 1) * (hiSpeedRef.current || 1))) * ((1000 - white) / 1000));
                    infoPanelRef.current?.updateStats({
                        measProc: processedInMeasure, measTotal: totalInMeasure,
                        dense: totalInMeasure >= parsedSong.avgDensity + 5,
                        bpm: Math.round(currentBpmVal),
                        nextBpm: nextTp ? { value: nextTp.bpm, dir: nextTp.bpm > currentBpmVal ? 'up' : 'down', old: Math.round(currentBpmVal) } : null,
                        white: Math.round(white), green,
                    });
                }

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

    const visMode = visibilityModeRef.current;
    const isLiftEnabled = visMode === VISIBILITY_MODES.LIFT || visMode === VISIBILITY_MODES.LIFT_SUD_PLUS;
    const liftOffset = isLiftEnabled ? liftValRef.current : 0;
    const BASE_JUDGE_Y = height - (isMobileRef.current ? 180 : 100);
    const JUDGE_Y = BASE_JUDGE_Y - liftOffset;
    const is2P = playSideRef.current === '2P';
    const mode = parsedSong?.mode || 'SP7';
    const isPmsMode = mode === 'PMS9';

    // --- レーンレイアウト (モード可変) ---
    let lanesArr = parsedSong?.lanes || DEFAULT_LANES;
    if (is2P && (mode === 'SP7' || mode === 'SP5')) {
        // SP 2P: 鍵は左→右のまま、皿だけ右側へ
        const keys = lanesArr.filter(l => l.kind === 'key');
        const scr = lanesArr.find(l => l.kind === 'scratch');
        lanesArr = scr ? [...keys, scr] : keys;
    }
    let totalU = 0;
    for (let i = 0; i < lanesArr.length; i++) {
        if (i > 0) totalU += (lanesArr[i].side !== lanesArr[i - 1].side ? SIDE_GAP_UNITS : LANE_GAP_UNITS);
        totalU += (lanesArr[i].kind === 'scratch' ? SCRATCH_UNITS : 1.0);
    }
    const KEY_W = Math.max(7, Math.min(40, (width - 24) / totalU));
    const laneX = _laneXScratch, laneW = _laneWScratch;
    laneW.fill(0);
    let cx = 0;
    for (let i = 0; i < lanesArr.length; i++) {
        if (i > 0) cx += KEY_W * (lanesArr[i].side !== lanesArr[i - 1].side ? SIDE_GAP_UNITS : LANE_GAP_UNITS);
        const w = KEY_W * (lanesArr[i].kind === 'scratch' ? SCRATCH_UNITS : 1.0);
        laneX[lanesArr[i].index] = cx; laneW[lanesArr[i].index] = w;
        cx += w;
    }
    const BOARD_W = cx;
    const BOARD_X = (width - BOARD_W) / 2;

    // ★軽量化: ノーツ演出のグラデーション/色はレーン単位で使い回す。ジオメトリが変わったときだけ再構築。
    const gradKey = `${JUDGE_Y}|${KEY_W}|${Math.round(BOARD_X)}|${mode}|${is2P}`;
    const gc = gradCacheRef.current;
    if (gc.key !== gradKey) {
        gc.key = gradKey;
        gc.ln = new Array(MAX_LANES); gc.hit = new Array(MAX_LANES); gc.color = new Array(MAX_LANES); gc.isScr = new Array(MAX_LANES).fill(false);
        for (const lane of lanesArr) {
            const gx = BOARD_X + laneX[lane.index];
            const ln = ctx.createLinearGradient(gx, JUDGE_Y, gx, JUDGE_Y - 300);
            ln.addColorStop(0, 'rgba(100, 200, 255, 0.3)'); ln.addColorStop(1, 'rgba(0,0,0,0)');
            gc.ln[lane.index] = ln;
            const col = laneNoteColor(lane, isPmsMode ? PMS_LANE_COLORS : null);
            gc.color[lane.index] = col;
            gc.isScr[lane.index] = lane.kind === 'scratch';
            const hit = ctx.createLinearGradient(gx, JUDGE_Y, gx, JUDGE_Y - 200);
            hit.addColorStop(0, col); hit.addColorStop(1, 'rgba(0,0,0,0)');
            gc.hit[lane.index] = hit;
        }
    }

    const bOpacity = boardOpacityRef.current;
    const lOpacity = laneOpacityRef.current;
    const laneHeight = isLiftEnabled ? JUDGE_Y : height;

    // ★軽量化(Part1): 静的な板はオフスクリーンに1回だけ描き、毎フレームは drawImage。
    const boardKey = `${width}|${height}|${dpr}|${KEY_W}|${Math.round(BOARD_X)}|${Math.round(BOARD_W)}|${JUDGE_Y}|${isLiftEnabled}|${mode}|${is2P}|${bOpacity}|${lOpacity}|${isMobileRef.current}|${showSettings}|${!!parsedSong}`;
    const bl = boardLayerRef.current;
    if (bl.key !== boardKey) {
        bl.key = boardKey;
        const oc = bl.canvas || (bl.canvas = document.createElement('canvas'));
        oc.width = Math.max(1, Math.round(width * dpr));
        oc.height = Math.max(1, Math.round(height * dpr));
        const bx = oc.getContext('2d');
        bx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bx.clearRect(0, 0, width, height);
        bx.fillStyle = `rgba(2, 6, 23, ${bOpacity})`;
        bx.fillRect(BOARD_X, 0, BOARD_W, height);
        for (const lane of lanesArr) {
            bx.fillStyle = laneBgColor(lane, lOpacity, isMobileRef.current, isPmsMode);
            bx.fillRect(BOARD_X + laneX[lane.index], 0, laneW[lane.index], laneHeight);
        }
        bx.strokeStyle = isMobileRef.current ? `rgba(51, 65, 85, ${lOpacity})` : '#334155';
        bx.lineWidth = 1; bx.beginPath();
        for (const lane of lanesArr) {
            const lx = BOARD_X + laneX[lane.index];
            bx.moveTo(lx, 0); bx.lineTo(lx, laneHeight);
            bx.moveTo(lx + laneW[lane.index], 0); bx.lineTo(lx + laneW[lane.index], laneHeight);
        }
        bx.stroke();
        if (!showSettings && parsedSong) {
            bx.strokeStyle = '#ef4444';
            bx.lineWidth = 2; bx.beginPath(); bx.moveTo(BOARD_X, JUDGE_Y); bx.lineTo(BOARD_X + BOARD_W, JUDGE_Y); bx.stroke();
        }
    }
    ctx.drawImage(bl.canvas, 0, 0, width, height);

    const currentActiveLanes = _activeLanesScratch; currentActiveLanes.fill(false); // ★軽量化: 毎フレームの配列割り当てを排除

    if (parsedSong) {
        const currentBeat = getBeatFromTime(parsedSong.timePoints, currentTime);
        const visibleDuration = 4.0 / hiSpeedRef.current; const visibleEndBeat = currentBeat + visibleDuration;

        ctx.strokeStyle = '#64748b'; ctx.textAlign = 'left';
        ctx.font = '10px Arial';
        // ★軽量化: 毎フレーム先頭から continue で走査していた(曲後半で数百回)。可視開始を二分探索する。
        const bars = parsedSong.barLines;
        const beatFloor = currentBeat - 0.5;
        let blo = 0, bhi = bars.length - 1, bStart = bars.length;
        while (blo <= bhi) { const mid = (blo + bhi) >> 1; if (bars[mid].beat < beatFloor) blo = mid + 1; else { bStart = mid; bhi = mid - 1; } }
        for (let bi = bStart; bi < bars.length; bi++) {
            const bar = bars[bi];
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
            const mAlpha = laneMuteRef.current[obj.laneIndex] ? 0.28 : 1; // ★P5-2 ミュートレーンは薄く
            const beatDelta = obj.beat - currentBeat;
            const timeDelta = obj.time - currentTime;
            
            // ★オートプレイ判定をフレームレート非依存に:
            //   フレーム落ちしても timeDelta<=0 のノーツはすべて「取りこぼしキャッチアップ」で処理する。
            //   以前は 30ms(-0.03s)の窓を外すとコンボが加算されず、-0.2s を超えると triggerMiss() が誤発火していた。
            //   timeline 由来の triggerMiss は廃止 (MISS は入力プレイ時のみ)。
            if (!obj.processed && timeDelta <= 0) {
                obj.processed = true;
                comboRef.current++; noteCountsRef.current[obj.laneIndex]++; lastPlayedSoundPerLaneRef.current[obj.laneIndex] = obj.filename;
                if (obj.laneIndex === 0 || obj.laneIndex === 8) {
                    const scIdx = obj.laneIndex;
                    let dist = 999;
                    for (let k = i + 1; k < displayObjects.length; k++) {
                        const nextObj = displayObjects[k];
                        if (nextObj.laneIndex === scIdx) { dist = nextObj.time - obj.time; break; }
                        if (nextObj.time - obj.time > 5.0) break;
                    }
                    const typeRef = scIdx === 0 ? lastScratchTypeRef : lastScratchType2Ref;
                    const dirRef = scIdx === 0 ? scratchDirectionRef : scratchDirection2Ref;
                    const timeRef2 = scIdx === 0 ? lastScratchTimeRef : lastScratchTime2Ref;
                    if (dist < 0.6) { typeRef.current = 'ACCEL'; dirRef.current = dirRef.current * -1; }
                    else { typeRef.current = 'REVERSE'; dirRef.current = -1; }
                    // 大きく取りこぼした(過去すぎる)スクラッチでは皿の空転エフェクトを起こさない
                    if (isPlayingRef.current && timeDelta > -0.12) timeRef2.current = now;
                }
            }

            // 描画はレーン幅が確定しているものだけ(コンボ加算は上で済ませてある)
            const w = laneW[obj.laneIndex];
            if (!w) continue;
            const x = BOARD_X + laneX[obj.laneIndex];

            const yBase = JUDGE_Y - (beatDelta / visibleDuration * BASE_JUDGE_Y);
            if (obj.type === 'long') {
                const endBeatDelta = obj.endBeat - currentBeat;
                const yEnd = JUDGE_Y - (endBeatDelta / visibleDuration * BASE_JUDGE_Y);
                if (beatDelta <= 0 && endBeatDelta > 0) {
                    currentActiveLanes[obj.laneIndex] = true;
                    if (mAlpha !== 1) ctx.globalAlpha = mAlpha;
                    ctx.fillStyle = gc.ln[obj.laneIndex];   // ★キャッシュ済みグラデーション
                    ctx.fillRect(x, JUDGE_Y - 300, w, 300);
                    if (mAlpha !== 1) ctx.globalAlpha = 1;
                }
                const drawBottom = Math.min(JUDGE_Y, yBase);
                const drawTop = yEnd;
                if (drawTop <= height) {
                    const h = drawBottom - drawTop;
                    if (h > 0 && drawBottom > -50) {
                        if (mAlpha !== 1) ctx.globalAlpha = mAlpha;
                        ctx.fillStyle = gc.isScr[obj.laneIndex] ? '#ef4444' : '#f59e0b';
                        ctx.fillRect(x + 1, drawTop, w - 2, h);
                        if (mAlpha !== 1) ctx.globalAlpha = 1;
                    }
                }
            } else {
                if (obj.processed) {
                    if (timeDelta > -0.05 && timeDelta > -0.2) {
                        currentActiveLanes[obj.laneIndex] = true;
                        const alpha = (1.0 - (timeDelta / -0.05)) * mAlpha;
                        // ★軽量化: グラデーションはレーン単位でキャッシュ済み。フェードは globalAlpha で。
                        ctx.globalAlpha = alpha;
                        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, JUDGE_Y - 5, w, 10);
                        ctx.globalAlpha = alpha * 0.6;
                        ctx.fillStyle = gc.hit[obj.laneIndex];
                        ctx.fillRect(x, JUDGE_Y - 200, w, 200);
                        ctx.globalAlpha = 1;
                    }
                    continue;
                }
                const y = yBase;
                if (mAlpha !== 1) ctx.globalAlpha = mAlpha;
                ctx.fillStyle = gc.color[obj.laneIndex] || '#f1f5f9';
                ctx.fillRect(x + 1, y - 6, w - 2, 12);
                if (mAlpha !== 1) ctx.globalAlpha = 1;
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
    const baseSpeed = ((realtimeBpmRef.current || 130) / 60) * 135;
    const effectDuration = 200;

    // 皿の回転速度倍率 (1P/2P 共通)
    const scratchSpeed = (active, lastTime, typeRef, dirRef) => {
        const since = now - lastTime;
        let m;
        if (isInputDebugModeRef.current && (isShiftHeldRef.current || isCtrlHeldRef.current)) {
            m = isShiftHeldRef.current ? -1.0 : 2.5;
        } else if (isPlayingRef.current) {
            if (active) m = -1.0;
            else if (since < effectDuration) m = (typeRef.current === 'ACCEL') ? 1.5 * dirRef.current : -1.0;
            else m = 1.0;
        } else m = 1.0;
        if (!scratchRotationEnabledRef.current && Math.abs(m) === 1.0 && !active && since >= effectDuration && !isShiftHeldRef.current) m = 0;
        return m;
    };

    const sideFactor = ((mode === 'SP7' || mode === 'SP5') && playSideRef.current === '2P') ? -1 : 1;
    scratchAngleRef.current += baseSpeed * scratchSpeed(currentActiveLanes[0], lastScratchTimeRef.current, lastScratchTypeRef, scratchDirectionRef) * sideFactor * safeDt;
    const scratchCtrl = controllerRefs.current[0];
    if (scratchCtrl) scratchCtrl.style.transform = `rotate(${scratchAngleRef.current}deg)`;
    const scratchCtrl2 = controllerRefs.current[8]; // DP 2P 皿 (逆回転)
    if (scratchCtrl2) {
        scratchAngle2Ref.current += baseSpeed * scratchSpeed(currentActiveLanes[8], lastScratchTime2Ref.current, lastScratchType2Ref, scratchDirection2Ref) * -1 * safeDt;
        scratchCtrl2.style.transform = `rotate(${scratchAngle2Ref.current}deg)`;
    }

    // ★軽量化: 毎フレーム8レーン分の style 一括書き込みをやめ、状態が変化したレーンだけ書き込む。
    for (let lane = 0; lane < MAX_LANES; lane++) {
        const active = currentActiveLanes[lane] || activeInputLanesRef.current.has(lane);
        if (laneVisualRef.current[lane] !== active) {
            laneVisualRef.current[lane] = active;
            setLaneActive(lane, active);
        }
    }
    // ★軽量化: COMBO/NOTES の毎フレーム setState を撤廃。
    //   COMBO は infoPanelRef.updateInfo() で innerText を毎フレーム更新済み。
    //   NOTES(noteCounts) と combo state の反映は下の 100ms ブロックで変化時のみ行う。

    if (showReady && readyAnimStateRef.current) {
        // ★軽量化: shadowBlur 付きテキストはオフスクリーンに焼いた画像を貼るだけ(下の useEffect で事前生成)。
        const rc = readyTextCacheRef.current || buildReadyTextCache();
        const img = readyAnimStateRef.current === 'GO' ? rc.GO : rc.READY;
        ctx.drawImage(img, (width - img.width) / 2, (height - img.height) / 2);
    }

    // 描画継続の判定。多重生成しないよう再スケジュールは scheduleRenderLoop() 経由に統一。
    if (isPlayingRef.current || showReady || isInputDebugModeRef.current) {
        scheduleRenderLoop();
    }
  };
  // rAF ループが常に最新の renderLoop クロージャを呼ぶようにする(古い state を掴み続けるのを軽減)
  renderLoopRef.current = renderLoop;

  const is2P = playSide === '2P';

  // 子(ControlBar / SettingsModal)の React.memo を効かせるための、参照が安定したハンドラ群
  const sHandleFileSelect = useEvent(handleFileSelect);
  const sHandleZipSelect = useEvent(handleZipSelect);
  const sStopPlayback = useEvent(stopPlayback);
  const sPausePlayback = useEvent(pausePlayback);
  const sStartPlayback = useEvent(startPlayback);
  const sHandleSeek = useEvent(handleSeek);
  const sToggleMute = useEvent(toggleMute);
  const sRefreshRandom = useEvent(refreshRandom);
  const sKeyHitUpload = useEvent(handleKeyHitSoundUpload);
  const sKeyHitReset = useEvent(handleKeyHitSoundReset);
  const sScratchHitUpload = useEvent(handleScratchHitSoundUpload);
  const sScratchHitReset = useEvent(handleScratchHitSoundReset);
  // HI-SPEED を手動で変更したらオートHI-SPEEDを OFF にする
  const sHiSpeedChange = useEvent((v) => { setAutoHiSpeed(false); setHiSpeed(v); });

  return (
    <div className={`flex flex-col h-screen bg-neutral-950 text-white font-sans overflow-hidden ${isDragOver ? 'ring-4 ring-blue-500' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      
      <SettingsModal
        showSettings={showSettings} setShowSettings={setShowSettings} isMobile={isMobile}
        visibilityMode={visibilityMode} setVisibilityMode={setVisibilityMode}
        suddenPlusVal={suddenPlusVal} setSuddenPlusVal={setSuddenPlusVal} hiddenPlusVal={hiddenPlusVal} setHiddenPlusVal={setHiddenPlusVal} liftVal={liftVal} setLiftVal={setLiftVal}
        playSide={playSide} setPlaySide={setPlaySide} playOption={playOption} setPlayOption={setPlayOption} currentLaneOrder={currentLaneOrder} refreshRandom={sRefreshRandom}
        comboPos={comboPos} setComboPos={setComboPos}
        customKeyHitSound={customKeyHitSound} handleKeyHitSoundUpload={sKeyHitUpload} handleKeyHitSoundReset={sKeyHitReset}
        customScratchHitSound={customScratchHitSound} handleScratchHitSoundUpload={sScratchHitUpload} handleScratchHitSoundReset={sScratchHitReset}
        volume={volume} setVolume={setVolume} monitorUpdateInterval={monitorUpdateInterval} setMonitorUpdateInterval={setMonitorUpdateInterval}
        hasVideo={hasVideo} playBgaVideo={playBgaVideo} setPlayBgaVideo={setPlayBgaVideo} hitSoundVolume={hitSoundVolume} setHitSoundVolume={setHitSoundVolume}
        showReady={showReady} setShowReady={setShowReady} playKeySounds={playKeySounds} setPlayKeySounds={setPlayKeySounds} playLongAudio={playLongAudio} setPlayLongAudio={setPlayLongAudio}
        playBgSounds={playBgSounds} setPlayBgSounds={setPlayBgSounds} showMutedMonitor={showMutedMonitor} setShowMutedMonitor={setShowMutedMonitor}
        showAbortedMonitor={showAbortedMonitor} setShowAbortedMonitor={setShowAbortedMonitor} scratchRotationEnabled={scratchRotationEnabled} setScratchRotationEnabled={setScratchRotationEnabled}
        isInputDebugMode={isInputDebugMode} setIsInputDebugMode={setIsInputDebugMode}
        muteDebugAutoPlay={muteDebugAutoPlay} setMuteDebugAutoPlay={setMuteDebugAutoPlay}
        keyMaps={keyMaps} setKeyMaps={setKeyMaps}
        isSeparateHitSound={isSeparateHitSound} setIsSeparateHitSound={setIsSeparateHitSound}
        tempKeySoundName={tempKeySoundName} tempScratchSoundName={tempScratchSoundName}
        // Mobile Controls
        handleFileSelect={sHandleFileSelect} handleZipSelect={sHandleZipSelect} bmsList={bmsList} selectedBmsIndex={selectedBmsIndex} setSelectedBmsIndex={setSelectedBmsIndex}
        isPlaying={isPlaying} startPlayback={sStartPlayback} pausePlayback={sPausePlayback} stopPlayback={sStopPlayback}
        hiSpeed={hiSpeed} setHiSpeed={sHiSpeedChange} bgaOpacity={bgaOpacity} setBgaOpacity={setBgaOpacity}
        autoHiSpeed={autoHiSpeed} setAutoHiSpeed={setAutoHiSpeed} targetGreen={targetGreen} setTargetGreen={setTargetGreen}
        laneMute={laneMute} setLaneMute={setLaneMute}
        laneOpacity={laneOpacity} setLaneOpacity={setLaneOpacity}
        boardOpacity={boardOpacity} setBoardOpacity={setBoardOpacity}
        parsedSong={parsedSong}
      />

      {/* メインエリア: PCとスマホで構造を分ける */}
      <div className="flex-1 relative min-h-0 overflow-hidden flex justify-center">
         
         {/* スマホ用: 背景BGA */}
         {isMobile && (
             <div className="absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none" style={{ opacity: bgaOpacity }}>
                <BgaLayer ref={mobileBackBgaRef} bgaState={currentBackBga} zIndex={0} isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
                <BgaLayer ref={mobileLayerBgaRef} bgaState={currentLayerBga} zIndex={10} blendMode="screen" isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
                {showMissLayer && currentPoorBga && (
                    <div className="absolute inset-0 w-full h-full z-50 bg-black/50 flex items-center justify-center">
                        <BgaLayer ref={mobilePoorBgaRef} bgaState={currentPoorBga} zIndex={50} isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
                    </div>
                )}
             </div>
         )}

         {/* PCレイアウト: 4カラム構成 */}
         {!isMobile && (
             <div className="flex w-full h-full">
                 {/* 左: コントローラー */}
                 <ControllerPanel
                    ref={controllerPanelRef}
                    controllerRefs={controllerRefs} keyboardRefs={keyboardRefs}
                    is2P={is2P} parsedSong={parsedSong} difficultyInfo={difficultyInfo}
                    currentMeasure={currentMeasure}
                    keyMap={keyMaps[parsedSong?.mode] || keyMaps.SP7}
                 />

                 {/* 中央左: 情報・BGA */}
                 <InfoPanel
                    ref={infoPanelRef}
                    setShowSettings={setShowSettings} playOption={playOption}
                    currentBackBga={currentBackBga} currentLayerBga={currentLayerBga} currentPoorBga={currentPoorBga}
                    showMissLayer={showMissLayer} isPlaying={isPlaying}
                    playBgaVideo={playBgaVideo} readyAnimState={readyAnimState}
                    currentMeasureLines={currentMeasureLines} totalNotes={totalNotes}
                 />

                 {/* 中央右: レーン (Canvas) */}
                 <div className="flex-1 bg-black relative flex justify-center border-r border-blue-900/30 overflow-hidden">
                    <canvas ref={canvasRef} className="h-full w-full max-w-[600px] shadow-[0_0_50px_rgba(0,0,0,0.5)]" />
                    {!parsedSong && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-blue-900/20"><div className="text-center animate-pulse"><FolderOpen size={64} className="mx-auto mb-4 opacity-50"/><p className="text-xl font-bold tracking-widest">DROP FILE HERE</p></div></div>}
                    {!showSettings && parsedSong && <div className="absolute bottom-[100px] w-full h-[2px] bg-red-500/60 pointer-events-none z-20 shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{maxWidth:'600px'}}/>}
                 </div>

                 {/* 右: ログパネル */}
                 <LogPanel
                    ref={logPanelRef}
                    backingTracks={backingTracks}
                    activeShortSoundsRef={activeShortSoundsRef}
                    lastPlayedSoundPerLaneRef={lastPlayedSoundPerLaneRef}
                    longAudioProgressRefs={longAudioProgressRefs}
                    isPlaying={isPlaying}
                    lanes={parsedSong?.lanes}
                    mode={parsedSong?.mode}
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
                 <input 
                    ref={timeSliderRef}  // ← これを追加！
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    step="0.01" 
                    defaultValue={0} // ← value={playbackTimeDisplay} を defaultValue={0} に変更！
                    onChange={handleSeek} 
                    className="w-full h-2 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500 backdrop-blur-sm" 
                 />
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
            ref={pcControlBarRef}
            handleFileSelect={sHandleFileSelect} selectedBmsIndex={selectedBmsIndex} setSelectedBmsIndex={setSelectedBmsIndex} bmsList={bmsList}
            stopPlayback={sStopPlayback} isPlaying={isPlaying} pausePlayback={sPausePlayback} startPlayback={sStartPlayback}
            duration={duration} handleSeek={sHandleSeek}
            hiSpeed={hiSpeed} setHiSpeed={sHiSpeedChange} volume={volume} setVolume={setVolume} toggleMute={sToggleMute}
          />
      )}
    </div>
  );
}