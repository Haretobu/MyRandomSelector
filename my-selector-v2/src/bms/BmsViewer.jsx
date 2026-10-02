// src/bms/BmsViewer.jsx
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { FolderOpen, Settings, Play, Pause, ChevronFirst } from 'lucide-react';

import { VISIBILITY_MODES, MOBILE_BREAKPOINT, DEFAULT_BGA_OPACITY, BGM_MIN_DURATION, PMS_LANE_COLORS, DEFAULT_KEYMAPS, DEFAULT_SCRATCH_ALT, DEFAULT_GAMEPAD_MAPS, DEFAULT_GAMEPAD_SCRATCH_ALT, DEFAULT_AUDIO_FX, DEFAULT_LITE_MODE } from './constants';
import { findStartIndex, getBpmFromTime, guessDifficulty, extractZipFiles } from './logic/utils';
import { parseBMS } from './logic/parser';
import { collectSongAssets, buildFileMap, prepareImageAssets, decodeSongAudio, computeSongTiming } from './logic/songLoader';
import { createLiveStore } from './logic/liveStore';
import { buildJudgeConfig } from './logic/judge';
import { useStoredState, useLatestRef, BOOL, oneOf, num, mergedJson } from './hooks/useStoredState';

import SettingsModal from './components/SettingsModal';
import ControllerPanel from './components/ControllerPanel';
import InfoPanel from './components/InfoPanel';
import LogPanel from './components/LogPanel';
import ControlBar from './components/ControlBar';
import BgaStage from './components/BgaStage';
import ResultModal from './components/ResultModal';
import LoadingOverlay from './components/LoadingOverlay';
import MobileBgaLayers, { BgaPlaceholder } from './components/MobileBgaLayers';
import { MAX_LANES, DEFAULT_LANES, boardUnitsFor, laneNoteColor } from './render/laneLayout';
import { useEvent } from './hooks/useEvent';
import { LaneRenderer } from './render/LaneRenderer';
import { AudioEngine } from './audio/AudioEngine';
import { PlayJudge } from './game/PlayJudge';
import { buildLaneMap } from './input/laneMaps';
import { GamepadInput, useGamepadConnection } from './input/GamepadInput';
import { useLaneKeyboard } from './input/useLaneKeyboard';
import { applyLaneOptions } from './logic/laneOptions';
import { whiteNumber, greenNumber, hiSpeedForGreen, songBaseBpm } from './logic/greenNumber';

// localStorage の設定値マージ: モード別の設定(キー割り当て等)は、モードごとに既定値へ保存値を重ねる
const mergePerMode = (defaults, saved) =>
  Object.fromEntries(Object.keys(defaults).map(m => [m, { ...defaults[m], ...(saved[m] || {}) }]));
const mergeAudioFx = (d, s) => ({
  ...d, ...s,
  filter: { ...d.filter, ...(s.filter || {}) }, eq: { ...d.eq, ...(s.eq || {}) },
  comp: { ...d.comp, ...(s.comp || {}) }, echo: { ...d.echo, ...(s.echo || {}) },
});
const GAMEPAD_SCRATCH_ALT_DEFAULTS = Object.fromEntries(Object.keys(DEFAULT_GAMEPAD_MAPS).map(m => [m, { ...DEFAULT_GAMEPAD_SCRATCH_ALT }]));

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
  // ★軽量化: 再生中に高頻度で変わる表示用の値は useState ではなくストアに置く(liveStore.js 参照)。
  //   setter 名は従来のまま残し、呼び出し側はそのまま使えるようにしている。
  const [live] = useState(() => createLiveStore({
    backBga: null, layerBga: null, poorBga: null, showMiss: false, measure: 0, measureLines: [], quietMonitors: false,
  }));
  const setCurrentMeasureLines = (v) => live.set({ measureLines: v });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTimeDisplay, setPlaybackTimeDisplay] = useState(0); 
  const [duration, setDuration] = useState(0);
  // HI-SPEED と「緑数字を維持」(IIDX のフローティング HI-SPEED)。どれも localStorage 永続。
  const [hiSpeed, setHiSpeed] = useStoredState('bms_hi_speed', 2.0, num(v => v > 0 && v <= 20));
  const [autoHiSpeed, setAutoHiSpeed] = useStoredState('bms_floating_hs', false, BOOL);   // ON = 曲が変わっても緑数字を維持
  const [targetGreen, setTargetGreen] = useStoredState('bms_target_green', 300, num(v => v >= 60 && v <= 1500)); // 維持する緑数字(ms)
  const [volume, setVolume] = useState(0.8);
  const [lastVolume, setLastVolume] = useState(0.8);
  const [hitSoundVolume, setHitSoundVolume] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(null); // 音声デコードの進捗(%)。null = 数値で出せない段階(バーを出さない)
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [customKeyHitSound, setCustomKeyHitSound] = useState(null);
  const [customScratchHitSound, setCustomScratchHitSound] = useState(null);
  const [difficultyInfo, setDifficultyInfo] = useState({ label: '-', color: 'bg-gray-600' });
  const [visibilityMode, setVisibilityMode] = useState(VISIBILITY_MODES.OFF);
  const [suddenPlusVal, setSuddenPlusVal] = useState(250);
  const [hiddenPlusVal, setHiddenPlusVal] = useState(200);
  const [liftVal, setLiftVal] = useState(150);

  const setCurrentBackBga = (v) => live.set({ backBga: v });
  const setCurrentLayerBga = (v) => live.set({ layerBga: v });
  const setCurrentPoorBga = (v) => live.set({ poorBga: v });

  const showMissLayerRef = useRef(false);
  const setShowMissLayer = (v) => { showMissLayerRef.current = v; live.set({ showMiss: v }); };
  // ミスレイヤー(POOR BGA)の有効/無効。オート=Mキー / 自己プレイ=空POOR以外のPOOR・BAD で発動。localStorage 永続。
  const [missLayerEnabled, setMissLayerEnabled] = useStoredState('bms_miss_layer', true, BOOL);
  const missLayerEnabledRef = useLatestRef(missLayerEnabled);
  const setCurrentMeasure = (v) => live.set({ measure: v });
  const [playSide, setPlaySide] = useState('1P');
  const [playOption, setPlayOption] = useState('OFF');    // 1P / 左サイド / 9K 全体
  const [playOption2, setPlayOption2] = useState('OFF');  // 2P / 右サイド (DP のみ)
  const [dpFlip, setDpFlip] = useState(false);            // DP: 左右サイドを入れ替え
  const [currentLaneOrder, setCurrentLaneOrder] = useState([1,2,3,4,5,6,7]); // 左サイド配置(表示用)
  const [laneOrder2, setLaneOrder2] = useState(null);     // 右サイド配置(表示用, DP のみ / S-RANDOM は 'S')
  const [totalNotes, setTotalNotes] = useState(0);
  const [laneMute, setLaneMute] = useState(() => new Array(MAX_LANES).fill(false)); // レーンごとミュート(0=SC, 1-7=鍵盤)
  const laneMuteRef = useLatestRef(laneMute);
  const [showReady, setShowReady] = useState(true);
  const [readyAnimState, setReadyAnimState] = useState(null); 
  const [backingTracks, setBackingTracks] = useState([]);
  const [playKeySounds, setPlayKeySounds] = useState(true);
  const [playBgSounds, setPlayBgSounds] = useState(true);      
  const [playLongAudio, setPlayLongAudio] = useState(true);
  // シーク後に「シーク地点より前に鳴り始めた音(長いBGM等)」を途中から再生するか。
  // OFF = beatoraja 式(鳴らさない)。一時停止→再開はこの設定に関係なく常に続きから再生する。localStorage 永続。
  const [resumeAudioOnSeek, setResumeAudioOnSeek] = useStoredState('bms_resume_audio_on_seek', true, BOOL);
  const resumeAudioOnSeekRef = useLatestRef(resumeAudioOnSeek);
  const seekedSinceStartRef = useRef(false);  // 前回の再生開始以降にシークしたか(再開が「シーク」か「一時停止からの復帰」かの判別用)
  // コントローラ表示の皿の定常回転(OFF = 皿ノーツが無いときは止める)。localStorage 永続。
  const [scratchRotationEnabled, setScratchRotationEnabled] = useStoredState('bms_scratch_rotation', true, BOOL);
  const [isInputDebugMode, setIsInputDebugMode] = useState(false);
  const [playMode, setPlayMode] = useState(false); // 6-2: プレイモード(自分の入力で判定)
  const [playResult, setPlayResult] = useState(null); // 6-2-b: 完走リザルト(モーダル表示用)
  // 判定方式: 'BMS'(beatoraja 準拠・#RANK で拡縮) / 'IIDX'(固定幅)。localStorage 永続。
  const [judgeSystem, setJudgeSystem] = useStoredState('bms_judge_system', 'BMS', oneOf('BMS', 'IIDX'));
  const [judgeOffset, setJudgeOffset] = useStoredState('bms_judge_offset', 0, num()); // 6-2-c: 判定オフセット(ms)
  // キー割り当て(6-1-d): モード別 lane index -> KeyboardEvent.code。localStorage 永続(モード毎に既定値へマージ)。
  const [keyMaps, setKeyMaps] = useStoredState('bms_keymaps', DEFAULT_KEYMAPS, mergedJson(DEFAULT_KEYMAPS, mergePerMode));

  // ゲームパッド入力(Gamepad API): 物理コントローラを直接認識する。Joy2Key等のキーボード変換を経由しないため、
  // スクラッチが押しっぱなしになってもブラウザのショートカットに干渉しない。
  const [gamepadEnabled, setGamepadEnabled] = useStoredState('bms_gamepad_enabled', false, BOOL);
  const [gamepadMaps, setGamepadMaps] = useStoredState('bms_gamepad_maps', DEFAULT_GAMEPAD_MAPS, mergedJson(DEFAULT_GAMEPAD_MAPS, mergePerMode));
  const [gamepadScratchAlt, setGamepadScratchAlt] = useStoredState('bms_gamepad_scratch_alt', GAMEPAD_SCRATCH_ALT_DEFAULTS, mergedJson(GAMEPAD_SCRATCH_ALT_DEFAULTS, mergePerMode));
  const [gamepadName, setGamepadName] = useState(null); // 接続中のコントローラ名(表示用)
  // 軸(皿が軸として来る機種)の感度。機種によって1フレームあたりの変化量が大きく違うため調整可能にする。
  const [gamepadAxisDelta, setGamepadAxisDelta] = useStoredState('bms_gamepad_axis_delta', 0.0015, num(v => v > 0));
  const [gamepadAxisReleaseMs, setGamepadAxisReleaseMs] = useStoredState('bms_gamepad_axis_release_ms', 90, num(v => v >= 20));
  const gamepadAxisDeltaRef = useLatestRef(gamepadAxisDelta);
  const gamepadAxisReleaseMsRef = useLatestRef(gamepadAxisReleaseMs);

  // 6-3: サウンドエフェクト設定(EQ/ECHO/COMP/FILTER)。localStorage 永続(各エフェクト単位で既定値へマージ)。
  const [audioFx, setAudioFx] = useStoredState('bms_audio_fx', DEFAULT_AUDIO_FX, mergedJson(DEFAULT_AUDIO_FX, mergeAudioFx));
  // lite モード(低スペック機向け)。localStorage 永続(PC ごとに別設定にできる)。
  const [liteMode, setLiteMode] = useStoredState('bms_lite_mode', DEFAULT_LITE_MODE, mergedJson(DEFAULT_LITE_MODE));
  // 実際に効いている項目(親スイッチ ON かつ項目 ON)。renderLoop 等から読むため ref にも持つ。
  const lite = {
    lowRes: liteMode.enabled && liteMode.lowRes,
    fpsCap: liteMode.enabled && liteMode.fpsCap,
    noDupVideo: liteMode.enabled && liteMode.noDupVideo,
    simpleEffects: liteMode.enabled && liteMode.simpleEffects,
    quietMonitors: liteMode.enabled && liteMode.quietMonitors,
    fxBypass: liteMode.enabled && liteMode.fxBypass,
  };
  const liteRef = useRef(lite);
  liteRef.current = lite;
  useEffect(() => {
    try { localStorage.setItem('bms_lite_mode', JSON.stringify(liteMode)); } catch { /* privacy mode */ }
    // 描画の静的キャッシュ(板・グラデーション)を作り直させる
    rendererRef.current.invalidate();
    laneVisualRef.current.fill(null); // ボタンの発光スタイルを次フレームで書き直させる
    live.set({ quietMonitors: liteRef.current.quietMonitors }); // 密度グラフ(ストア購読)用
    scheduleRenderLoop();
  }, [liteMode]);
  // 6-3: サウンドエフェクトのパラメータを反映(無効時は素通しになる値)
  useEffect(() => { engine.applyFx(audioFx); }, [audioFx]);

  // lite: エフェクト無効時はエフェクトラック(FILTER/EQ/COMP/ECHO)を経路から外し、マスター → destination 直結にする。
  //   無効時も各ノードは「素通しの値」で常時接続されており、音声スレッドで処理コストが掛かっていたため。
  const fxBypassActive = lite.fxBypass && !audioFx.enabled;
  const fxBypassActiveRef = useRef(fxBypassActive);
  fxBypassActiveRef.current = fxBypassActive;
  useEffect(() => { engine.setFxBypass(fxBypassActive); }, [fxBypassActive]);

  const [muteDebugAutoPlay, setMuteDebugAutoPlay] = useState(true);
  const muteDebugAutoPlayRef = useLatestRef(muteDebugAutoPlay);
  const [showSettings, setShowSettings] = useState(false);
  
  const [showMutedMonitor, setShowMutedMonitor] = useState(true);
  const [showAbortedMonitor, setShowAbortedMonitor] = useState(true); 
  const [playBgaVideo, setPlayBgaVideo] = useState(true);
  const [hasVideo, setHasVideo] = useState(false);

  // PC の BGA 表示位置(要望: 背面 / サイド を個別トグル)。localStorage 永続。
  const [bgaBehindChart, setBgaBehindChart] = useStoredState('bms_bga_behind', false, BOOL);
  const [bgaSidePanel, setBgaSidePanel] = useStoredState('bms_bga_side', false, BOOL);
  const [bgaSidePos, setBgaSidePos] = useStoredState('bms_bga_side_pos', 'left', oneOf('left', 'right'));
  const pcBehindBgaRef = useRef(null);
  const pcSideBgaRef = useRef(null);
  const bgaSidePanelRef = useLatestRef(bgaSidePanel);
  // レーン1本(鍵)の幅(px)。キャンバス幅をこれ×盤面単位数で決めるので、盤面ぴったりになる。
  const [laneWidthPx, setLaneWidthPx] = useStoredState('bms_lane_width', 44, num(v => v >= 20 && v <= 72));

  const imageAssetsRef = useRef(new Map()); 
  const pauseTimeRef = useRef(0);
  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const [renderer] = useState(() => new LaneRenderer()); // 譜面キャンバスの描画(キャッシュ込み)
  const [engine] = useState(() => new AudioEngine());     // 音声(AudioContext・エフェクト・発音予約・時計)
  // プレイモードの判定。判定が1つ確定するたびに、HUD のコンボ/ノーツ数を同期し、BAD/POOR でミスレイヤーを出す。
  const onJudgeRef = useRef(null);
  const [judge] = useState(() => new PlayJudge({ onJudge: (kind, j) => onJudgeRef.current?.(kind, j) }));
  const rendererRef = useRef(renderer);
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
  const lastPlayedSoundPerLaneRef = useRef(new Array(MAX_LANES).fill(null));
  const comboRef = useRef(0);
  const noteCountsRef = useRef(new Array(MAX_LANES).fill(0)); 
  const lastStateUpdateRef = useRef(0);
  const currentMeasureRef = useRef(-1);
  const longAudioProgressRefs = useRef(new Map());
  const missLayerTimerRef = useRef(null); 
  const hudLastRef = useRef({});    // HUDに最後に push した値。変化時のみ setState するための比較用
  const canvasRectRef = useRef(null);   // canvas の CSS サイズ(ResizeObserver でキャッシュ、毎フレーム getBoundingClientRect しない)
  const laneVisualRef = useRef(new Array(MAX_LANES).fill(null)); // 各レーンの見た目 active 状態。変化時のみ DOM 書き込み
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

  const hiSpeedRef = useLatestRef(hiSpeed);
  const isPlayingRef = useRef(isPlaying);
  const playKeySoundsRef = useLatestRef(playKeySounds);
  const playBgSoundsRef = useLatestRef(playBgSounds);
  const playLongAudioRef = useLatestRef(playLongAudio);
  const scratchRotationEnabledRef = useLatestRef(scratchRotationEnabled);
  const volumeRef = useRef(volume);
  const hitSoundVolumeRef = useLatestRef(hitSoundVolume);
  const readyAnimStateRef = useLatestRef(readyAnimState); 
  const isInputDebugModeRef = useRef(isInputDebugMode);
  const playModeRef = useRef(playMode);
  // 6-2 判定用
  const scratchDirRef = useRef({ 0: null, 8: null }); // サイド別・直近の皿入力方向('A'|'B')
  const scratchImpulseRef = useRef({ 0: { dir: 0, t: 0 }, 8: { dir: 0, t: 0 } }); // プレイモードの皿回転インパルス
  const lastGameKeyTimeRef = useRef(0);    // プレイモード: 直近のゲームキー入力時刻(Space誤爆抑制用)
  const notesDoneRef = useRef(0);          // 通過/判定済みノーツ数(NOTES 表示。コンボとは別)
  const showLiveResultRef = useRef(false); // 6-2-b: Tab 押下中の成績オーバーレイ
  const lastRunRef = useRef(null);         // 6-2-b: 直近の走行スナップショット(停止後の Tab 表示用)
  const playSideRef = useLatestRef(playSide);
  const showMutedMonitorRef = useLatestRef(showMutedMonitor);
  const showAbortedMonitorRef = useLatestRef(showAbortedMonitor);
  const visibilityModeRef = useLatestRef(visibilityMode);
  const suddenPlusValRef = useLatestRef(suddenPlusVal);
  const hiddenPlusValRef = useLatestRef(hiddenPlusVal);
  const liftValRef = useLatestRef(liftVal);
  const isMobileRef = useRef(isMobile);
  const lastNotesByLaneRef = useRef(new Array(MAX_LANES).fill(null)); 
  
  const boardOpacityRef = useRef(boardOpacity);
  const laneOpacityRef = useLatestRef(laneOpacity);

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

  const lastRenderTsRef = useRef(0);
  const _renderTick = (ts) => {
      animationRef.current = null;
      // lite: 60fps 制限。120/144Hz の画面では間のフレームを描かずに次の rAF を待つ
      //   (3.5ms の余裕で 60Hz 画面のフレーム揺れでは間引かれないようにしている)
      if (liteRef.current.fpsCap) {
          if (ts - lastRenderTsRef.current < 1000 / 60 - 3.5) { scheduleRenderLoop(); return; }
          lastRenderTsRef.current = ts;
      }
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
    rendererRef.current.attach(el); // canvas 要素の差し替え → 描画キャッシュを作り直す
    canvasRectRef.current = null;
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

  // ★モード切替(7K⇔14K等)直後の一瞬だけレーン幅が旧モード基準になる問題への対策:
  //   ResizeObserver のコールバックは非同期(次フレーム以降)なので、盤面のレーン構成が
  //   変わった直後は canvasRectRef が古い実測幅のままになる一瞬が生じていた。
  //   ここで描画前(useLayoutEffect=paint前)に同期的に再計測し、そのズレを消す。
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) canvasRectRef.current = { width: r.width, height: r.height };
  }, [parsedSong?.mode, playSide, laneWidthPx]);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { volumeRef.current = volume; engine.setVolume(volume); }, [volume]);
  useEffect(() => { boardOpacityRef.current = boardOpacity; }, [boardOpacity]); 
  useEffect(() => {
      isInputDebugModeRef.current = isInputDebugMode;
      if (isInputDebugMode) scheduleRenderLoop();
  }, [isInputDebugMode]);
  useEffect(() => {
      playModeRef.current = playMode;
      if (playMode) { resetJudge(); scheduleRenderLoop(); }
      // ★プレイモードOFF直後、InfoPanel のスコア表示が残る不具合の対策:
      //   非表示化は renderLoop の100ms間引きブロック(scoreHidden)に任せていたが、
      //   OFFにした直後は isPlaying 等も false でrenderLoop自体が止まってしまい、
      //   その間引きが一度も実行されないまま表示が残ることがあった。ここで即座に隠す。
      else { hudLastRef.current.scoreHidden = true; infoPanelRef.current?.updateScore(null); }
  }, [playMode]);
  // 判定幅一式を作り直す(曲のロード時 / 判定方式の変更時)。設定画面の判定幅表示にも使う。
  const judgeCfg = React.useMemo(
    () => buildJudgeConfig(judgeSystem, parsedSong?.mode || 'SP7', parsedSong?.header),
    [judgeSystem, parsedSong]
  );
  judge.setConfig(judgeCfg);
  judge.setOffset(judgeOffset);

  // 入力 → レーンの逆引き表(現在モードの割り当てに追従)。皿は割り当てキー='A' 方向、もう一方のキー='B' 方向。
  const inputMode = parsedSong?.mode || 'SP7';
  const keyLanes = React.useMemo(() => buildLaneMap(keyMaps[inputMode] || keyMaps.SP7, DEFAULT_SCRATCH_ALT), [keyMaps, inputMode]);
  const keyLanesRef = useLatestRef(keyLanes);
  const padLanes = React.useMemo(() => buildLaneMap(gamepadMaps[inputMode], gamepadScratchAlt[inputMode]), [gamepadMaps, gamepadScratchAlt, inputMode]);
  const padLanesRef = useLatestRef(padLanes);
  // ゲームパッド(input/GamepadInput.js)。接続中のコントローラ名は設定画面に表示する。
  const gamepadEnabledRef = useLatestRef(gamepadEnabled);
  const [gamepad] = useState(() => new GamepadInput());
  useGamepadConnection(gamepad, setGamepadName);

  const displayObjectsRef = useLatestRef(displayObjects); // window イベントハンドラから最新の displayObjects を読むため

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
      const glow = !liteRef.current.simpleEffects; // lite: box-shadow の発光(再描画コストが大きい)を省略
      const ctrlEl = controllerRefs.current[idx];
      if (ctrlEl) {
          // 即時反映(transition なし)。密譜面で「光りかけて消える」のを防ぐ。
          if (meta.isScratch) {
             ctrlEl.style.boxShadow = active && glow ? `0 0 20px ${col}` : 'none';
             ctrlEl.style.borderColor = active ? col : '#1e293b';
          } else {
             ctrlEl.style.background = active ? col : '#0b0f1a';
             ctrlEl.style.boxShadow = active && glow ? `0 0 14px ${col}` : 'none';
             ctrlEl.style.borderColor = active ? col : (meta.color + '88');
          }
      }
      const kbEl = keyboardRefs.current[idx];
      if (kbEl && kbEl !== ctrlEl) {
          kbEl.style.background = active ? col : '#0f172a';
          kbEl.style.color = active ? '#0b0f1a' : (meta.isScratch ? '#fca5a5' : '#93a0be');
          kbEl.style.boxShadow = active && glow ? `0 0 8px ${col}` : 'none';
      }
  };
  const clearActiveLanes = () => { for(let i=0; i<MAX_LANES; i++) { if (laneVisualRef.current[i] !== false) { laneVisualRef.current[i] = false; setLaneActive(i, false); } } };

  // ミスレイヤー(POOR BGA)を一時表示する。コンボには触れない。連続ミスでは setState せずタイマーだけ延長。
  const flashMissLayer = () => {
      if (!missLayerEnabledRef.current) return;
      if (missLayerTimerRef.current) clearTimeout(missLayerTimerRef.current);
      if (!showMissLayerRef.current) setShowMissLayer(true);
      missLayerTimerRef.current = setTimeout(() => { setShowMissLayer(false); }, 500);
  };

  // オートプレイ用: M キーで「ミス」をシミュレート(コンボ0 + ミスレイヤー)。
  const triggerMiss = () => {
      if (!missLayerEnabledRef.current) return;
      comboRef.current = 0;
      
      flashMissLayer();
  };

  // ===== 6-2 判定(game/PlayJudge.js) =====
  onJudgeRef.current = (kind, j) => {
      comboRef.current = j.combo;
      notesDoneRef.current = j.notesDone;
      if (kind === 'bd' || kind === 'poor') flashMissLayer(); // 自己プレイ: 空POOR以外の POOR / BAD でミスレイヤー
  };
  const resetJudge = () => {
      judge.reset(); // 直近のずれ(オフセット推奨用)は残す。曲ロード時のみクリア
      scratchDirRef.current = { 0: null, 8: null };
      comboRef.current = 0;
      notesDoneRef.current = 0;
  };
  // 6-2-c: 直近の判定タイミングから推奨オフセットを算出(中央値)。設定画面から呼ぶ。
  const suggestJudgeOffset = () => judge.suggestOffset();
  // 6-2-b: 成績データ(リザルト / Tab オーバーレイ / InfoPanel 共通)
  const buildResultData = (finished) => judge.result(parsedSong, finished);

  // プレイモード: 皿の回転インパルスを与える。scDir 'A'→順(-1) / 'B'→逆(+1)。
  const doScratchSpin = (lane, scDir) => {
      scratchImpulseRef.current[lane] = { dir: scDir === 'B' ? 1 : -1, t: performance.now() };
  };

  // プレイモード: 1回のキー/皿入力を判定(皿は回転演出も)
  const judgeLaneInput = (lane, bmsTime, isScratch, scDir) => {
      const objs = displayObjectsRef.current;
      if (!playModeRef.current || !isPlayingRef.current || !objs.length) return;
      if (isScratch) {
          if (scDir) scratchDirRef.current[lane] = scDir;
          doScratchSpin(lane, scDir);
      }
      if (judge.press(objs, lane, bmsTime, isScratch, scDir)) noteCountsRef.current[lane]++;
  };

  // 6-1-e: レーンオプションをモード別に適用し、表示用の配置(state)も更新する。
  //   opt1 = 1P/左サイド(9K は全体)、opt2 = 2P/右サイド(DP のみ)、flip = 左右サイド入れ替え(DP のみ)。
  const applyOptions = (objects, opt1, opt2 = 'OFF', flip = false) => {
    const r = applyLaneOptions(objects, parsedSong, opt1, opt2, flip);
    setCurrentLaneOrder(r.order1);
    setLaneOrder2(r.order2);
    return r.objects;
  };

  const toggleMute = () => {
      if (volume > 0) { setLastVolume(volume); setVolume(0); } else { setVolume(lastVolume || 0.8); }
  };

  const resetGameStatus = () => {
    stopPlayback(true);
    engine.stopAll(); activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]); releaseImageAssets();
    lastBgaKeyRef.current = {};
    setParsedSong(null); setDisplayObjects([]); setCurrentBackBga(null); setCurrentLayerBga(null); setCurrentPoorBga(null);
    setShowMissLayer(false); setCurrentMeasureLines([]); 
    scratchAngleRef.current = 0; lastFrameTimeRef.current = 0; lastScratchTimeRef.current = 0; lastScratchTypeRef.current = 'REVERSE'; scratchDirectionRef.current = -1;
    activeInputLanesRef.current.clear(); isShiftHeldRef.current = false; isCtrlHeldRef.current = false; setHasVideo(false); setPlayBgaVideo(true);
    engine.resetStats();
  };

  const resetAllState = () => { resetGameStatus(); engine.buffers.clear(); setBmsList([]); };

  // オートプレイ用: M キーで「ミス」をシミュレート。デバッグ入力/プレイモードの有無に関わらず常時受け付ける。
  //   (メインのキー入力リスナーは isInputDebugMode || playMode のときしか張られないため、専用に用意する)
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.code !== 'KeyM') return;
      if (playModeRef.current) return;                            // プレイモードは自前の判定でミスを出す
      if (keyLanesRef.current.lane['KeyM'] !== undefined) return; // M が判定レーンに割り当て済みなら無効
      triggerMiss();                                              // 中で missLayerEnabled を判定
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // レーン入力が来た時の共通処理(キーボード/ゲームパッド共通)。isScr=皿かどうか、scDir='A'|'B'|undefined。
  const handleLaneDown = (lane, isScr, scDir) => {
      if (playModeRef.current) lastGameKeyTimeRef.current = performance.now();
      activeInputLanesRef.current.add(lane);
      setLaneActive(lane, true);

      if ((isInputDebugModeRef.current || playModeRef.current) && parsedSong && engine.ctx) {
          const bmsTime = isPlayingRef.current
              ? (engine.songTime()) // 描画と同じ補間済みの時計で判定する
              : pauseTimeRef.current;

          if (playModeRef.current) judgeLaneInput(lane, bmsTime, isScr, scDir);

          // ■ 設定に基づいた判定幅 (beatoraja BAD判定基準)
          // Early(早入り/未来): -0.28s まで (280ms)
          // Late (遅入り/過去): +0.22s まで (220ms)
          const EARLY_LIMIT = 0.28;
          const LATE_LIMIT = 0.22;

          // 1. 近くのノーツを探す (範囲を少し広めに取って検索)
          // ★常に最新の譜面データを持つ ref を使う(state を直接参照すると、曲を読み込み直した際に
          //   古い譜面データを参照し続けてキー音がほとんど鳴らなくなる不具合の原因になっていた)。
          const objs = displayObjectsRef.current;
          const centerIndex = findStartIndex(objs, bmsTime - LATE_LIMIT);
          const searchStart = Math.max(0, centerIndex - 10);
          let targetObj = null;
          let minAbsDiff = 9999; // 最も近いものを選ぶための記録用

          // ★キー音が鳴らない対策: 以前は「前後50オブジェクト」で打ち切っていたため、BGM オブジェクトが密集する
          //   区間では判定範囲(+0.28s)まで届かず、押してもキー音が見つからないことがあった。時間で打ち切る。
          for (let i = searchStart; i < objs.length; i++) {
              const obj = objs[i];
              if (obj.time - bmsTime > EARLY_LIMIT) break;
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
                  // 同時発音数の上限(MAX_SHORT_POLYPHONY)の対象にするため、オート再生と同じノード管理で鳴らす
                  const buffer = engine.buffers.get(wavName.toLowerCase());
                  if (buffer) engine.playNow(buffer);
              }
          }
      }
      scheduleRenderLoop();
  };
  // scDir: 皿の場合、離したキー/ボタンの方向('A'|'B')。LN の始点を取った方向以外を離しても LN は離さない扱い。
  const handleLaneUp = (lane, scDir) => {
      activeInputLanesRef.current.delete(lane);
      setLaneActive(lane, false);
      // プレイモード: LN を保持中に離した → 始点と離しタイミングの悪い方で確定(game/PlayJudge.js の「LN 判定」参照)
      // 一時停止中に離しても判定しない(再開後も保持中のまま)
      if (playModeRef.current && isPlayingRef.current) judge.release(lane, engine.songTime(), !!laneMetaRef.current[lane]?.isScratch, scDir);
  };
  // handleKeyDown/handleKeyUp は限られた依存配列の useEffect 内に留まるため、
  // 常に最新の handleLaneDown/handleLaneUp を呼べるよう ref 経由にする(renderLoopRef と同じパターン)。
  const handleLaneDownRef = useRef(handleLaneDown); handleLaneDownRef.current = handleLaneDown;
  const handleLaneUpRef = useRef(handleLaneUp); handleLaneUpRef.current = handleLaneUp;


  useEffect(() => {
    engine.init(volume, fxBypassActiveRef.current);
    engine.applyFx(audioFx);
    const defaultHitSound = engine.createHitSound();
    keyHitSoundBufferRef.current = defaultHitSound;
    scratchHitSoundBufferRef.current = defaultHitSound;

    const resumeAudio = () => engine.resumeIfSuspended();
    window.addEventListener('click', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      engine.close();
      stopRenderLoop();
      releaseImageAssets();
    };
  }, []);

  const processFiles = (fileList) => {
    const validFiles = fileList.filter(f => /\.(bms|bme|bml|pms|wav|ogg|mp3|bmp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(f.name));
    // ★ZIP 読み込みでは呼び出し前に isLoading を立てている。譜面の読み込みに進まない経路では
    //   ここで必ず下ろす(以前は BMS の無い ZIP を開くと「読み込み中」のまま操作できなくなっていた)。
    if (validFiles.length === 0) { setIsLoading(false); alert("BMS関連ファイルが見つかりませんでした。"); return; }
    resetAllState();
    setFiles(validFiles);
    const bmsFiles = validFiles.filter(f => /\.(bms|bme|bml|pms)$/i.test(f.name)).map((f, i) => ({ file: f, index: i, name: f.name }));
    setBmsList(bmsFiles);
    if (bmsFiles.length > 0) setSelectedBmsIndex(0);
    else { setIsLoading(false); alert("譜面ファイル(.bms / .bme / .bml / .pms)が見つかりませんでした。"); }
  };

  const handleFileSelect = (e) => processFiles(Array.from(e.target.files));
  
  const handleZipSelect = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsLoading(true); setLoadingProgress(null); setLoadingMessage('ZIPファイルを解凍中...');
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
    if (!file || !engine.ctx) return null;
    try {
        const buf = await file.arrayBuffer();
        const audioBuf = await engine.decode(buf);
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
    if (engine.ctx) {
        const defaultSound = engine.createHitSound();
        setTempKeyHitSoundBuffer(null); setTempKeySoundName(null);
        keyHitSoundBufferRef.current = defaultSound; setCustomKeyHitSound(null);
        if (!isSeparateHitSound) {
            scratchHitSoundBufferRef.current = defaultSound; setCustomScratchHitSound(null);
        }
    }
  };

  const handleScratchHitSoundReset = () => {
    if (engine.ctx) {
        setTempScratchHitSoundBuffer(null); setTempScratchSoundName(null);
        scratchHitSoundBufferRef.current = engine.createHitSound();
        setCustomScratchHitSound(null);
    }
  };

  const refreshRandom = () => { if (!parsedSong) return; stopPlayback(true); setDisplayObjects(applyOptions(parsedSong.objects, playOption, playOption2, dpFlip)); };
  useEffect(() => { if (parsedSong) setDisplayObjects(applyOptions(parsedSong.objects, playOption, playOption2, dpFlip)); }, [parsedSong, playOption, playOption2, dpFlip]);

  // 緑数字を維持(IIDX のフローティング HI-SPEED): 曲ごとの主BPM(最も長く続く BPM)で、緑数字が目標値になるよう
  //   HI-SPEED を自動設定する。曲のロード時 / 目標値 / レーンカバー(白数字)の変更時に再計算。
  //   HI-SPEED を手で変えたときは、その速さの緑数字を新しい目標にする(sHiSpeedChange)。曲中の BPM 変化には追従しない。
  useEffect(() => {
    if (!autoHiSpeed || !parsedSong) return;
    const white = whiteNumber(visibilityMode, suddenPlusVal, liftVal);
    setHiSpeed(hiSpeedForGreen(songBaseBpm(parsedSong), targetGreen, white));
  }, [autoHiSpeed, targetGreen, parsedSong, visibilityMode, suddenPlusVal, liftVal]);
  
  useEffect(() => { if (selectedBmsIndex >= 0 && bmsList[selectedBmsIndex]) loadBmsAndAudio(bmsList[selectedBmsIndex].file); }, [selectedBmsIndex, bmsList]);

  const loadSeqRef = useRef(0); // 譜面読み込みの世代番号(古い読み込みの結果を捨てるため)
  const loadBmsAndAudio = async (bmsFile) => {
    if (isPlayingRef.current) stopPlayback(true);
    lastBgaKeyRef.current = {};
    setParsedSong(null); setDisplayObjects([]); setCurrentBackBga(null); setCurrentLayerBga(null); setCurrentPoorBga(null); setShowMissLayer(false);
    setCurrentMeasureLines([]); 
    scratchAngleRef.current = 0; lastScratchTimeRef.current = 0; lastScratchTypeRef.current = 'REVERSE'; scratchDirectionRef.current = -1; activeInputLanesRef.current.clear(); isShiftHeldRef.current = false; isCtrlHeldRef.current = false;
    engine.stopAll(); activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]);
    // ★P4: デコード済み WAV / 画像はフォルダ内で使い回す(キャッシュのクリアは processFiles = 新フォルダ時のみ)

    setIsLoading(true); setLoadingProgress(null); setLoadingMessage('BMSファイルを解析中...');

    // ★読み込みの世代番号。譜面を素早く切り替えると、先に始めた読み込みが後から完了して
    //   新しい譜面を古い譜面で上書きすることがあった。await のたびに「自分が最新か」を確認し、古ければ中断する。
    const loadId = ++loadSeqRef.current;
    const isStale = () => loadId !== loadSeqRef.current;

    try {
      const parsed = await parseBMS(bmsFile);
      if (isStale()) return;
      setTimeout(() => {
          if (isStale()) return;
          if (parsed.unmappedPmsChannels && parsed.unmappedPmsChannels.length)
              alert(`警告：この pms は未対応のチャンネル（${parsed.unmappedPmsChannels.join(', ')}）を使用しています。一部のノーツが表示・再生されません。`);
      }, 100);
      const diffInfo = guessDifficulty(parsed.header, bmsFile.name);
      setDifficultyInfo(diffInfo); realtimeBpmRef.current = parsed.header.bpm;

      // 素材の読み込み(logic/songLoader.js): フォルダ内のファイルと対応付け → 画像を用意 → 音声をデコード
      const assets = collectSongAssets(parsed);
      const fileMap = buildFileMap(files, bmsFile);
      const { stageAsset, hasVideo } = prepareImageAssets(parsed, fileMap, assets.images, imageAssetsRef.current);
      setHasVideo(hasVideo);
      if (stageAsset) setCurrentBackBga(stageAsset);

      const completed = await decodeSongAudio(fileMap, assets.audio, engine.buffers, (buf) => engine.decode(buf), {
        onStart: (count) => { setLoadingProgress(0); setLoadingMessage(`音声ファイルを読み込み中... (新規 ${count}個)`); },
        onProgress: setLoadingProgress,
        isStale, // 新しい譜面の読み込みが始まったら打ち切る(デコード済みの音はキャッシュに残るので無駄にはならない)
      });
      if (!completed) return;

      const timing = computeSongTiming(parsed, engine.buffers);
      engine.maxSoundDuration = timing.maxSoundDuration;
      lastNotesByLaneRef.current = timing.lastNotesByLane;
      setDuration(timing.duration); setParsedSong(parsed); setTotalNotes(parsed.totalNotes);
      setPlaybackTimeDisplay(0); pauseTimeRef.current = 0; comboRef.current = 0; hudLastRef.current = {};
      resetJudge(); judge.clearRecent(); // 曲ロード時はオフセット推奨用データもクリア
      lastPlayedSoundPerLaneRef.current.fill(null); noteCountsRef.current.fill(0); 
      setCurrentMeasureLines([]); 
      lastStateUpdateRef.current = 0; engine.stats.dropped = 0; // 次の renderLoop フレームで HUD を即更新させる
      setLoadingMessage('準備完了'); setIsLoading(false);
    } catch (e) { console.error(e); if (!isStale()) setIsLoading(false); }
  };


  // 発音予約(audio/AudioEngine.js の先読みスケジューラ)。どの音を鳴らすか・モニター表示はここで決める。
  const scheduleAudio = () => {
      if (!parsedSong || !isPlayingRef.current || !engine.ctx) return;
      const wavs = parsedSong.header.wavs;
      engine.schedule(displayObjects,
        // WAV 定義が無ければ undefined、定義はあるが未読込なら null
        (obj) => { const name = wavs[obj.value]; return name ? (engine.buffers.get(name.toLowerCase()) || null) : undefined; },
        {
          // ★P2: 音源を「キー音 / BGM(著しく長い) / バックサウンド」の排他3カテゴリに分類し、別々のトグルで制御
          classify: (obj, buffer) => {
            if (obj.isNote) {
              const play = playKeySoundsRef.current
                && !laneMuteRef.current[obj.laneIndex]                                   // ★P5-2 レーンミュート
                && !(isInputDebugModeRef.current && muteDebugAutoPlayRef.current)
                && !playModeRef.current;                                                  // 6-2 プレイモード: キー音はプレイヤー入力で鳴らす
              return { play, isBgm: false };
            }
            if (buffer.duration >= BGM_MIN_DURATION) return { play: playLongAudioRef.current, isBgm: true }; // 「BGMを再生」
            return { play: playBgSoundsRef.current, isBgm: false };                                            // 「バックサウンドを再生」
          },
          // モニター表示: BGM は BACKING TRACK、それ以外は SOUND MONITOR(直近100件だけ保持)
          onItem: (item, { play, isBgm }) => {
            if (!play && !showMutedMonitorRef.current) return;
            if (isBgm) { activeLongSoundsRef.current.push(item); setBackingTracks(prev => [...prev, item]); }
            else {
              activeShortSoundsRef.current.push(item);
              if (activeShortSoundsRef.current.length > 100) activeShortSoundsRef.current.shift();
            }
          },
          // 打鍵音(★P5-2 ミュート / 6-2 プレイモードでは鳴らさない)
          hitSound: (obj) => {
            if (laneMuteRef.current[obj.laneIndex] || playModeRef.current) return null;
            const isScratch = laneMetaRef.current[obj.laneIndex]?.isScratch;
            return { buffer: isScratch ? scratchHitSoundBufferRef.current : keyHitSoundBufferRef.current, gain: 0.6 * hitSoundVolumeRef.current };
          },
        });
  };
  // setInterval が常に最新の scheduleAudio クロージャを呼ぶようにする(displayObjects/parsedSong の stale 化を防ぐ)
  scheduleAudioRef.current = scheduleAudio;

  useEffect(() => { rendererRef.current.prepareReadyText(); }, []); // READY/GO を事前生成(初回描画時のヒッチ回避)

  // 指定時刻(offset 秒)へ「位置」を同期する。startPlayback とシークの軽い処理から共用。
  //  - 曲の時刻と AudioContext 時刻の対応(再生中のみ) / スケジューラ開始位置
  //  - BGA の各インデックスと、その時点で表示すべき BGA フレーム(変化時のみ setState)
  const applySeekPosition = (offset) => {
    if (isPlayingRef.current) engine.alignSongTime(offset);
    if (!parsedSong) return;
    // 開始地点より前に鳴り始め、まだ鳴っているはずの音(途中再生の対象)まで遡れるよう、最長の音源の長さ分も戻る
    const lookBack = Math.max(parsedSong.maxLNDuration || 20.0, engine.maxSoundDuration);
    engine.nextIndex = findStartIndex(displayObjects, offset - lookBack);

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
    engine.resumeIfSuspended();
    
    engine.stopAll(); activeShortSoundsRef.current = []; activeLongSoundsRef.current = []; setBackingTracks([]);
    const offset = pauseTimeRef.current;
    if (offset === 0) resetJudge(); // 頭からのプレイは判定リセット(途中再開はスコア維持)
    // 途中からの開始: 一時停止→再開なら常に、シーク後なら設定に従って、開始地点より前に鳴り始めた音を途中から鳴らす
    const fromSeek = seekedSinceStartRef.current;
    seekedSinceStartRef.current = false;
    engine.midStartPending = offset > 0 && (!fromSeek || resumeAudioOnSeekRef.current);
    engine.resetClock(); // 一時停止中は音声時計が止まる(suspend)ことがあるため補間をやり直す
    setIsPlaying(true); isPlayingRef.current = true; lastFrameTimeRef.current = performance.now();
    applySeekPosition(offset); // 曲の時刻 / スケジューラ開始位置 / BGA インデックス・フレームを同期

    if (showReady && offset === 0) {
        setReadyAnimState('READY');
        setTimeout(() => setReadyAnimState('GO'), 1000); setTimeout(() => setReadyAnimState(null), 1800);
    } else {
        setReadyAnimState(null);
    }
    engine.startScheduler(() => { if (scheduleAudioRef.current) scheduleAudioRef.current(); });
    stopRenderLoop();
    scheduleRenderLoop();
  };

  const pausePlayback = () => {
    setIsPlaying(false); isPlayingRef.current = false; engine.stopAll();
    pauseTimeRef.current = engine.songTime(); // 描画と同じ時計(一時停止時に表示が巻き戻らない)
    setReadyAnimState(null);
    stopRenderLoop();
    if (isInputDebugModeRef.current || playModeRef.current) scheduleRenderLoop();
  };

  const stopPlayback = (reset = true) => {
    const wasPlaying = isPlayingRef.current;
    setIsPlaying(false); isPlayingRef.current = false;
    engine.stopAll();
    // 6-2-b: プレイモードで判定が発生していれば、停止後の Tab 表示用にスナップショット
    if (reset && playModeRef.current && notesDoneRef.current > 0) lastRunRef.current = buildResultData(false);
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

        pauseTimeRef.current = 0; seekedSinceStartRef.current = false; engine.stats.dropped = 0; setPlaybackTimeDisplay(0); comboRef.current = 0; hudLastRef.current = {}; lastBgaKeyRef.current = {};
        resetJudge();
        lastPlayedSoundPerLaneRef.current.fill(null); noteCountsRef.current.fill(0); 
        if (parsedSong) displayObjects.forEach(o => o.processed = false);
        setCurrentMeasureLines([]); 
        currentMeasureRef.current = -1; lastStateUpdateRef.current = 0; realtimeBpmRef.current = parsedSong?.header.bpm || 130; setReadyAnimState(null);
        setCurrentLayerBga(null); setCurrentPoorBga(null); setShowMissLayer(false); 
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
    seekedSinceStartRef.current = true;
    // ★シーク時は在再生中の音源(ロングBGMを含む)を必ず停止する。isPlaying に依存せず毎回止めて音の重なりを防ぐ。
    engine.stopAll();

    // --- 軽い処理: 毎 onChange 実行(描画が毎フレーム参照するため) ---
    // オートプレイのコンボ = ここまでに通過したノーツ総数。0クリアせず再計算する。
    const targetObjects = displayObjects;
    noteCountsRef.current.fill(0);
    let passedNotes = 0;
    for (const obj of targetObjects) {
        obj.processed = obj.time < val;
        if (obj.isNote && obj.processed) {
            passedNotes++;
            // ★DP の 2P 側(レーン 8〜15)も数える(以前は 0〜7 だけで、シーク後に 2P 側の表示が 0 になっていた)
            if (obj.laneIndex >= 0 && obj.laneIndex < MAX_LANES) noteCountsRef.current[obj.laneIndex]++;
        }
    }
    comboRef.current = passedNotes;
    notesDoneRef.current = passedNotes;
    if (playModeRef.current) { resetJudge(); comboRef.current = 0; notesDoneRef.current = 0; } // シーク = その地点から仕切り直し
    hudLastRef.current = {}; lastStateUpdateRef.current = 0; // スクラブ中も HUD(imperative)を追従させる
    clearActiveLanes();
    // 位置の同期(曲の時刻 / スケジューラ開始位置 / BGA インデックス・フレーム)は必ず同期実行する。
    // 遅延させると描画の再生位置と processed フラグがズレ、ノーツが消えたり BGA が空回りする。
    applySeekPosition(val);
    scheduleRenderLoop(); // 停止中でもスクラブ位置を描き直す

    // --- 重い処理(setState群・スケジューラ再開): ドラッグが止まってから1回だけ ---
    if (seekCommitTimerRef.current) clearTimeout(seekCommitTimerRef.current);
    seekCommitTimerRef.current = setTimeout(commitSeek, 100);
  };

  // 1フレームぶんのノーツ判定処理。オートプレイ: 判定ラインを通過したノーツを処理済みにしてコンボ加算。
  //   プレイモード: 見逃し(BAD 窓の遅れ側を未処理で通過)→ POOR、LN を終点まで押し続けたら確定。
  // ★オートプレイ判定はフレームレート非依存: フレーム落ちしても通過済み(time <= 現在)のノーツはまとめて処理する。
  const updateNotesForFrame = (currentTime, now) => {
    const objs = displayObjects;
    const play = playModeRef.current;
    for (let i = findStartIndex(objs, currentTime - (parsedSong.maxLNDuration || 10.0)); i < objs.length; i++) {
        const obj = objs[i];
        if (obj.time > currentTime) break;
        if (!obj.isNote) continue;
        const timeDelta = obj.time - currentTime;
        const isScr = !!laneMetaRef.current[obj.laneIndex]?.isScratch;
        if (play) {
            // 見逃し POOR / LN を終点まで押し続けたら確定(game/PlayJudge.js)
            if (isPlayingRef.current) judge.tickNote(obj, currentTime, isScr);
        } else if (!obj.processed) {
            obj.processed = true;
            comboRef.current++; notesDoneRef.current++; noteCountsRef.current[obj.laneIndex]++; lastPlayedSoundPerLaneRef.current[obj.laneIndex] = obj.filename;
            if (isScr) {
                // 皿の演出: 次の皿ノーツが近ければ往復(ACCEL)、遠ければ逆回し(REVERSE)
                const scIdx = obj.laneIndex;
                let dist = 999;
                for (let k = i + 1; k < objs.length; k++) {
                    const nextObj = objs[k];
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
    }
  };

  const renderLoop = () => {
    if (!canvasRef.current) return;
    const now = performance.now(); const dt = (now - lastFrameTimeRef.current) / 1000; lastFrameTimeRef.current = now;

    // ゲームパッドのポーリング(毎フレーム)。キーボードと同じく isInputDebugMode/playMode のときだけ有効。
    if (gamepadEnabledRef.current && (isInputDebugModeRef.current || playModeRef.current)) {
        gamepad.poll(now, padLanesRef.current, gamepadAxisDeltaRef.current, gamepadAxisReleaseMsRef.current,
            (lane, isScr, dir) => handleLaneDownRef.current(lane, isScr, dir), (lane, dir) => handleLaneUpRef.current(lane, dir));
    }
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    renderer.attach(canvas);
    // lite: 描画解像度を等倍に(150%表示なら描画ピクセル数が約半分になる。代わりに少しぼやける)
    const dpr = liteRef.current.lowRes ? 1 : (window.devicePixelRatio || 1);
    // ★軽量化: getBoundingClientRect() はレイアウト強制。ResizeObserver のキャッシュを使い、
    //   未取得の初回のみ実測する。
    const rect = canvasRectRef.current || (() => {
      const r = canvas.getBoundingClientRect();
      const v = { width: r.width, height: r.height };
      if (v.width > 0 && v.height > 0) canvasRectRef.current = v; // 0 サイズはキャッシュせず次フレーム再測定
      return v;
    })();
    const rawTime = isPlayingRef.current && engine.ctx ? engine.songTime() : pauseTimeRef.current;
    // ★曲の長さで頭打ちにする。以前は終端を過ぎても時刻が進み続け、時間表示が「183.00 / 182.12」のように
    //   曲長を超えたり、動画BGAが終端を越えた位置へ同期されて表示が乱れる原因になっていた。
    const currentTime = duration > 0 ? Math.min(rawTime, duration) : rawTime;

    const bgaTime = currentTime + 0.05;

    if (parsedSong) {
        // ★BGA の進行: 以前は1フレームにつき1オブジェクトしか進めなかったため、フレームレートより細かい
        //   コマ送りBGAや同時刻の複数切り替えがあると、どんどん表示が遅れていった。
        //   時刻に達したオブジェクトをすべて消化し、そのうち「最後に有効だったもの」だけを setState する。
        //   clearOnZero: 値 00 で消灯するか(レイヤーBGAのみ)。アセットが無いオブジェクトは表示を変えない(従来どおり)。
        const advanceBga = (arr, idxRef, setter, clearOnZero) => {
            if (!arr) return;
            let idx = idxRef.current;
            let next;                 // undefined = 変化なし / null = 消灯 / それ以外 = 表示するアセット
            while (idx < arr.length && arr[idx].time <= bgaTime) {
                const bgaObj = arr[idx++];
                if (clearOnZero && bgaObj.value === 0) { next = null; continue; }
                const filename = parsedSong.header.bmps[bgaObj.value];
                const asset = filename && imageAssetsRef.current.get(filename.toLowerCase());
                if (asset) next = asset.type === 'video' ? { ...asset, startTime: bgaObj.time } : asset;
            }
            idxRef.current = idx;
            if (next !== undefined) setter(next);
        };
        advanceBga(parsedSong.backBgaObjects, nextBackBgaIndexRef, setCurrentBackBga, false);
        advanceBga(parsedSong.layerBgaObjects, nextLayerBgaIndexRef, setCurrentLayerBga, true);
        advanceBga(parsedSong.poorBgaObjects, nextPoorBgaIndexRef, setCurrentPoorBga, false);


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
            infoPanelRef.current.updateInfo(currentTime, comboRef.current, notesDoneRef.current);
        }
        // モバイルは InfoPanel が無いので BGA の syncTime をここで直接呼ぶ(動画BGAの位置合わせ)
        if (isMobileRef.current) {
            mobileBackBgaRef.current?.syncTime(currentTime);
            mobileLayerBgaRef.current?.syncTime(currentTime);
            mobilePoorBgaRef.current?.syncTime(currentTime);
        }
        // PC の 背面 / サイド BGA(表示中のみ ref が入る)
        pcBehindBgaRef.current?.syncTime(currentTime);
        if (bgaSidePanelRef.current) pcSideBgaRef.current?.syncTime(currentTime); // 非表示中は同期しない(動画は一時停止中)

        // 3. その他の重い処理（小節線の計算やログ表示用のリスト更新など）
        // これらは毎フレームやる必要がないので、ここだけ間引いて軽量化します
        if (now - lastStateUpdateRef.current > 100) { // 100ms(秒間10回)程度に設定
            const H = hudLastRef.current;
            // 6-2-b: プレイモードのスコア(EX/DJ LEVEL/内訳)→ InfoPanel(imperative)
            if (playModeRef.current) infoPanelRef.current?.updateScore(buildResultData(false));
            else if (!H.scoreHidden) { H.scoreHidden = true; infoPanelRef.current?.updateScore(null); }
            // ★軽量化(Part2): 高頻度で変わる HUD 値は setState せず、memo 化した子へ imperative 更新する。
            //   これで定BPM再生中の BmsViewer 本体の再レンダリングは「小節が変わったとき(〜0.5Hz)」だけになる。

            // POLY / M POLY / AVG POLY → LogPanel(imperative)
            const st = engine.stats;
            const avgPoly = engine.averagePoly();
            if (st.poly !== H.poly || st.maxPoly !== H.maxPoly || avgPoly !== H.avgPoly || st.dropped !== H.dropped) {
                H.poly = st.poly; H.maxPoly = st.maxPoly; H.avgPoly = avgPoly; H.dropped = st.dropped;
                logPanelRef.current?.updatePoly(H.poly, H.maxPoly, H.avgPoly, H.dropped);
            }
            // レーン別ノーツ数 → ControllerPanel(imperative)。comboRef を dirty シグナルに。
            if (comboRef.current !== H.combo || notesDoneRef.current !== H.notes) {
                H.combo = comboRef.current; H.notes = notesDoneRef.current;
                controllerPanelRef.current?.updateCounts(noteCountsRef.current);
            }
            if (parsedSong) {
                const currentBar = parsedSong.barLines.find(b => b.time > currentTime);
                const newMeasure = currentBar ? currentBar.measure - 1 : parsedSong.barLines.length - 1;
                const mStart = parsedSong.barLines[newMeasure]?.time || 0;
                const mEnd = parsedSong.barLines[newMeasure + 1]?.time || 99999;
                // ★軽量化: 全オブジェクトを filter(配列生成)せず、二分探索で小節の範囲だけ数える
                let processedInMeasure = 0;
                for (let i = findStartIndex(displayObjects, mStart); i < displayObjects.length; i++) {
                    const o = displayObjects[i];
                    if (o.time >= mEnd) break;
                    if (o.isNote && o.processed) processedInMeasure++;
                }
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

                // MEASURE / BPM / 次BPM / WHT・GRN → InfoPanel(imperative)。HI-SPEED やレーンカバーが変わったときも更新する
                const white = whiteNumber(visibilityModeRef.current, suddenPlusValRef.current, liftValRef.current);
                const green = Math.round(greenNumber(currentBpmVal, hiSpeedRef.current, white));
                if (processedInMeasure !== H.measProc || totalInMeasure !== H.measTotal || currentBpmVal !== H.bpm || nextBpmKey !== H.nextBpmKey
                    || green !== H.green || white !== H.white) {
                    H.measProc = processedInMeasure; H.measTotal = totalInMeasure; H.bpm = currentBpmVal; H.nextBpmKey = nextBpmKey;
                    H.green = green; H.white = white;
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

        // ★曲長ちょうどで終了する。duration は「全オブジェクトの発音終了時刻」の最大値なので、
        //   この時点で譜面由来の音はすべて鳴り終わっている。以前は +0.5 秒の余白に加え、
        //   発音中のノードが無くなる(onended 待ち)まで待っていたため、表示上の曲長より 1 秒近く延びていた。
        const isFinished = duration > 0 && rawTime >= duration;
        if (isFinished && isPlayingRef.current) {
            if (playModeRef.current) setPlayResult(buildResultData(true)); // 完走リザルト(stopPlayback の resetJudge 前に確定)
            stopPlayback(true);
            return;
        }
    }

    // ノーツの判定処理(オートプレイの通過 / プレイモードの見逃し・LN 終点)。描画の前に行う。
    if (parsedSong) updateNotesForFrame(currentTime, now);

    // 譜面の描画(render/LaneRenderer.js)
    const width = rect.width;
    const height = rect.height;
    const mode = parsedSong?.mode || 'SP7';
    const isPmsMode = mode === 'PMS9';
    const lj = judge.last;
    const judgeAge = now - lj.t;
    const activeLanes = renderer.draw({
        width, height, dpr, song: parsedSong, objects: displayObjects, currentTime, now,
        hiSpeed: hiSpeedRef.current, visMode: visibilityModeRef.current,
        suddenPlus: suddenPlusValRef.current, hiddenPlus: hiddenPlusValRef.current, lift: liftValRef.current,
        boardOpacity: boardOpacityRef.current, laneOpacity: laneOpacityRef.current,
        isMobile: isMobileRef.current, is2P: playSideRef.current === '2P',
        simpleFx: liteRef.current.simpleEffects, laneMute: laneMuteRef.current,
        judge: playModeRef.current && lj.kind && judgeAge < 500 ? { kind: lj.kind, deltaMs: lj.deltaMs, age: judgeAge } : null,
        ready: showReady ? readyAnimStateRef.current : null,
        liveResult: showLiveResultRef.current && playModeRef.current
            ? ((isPlayingRef.current || pauseTimeRef.current > 0) ? buildResultData(false) : lastRunRef.current)
            : null,
    });

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

    // プレイモード: 直近のスクラッチ入力方向へ一気に回して減衰(オート判定と同じ見た目に)
    const playScratchDelta = (lane) => {
        const imp = scratchImpulseRef.current[lane];
        const since = now - imp.t;
        if (imp.dir && since < 260) return imp.dir * baseSpeed * 3.4 * (1 - since / 260) * safeDt;
        return baseSpeed * 1.0 * safeDt; // アイドルはゆっくり順回転
    };

    // 9K(pop'n) は皿がないので回転処理をスキップ(controllerRefs[0] はボタン0)
    if (!isPmsMode) {
        const sideFactor = ((mode === 'SP7' || mode === 'SP5') && playSideRef.current === '2P') ? -1 : 1;
        if (playModeRef.current) {
            scratchAngleRef.current += playScratchDelta(0);
            scratchAngle2Ref.current += playScratchDelta(8);
        } else {
            scratchAngleRef.current += baseSpeed * scratchSpeed(activeLanes[0], lastScratchTimeRef.current, lastScratchTypeRef, scratchDirectionRef) * sideFactor * safeDt;
            scratchAngle2Ref.current += baseSpeed * scratchSpeed(activeLanes[8], lastScratchTime2Ref.current, lastScratchType2Ref, scratchDirection2Ref) * -1 * safeDt;
        }
        const scratchCtrl = controllerRefs.current[0];
        if (scratchCtrl) scratchCtrl.style.transform = `rotate(${scratchAngleRef.current}deg)`;
        const scratchCtrl2 = controllerRefs.current[8]; // DP 2P 皿
        if (scratchCtrl2) scratchCtrl2.style.transform = `rotate(${scratchAngle2Ref.current}deg)`;
    }

    // ★軽量化: 毎フレーム8レーン分の style 一括書き込みをやめ、状態が変化したレーンだけ書き込む。
    for (let lane = 0; lane < MAX_LANES; lane++) {
        const active = activeLanes[lane] || activeInputLanesRef.current.has(lane);
        if (laneVisualRef.current[lane] !== active) {
            laneVisualRef.current[lane] = active;
            setLaneActive(lane, active);
        }
    }
    // 描画継続の判定。多重生成しないよう再スケジュールは scheduleRenderLoop() 経由に統一。
    if (isPlayingRef.current || showReady || isInputDebugModeRef.current || playModeRef.current) {
        scheduleRenderLoop();
    }
  };
  // rAF ループが常に最新の renderLoop クロージャを呼ぶようにする(古い state を掴み続けるのを軽減)
  renderLoopRef.current = renderLoop;

  // ===== キーボード入力(input/useLaneKeyboard.js)。デバッグ用キー入力 / プレイモードのときだけ有効 =====
  // ★常に最新のハンドラを呼ぶ(以前はリスナーを張った時点の startPlayback 等を掴んだままだったため、
  //   プレイモードを ON にしてから譜面を読み込むと Space で再生が始まらなかった)。
  const inputActive = isInputDebugMode || playMode;
  useEffect(() => { if (!inputActive) { activeInputLanesRef.current.clear(); clearActiveLanes(); } }, [inputActive]);
  useLaneKeyboard(inputActive, {
    keys: keyLanes, playMode,
    onLaneDown: handleLaneDown, onLaneUp: handleLaneUp,
    // プレイモード中の Space / Enter: 直近2秒以内にゲームキーを叩いていたら無効(誤爆防止)、2秒アイドルで一時停止/再開
    onTogglePlay: () => {
      if (performance.now() - lastGameKeyTimeRef.current < 2000) return;
      if (isPlayingRef.current) pausePlayback(); else startPlayback();
    },
    onLiveResult: (show) => { showLiveResultRef.current = show; if (show) scheduleRenderLoop(); },
    onModifier: (name, held) => { if (name === 'shift') isShiftHeldRef.current = held; else isCtrlHeldRef.current = held; },
    onActivate: () => { gamepad.snapshot(); scheduleRenderLoop(); }, // 押しっぱなしのボタンを新規押下と誤検知しないように
  });

  const is2P = playSide === '2P';
  // レーン領域(キャンバス)の幅 = 盤面ぴったり。余った幅はサイドBGA等に回る。
  const canvasBoardW = parsedSong ? Math.ceil(boardUnitsFor(parsedSong, is2P) * laneWidthPx + 28) : 460;

  // 設定画面「入力」タブの設定一式(値が変わったときだけ作り直し、SettingsModal の memo を効かせる)
  const inputSettings = React.useMemo(() => ({
    keyMaps, setKeyMaps, gamepadEnabled, setGamepadEnabled, gamepadName,
    gamepadMaps, setGamepadMaps, gamepadScratchAlt, setGamepadScratchAlt,
    gamepadAxisDelta, setGamepadAxisDelta, gamepadAxisReleaseMs, setGamepadAxisReleaseMs,
  }), [keyMaps, gamepadEnabled, gamepadName, gamepadMaps, gamepadScratchAlt, gamepadAxisDelta, gamepadAxisReleaseMs]);

  // 設定画面「システム」タブの設定一式
  const systemSettings = React.useMemo(() => ({
    liteMode, setLiteMode, showReady, setShowReady,
    playKeySounds, setPlayKeySounds, playLongAudio, setPlayLongAudio, playBgSounds, setPlayBgSounds,
    resumeAudioOnSeek, setResumeAudioOnSeek, showMutedMonitor, setShowMutedMonitor, showAbortedMonitor, setShowAbortedMonitor,
    isInputDebugMode, setIsInputDebugMode, muteDebugAutoPlay, setMuteDebugAutoPlay,
    scratchRotationEnabled, setScratchRotationEnabled,
  }), [liteMode, showReady, playKeySounds, playLongAudio, playBgSounds, resumeAudioOnSeek, showMutedMonitor, showAbortedMonitor, isInputDebugMode, muteDebugAutoPlay, scratchRotationEnabled]);

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
  // HI-SPEED の手動変更。緑数字を維持中なら OFF にはせず、変更後の速さでの緑数字(主BPM 基準)を新しい目標にする
  //   (IIDX のフローティング HI-SPEED と同じ。次の曲でもこの緑数字になる)。
  const sHiSpeedChange = useEvent((v) => {
    setHiSpeed(v);
    if (autoHiSpeed && parsedSong && v > 0) {
      const g = greenNumber(songBaseBpm(parsedSong), v, whiteNumber(visibilityMode, suddenPlusVal, liftVal));
      setTargetGreen(Math.max(60, Math.min(1500, Math.round(g))));
    }
  });
  const sSuggestJudgeOffset = useEvent(suggestJudgeOffset);

  // 設定画面「表示」タブの設定一式(HI-SPEED の手動変更は sHiSpeedChange 経由)
  const viewSettings = React.useMemo(() => ({
    visibilityMode, setVisibilityMode, suddenPlusVal, setSuddenPlusVal, hiddenPlusVal, setHiddenPlusVal, liftVal, setLiftVal,
    hasVideo, playBgaVideo, setPlayBgaVideo, missLayerEnabled, setMissLayerEnabled,
    bgaBehindChart, setBgaBehindChart, bgaSidePanel, setBgaSidePanel, bgaSidePos, setBgaSidePos,
    laneWidthPx, setLaneWidthPx, bgaOpacity, setBgaOpacity, boardOpacity, setBoardOpacity, laneOpacity, setLaneOpacity,
    autoHiSpeed, setAutoHiSpeed, targetGreen, setTargetGreen, hiSpeed,
  }), [visibilityMode, suddenPlusVal, hiddenPlusVal, liftVal, hasVideo, playBgaVideo, missLayerEnabled, bgaBehindChart, bgaSidePanel,
      bgaSidePos, laneWidthPx, bgaOpacity, boardOpacity, laneOpacity, autoHiSpeed, targetGreen, hiSpeed]);

  // 設定画面「プレイ」タブの設定一式(ハンドラは参照が安定した sXxx を使う)
  const playSettings = React.useMemo(() => ({
    laneMute, setLaneMute, playSide, setPlaySide, playOption, setPlayOption, playOption2, setPlayOption2, dpFlip, setDpFlip,
    currentLaneOrder, laneOrder2, refreshRandom: sRefreshRandom,
    playMode, setPlayMode, judgeOffset, setJudgeOffset, suggestJudgeOffset: sSuggestJudgeOffset, judgeSystem, setJudgeSystem, judgeCfg,
  }), [laneMute, playSide, playOption, playOption2, dpFlip, currentLaneOrder, laneOrder2, sRefreshRandom,
      playMode, judgeOffset, sSuggestJudgeOffset, judgeSystem, judgeCfg]);

  // 設定画面「音」タブの設定一式(ハンドラは参照が安定した sXxx を使う)
  const soundSettings = React.useMemo(() => ({
    audioFx, setAudioFx, hitSoundVolume, setHitSoundVolume, isSeparateHitSound, setIsSeparateHitSound,
    handleKeyHitSoundUpload: sKeyHitUpload, handleKeyHitSoundReset: sKeyHitReset,
    handleScratchHitSoundUpload: sScratchHitUpload, handleScratchHitSoundReset: sScratchHitReset,
    tempKeySoundName, tempScratchSoundName, customKeyHitSound, customScratchHitSound,
  }), [audioFx, hitSoundVolume, isSeparateHitSound, tempKeySoundName, tempScratchSoundName, customKeyHitSound, customScratchHitSound,
      sKeyHitUpload, sKeyHitReset, sScratchHitUpload, sScratchHitReset]);

  return (
    <div className={`flex flex-col h-screen bg-neutral-950 text-white font-sans overflow-hidden ${isDragOver ? 'ring-4 ring-blue-500' : ''}`}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      
      <SettingsModal
        showSettings={showSettings} setShowSettings={setShowSettings} isMobile={isMobile}
        view={viewSettings} play={playSettings} input={inputSettings} sound={soundSettings} system={systemSettings}
        // スマホ用のファイル読込・基本設定
        handleFileSelect={sHandleFileSelect} handleZipSelect={sHandleZipSelect} bmsList={bmsList} selectedBmsIndex={selectedBmsIndex} setSelectedBmsIndex={setSelectedBmsIndex}
        hiSpeed={hiSpeed} setHiSpeed={sHiSpeedChange} volume={volume} setVolume={setVolume}
        parsedSong={parsedSong}
      />

      {playResult && (
        <ResultModal
          data={playResult}
          onClose={() => setPlayResult(null)}
          onRetry={() => { setPlayResult(null); pauseTimeRef.current = 0; startPlayback(); }}
        />
      )}

      {/* メインエリア: PCとスマホで構造を分ける */}
      <div className="flex-1 relative min-h-0 overflow-hidden flex justify-center">
         {/* 読み込み中の表示(ZIP 解凍 / BMS 解析 / 音声デコードの進捗) */}
         {isLoading && <LoadingOverlay message={loadingMessage} progress={loadingProgress} />}
         
         {/* スマホ用: 背景BGA */}
         {isMobile && (
             <MobileBgaLayers live={live} isPlaying={isPlaying} playBgaVideo={playBgaVideo} opacity={bgaOpacity}
                 backRef={mobileBackBgaRef} layerRef={mobileLayerBgaRef} poorRef={mobilePoorBgaRef} />
         )}

         {/* PCレイアウト */}
         {!isMobile && (() => {
            return (
             <div className="flex w-full h-full">
                 {/* 左: コントローラー */}
                 <ControllerPanel
                    ref={controllerPanelRef}
                    controllerRefs={controllerRefs} keyboardRefs={keyboardRefs}
                    is2P={is2P} parsedSong={parsedSong} difficultyInfo={difficultyInfo}
                    live={live}
                    keyMap={keyMaps[parsedSong?.mode] || keyMaps.SP7}
                 />

                 {/* 中央ゾーン: 情報 + レーンゾーン */}
                 <div className="flex-1 flex min-w-0 border-r border-blue-900/30">
                     {/* 情報・BGA (背面BGAはここには掛けない) */}
                     <InfoPanel
                        ref={infoPanelRef}
                        playOption={(parsedSong?.mode === 'DP14' || parsedSong?.mode === 'DP10')
                            ? `${playOption}/${playOption2}${dpFlip ? ' F' : ''}`
                            : playOption}
                        live={live} isPlaying={isPlaying}
                        playBgaVideo={playBgaVideo && !(lite.noDupVideo && (bgaBehindChart || bgaSidePanel))} readyAnimState={readyAnimState}
                        totalNotes={totalNotes}
                     />

                     {/* レーンゾーン: (サイドBGA) + レーン。背面BGA はこの範囲だけに敷く。 */}
                     <div className="relative flex-1 flex min-w-0">
                         {bgaBehindChart && (
                             <div className="absolute inset-0 z-0 bg-black pointer-events-none">
                                 <BgaStage ref={pcBehindBgaRef} live={live} isPlaying={isPlaying} isVideoEnabled={playBgaVideo} opacity={bgaOpacity} fit="contain" />
                             </div>
                         )}

                         {/* サイドBGA: 常時マウントし、幅/不透明度/order だけを CSS で切り替える。
                             条件付きレンダリングでON/OFFの度にアンマウント→再マウントしていたため、
                             毎回動画が0秒から再読み込みされ、常時再生中のInfoPanelプレビューとの間に
                             シーク待ちのタイムラグが生じていた(ON/OFF・左右切替のどちらでも同様)。 */}
                         <div className={`relative z-10 bg-black overflow-hidden flex items-center justify-center transition-[flex-grow,opacity] duration-150 ${bgaSidePanel ? 'flex-1 min-w-[140px] opacity-100 border-r border-blue-900/30' : 'flex-none w-0 min-w-0 opacity-0 pointer-events-none'}`}
                              style={{ order: bgaSidePos === 'left' ? 0 : 2 }}>
                             {/* ★軽量化: 非表示中もマウントは維持(再表示時の再読み込みを避ける)するが、動画は一時停止してデコードさせない */}
                             <BgaStage ref={pcSideBgaRef} live={live} isPlaying={isPlaying && bgaSidePanel} isVideoEnabled={playBgaVideo} opacity={bgaOpacity} fit="contain" />
                             <BgaPlaceholder live={live} />
                         </div>

                         {/* レーン (Canvas) = 盤面ぴったりの幅。サイドBGA表示時はこの幅に固定し、残りをBGAへ。 */}
                         <div className={`relative z-10 min-w-0 flex justify-center overflow-hidden ${bgaSidePanel ? 'flex-none' : 'flex-1'} ${bgaBehindChart ? '' : 'bg-black'}`}
                              style={{ order: 1, ...(bgaSidePanel ? { width: canvasBoardW, maxWidth: '100%' } : null) }}>
                            <canvas ref={canvasRef} className="relative z-10 h-full w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]" style={{ maxWidth: canvasBoardW }} />
                            {!parsedSong && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-blue-900/20 z-20"><div className="text-center animate-pulse"><FolderOpen size={64} className="mx-auto mb-4 opacity-50"/><p className="text-xl font-bold tracking-widest">DROP FILE HERE</p></div></div>}
                         </div>
                     </div>
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
                    quiet={lite.quietMonitors}
                 />
             </div>
            );
         })()}

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

         {/* PC用: 画面右上に固定の設定ボタン(設定ドロワーが出てくる位置と揃える) */}
         {!isMobile && (
             <button
                onClick={() => setShowSettings(v => !v)}
                title="設定"
                className="fixed top-3 right-3 z-[90] p-2.5 bg-blue-600/80 hover:bg-blue-500 rounded-full text-white shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
             >
                 <Settings size={20} />
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