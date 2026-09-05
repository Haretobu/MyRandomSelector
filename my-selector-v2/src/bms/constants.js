// src/bms/constants.js

// レーンインデックス: 0=1Pスクラッチ, 1-7=1P鍵1-7, 8=2Pスクラッチ, 9-15=2P鍵1-7
// (PMS/9K は PMS_LANE_MAP で index 0-8 = 9ボタンに割り当てる)
export const LANE_MAP = {
  // --- 1P side ---
  '16':{index:0,isScratch:true,isLong:false},'11':{index:1,isScratch:false,isLong:false},'12':{index:2,isScratch:false,isLong:false},'13':{index:3,isScratch:false,isLong:false},
  '14':{index:4,isScratch:false,isLong:false},'15':{index:5,isScratch:false,isLong:false},'18':{index:6,isScratch:false,isLong:false},'19':{index:7,isScratch:false,isLong:false},
  '56':{index:0,isScratch:true,isLong:true},'51':{index:1,isScratch:false,isLong:true},'52':{index:2,isScratch:false,isLong:true},'53':{index:3,isScratch:false,isLong:true},
  '54':{index:4,isScratch:false,isLong:true},'55':{index:5,isScratch:false,isLong:true},'58':{index:6,isScratch:false,isLong:true},'59':{index:7,isScratch:false,isLong:true},
  // --- 2P side (DP) ---
  '26':{index:8,isScratch:true,isLong:false},'21':{index:9,isScratch:false,isLong:false},'22':{index:10,isScratch:false,isLong:false},'23':{index:11,isScratch:false,isLong:false},
  '24':{index:12,isScratch:false,isLong:false},'25':{index:13,isScratch:false,isLong:false},'28':{index:14,isScratch:false,isLong:false},'29':{index:15,isScratch:false,isLong:false},
  '66':{index:8,isScratch:true,isLong:true},'61':{index:9,isScratch:false,isLong:true},'62':{index:10,isScratch:false,isLong:true},'63':{index:11,isScratch:false,isLong:true},
  '64':{index:12,isScratch:false,isLong:true},'65':{index:13,isScratch:false,isLong:true},'68':{index:14,isScratch:false,isLong:true},'69':{index:15,isScratch:false,isLong:true},
  // --- BG / BGA ---
  '01':{index:-1,isBg:true}, '04':{index:-1,isBg:true}, '06':{index:-1,isBg:true}, '07':{index:-1,isBg:true}
};

// PMS (pop'n / 9K): 9ボタンを index 0-8 に。スクラッチなし。
export const PMS_LANE_MAP = {
  '11':{index:0,isScratch:false,isLong:false},'12':{index:1,isScratch:false,isLong:false},'13':{index:2,isScratch:false,isLong:false},'14':{index:3,isScratch:false,isLong:false},'15':{index:4,isScratch:false,isLong:false},
  '22':{index:5,isScratch:false,isLong:false},'23':{index:6,isScratch:false,isLong:false},'24':{index:7,isScratch:false,isLong:false},'25':{index:8,isScratch:false,isLong:false},
  '51':{index:0,isScratch:false,isLong:true},'52':{index:1,isScratch:false,isLong:true},'53':{index:2,isScratch:false,isLong:true},'54':{index:3,isScratch:false,isLong:true},'55':{index:4,isScratch:false,isLong:true},
  '62':{index:5,isScratch:false,isLong:true},'63':{index:6,isScratch:false,isLong:true},'64':{index:7,isScratch:false,isLong:true},'65':{index:8,isScratch:false,isLong:true},
  '01':{index:-1,isBg:true}, '04':{index:-1,isBg:true}, '06':{index:-1,isBg:true}, '07':{index:-1,isBg:true}
};

// モード別のレーン並び(描画用)。kind: 'scratch' | 'key'、side: 0=1P / 1=2P
const _K = (index, side = 0) => ({ index, kind: 'key', side });
const _SC = (index, side = 0) => ({ index, kind: 'scratch', side });
export const LANE_LAYOUTS = {
  SP7:  [_SC(0), _K(1), _K(2), _K(3), _K(4), _K(5), _K(6), _K(7)],
  SP5:  [_SC(0), _K(1), _K(2), _K(3), _K(4), _K(5)],
  DP14: [_SC(0), _K(1), _K(2), _K(3), _K(4), _K(5), _K(6), _K(7),
         _K(9, 1), _K(10, 1), _K(11, 1), _K(12, 1), _K(13, 1), _K(14, 1), _K(15, 1), _SC(8, 1)],
  DP10: [_SC(0), _K(1), _K(2), _K(3), _K(4), _K(5),
         _K(9, 1), _K(10, 1), _K(11, 1), _K(12, 1), _K(13, 1), _SC(8, 1)],
  PMS9: [_K(0), _K(1), _K(2), _K(3), _K(4), _K(5), _K(6), _K(7), _K(8)],
};

// PMS(9K) のレーンカラー = pop'n music 準拠 (白黄緑青赤青緑黄白)
export const PMS_LANE_COLORS = ['#f1f5f9', '#facc15', '#4ade80', '#60a5fa', '#f87171', '#60a5fa', '#4ade80', '#facc15', '#f1f5f9'];

export const MODE_LABELS = { SP7: 'SP 7K', SP5: 'SP 5K', DP14: 'DP 14K', DP10: 'DP 10K', PMS9: '9K (pop\'n)', UNSUPPORTED: '—' };

// レーン index → KeyboardEvent.code。設定で変更可能・localStorage に永続化。
// SP = KEY MAPPING 準拠 / DP 右サイドは RightShift を皿に、鍵1→7 で「, l . ; / : \」(RightShift から左へ \ : / ; . l ,)。
// PMS(9K) = SP の拡張(Z S X D C F V + G B)。
export const DEFAULT_KEYMAPS = {
  SP7:  { 0: 'ShiftLeft', 1: 'KeyZ', 2: 'KeyS', 3: 'KeyX', 4: 'KeyD', 5: 'KeyC', 6: 'KeyF', 7: 'KeyV' },
  SP5:  { 0: 'ShiftLeft', 1: 'KeyZ', 2: 'KeyS', 3: 'KeyX', 4: 'KeyD', 5: 'KeyC' },
  DP14: {
    0: 'ShiftLeft', 1: 'KeyZ', 2: 'KeyS', 3: 'KeyX', 4: 'KeyD', 5: 'KeyC', 6: 'KeyF', 7: 'KeyV',
    9: 'Comma', 10: 'KeyL', 11: 'Period', 12: 'Semicolon', 13: 'Slash', 14: 'Quote', 15: 'Backslash', 8: 'ShiftRight',
  },
  DP10: {
    0: 'ShiftLeft', 1: 'KeyZ', 2: 'KeyS', 3: 'KeyX', 4: 'KeyD', 5: 'KeyC',
    9: 'Comma', 10: 'KeyL', 11: 'Period', 12: 'Semicolon', 13: 'Slash', 8: 'ShiftRight',
  },
  PMS9: { 0: 'KeyZ', 1: 'KeyS', 2: 'KeyX', 3: 'KeyD', 4: 'KeyC', 5: 'KeyF', 6: 'KeyV', 7: 'KeyG', 8: 'KeyB' },
};

const KEYCODE_LABELS = {
  ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt', AltRight: 'R-Alt', Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'BS',
  Semicolon: ';', Quote: ':', Slash: '/', Period: '.', Comma: ',', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
  IntlRo: '\\', IntlYen: '¥', CapsLock: 'Caps',
};

// KeyboardEvent.code → 画面表示用の短いラベル
export function keyCodeLabel(code) {
  if (!code) return '—';
  if (KEYCODE_LABELS[code]) return KEYCODE_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}

// 皿の逆方向キー(6-2-a)。keyMap の皿キー(既定 Shift)=一方向、こちら(Ctrl)=もう一方向。
// beatoraja のキーボードプレイに倣い、皿は2キーを交互に押して回す。
export const DEFAULT_SCRATCH_ALT = { 0: 'ControlLeft', 8: 'ControlRight' };

// ゲームパッド入力(Gamepad API)。ボタン番号は機種依存のため既定値はすべて未割り当て(null)。
// 設定画面で物理コントローラのボタンを押して割り当てる。形は DEFAULT_KEYMAPS と同じ(lane index → ボタン番号)。
export const DEFAULT_GAMEPAD_MAPS = Object.fromEntries(
  Object.entries(LANE_LAYOUTS).map(([mode, lanes]) => [mode, Object.fromEntries(lanes.map(l => [l.index, null]))])
);
// 皿の逆回転用ボタン(物理ターンテーブルが2ボタン式の場合のもう一方向)。DEFAULT_SCRATCH_ALT と同じ形。
export const DEFAULT_GAMEPAD_SCRATCH_ALT = { 0: null, 8: null };

// 判定ウィンドウ(6-2-a)。#RANK 0..3 別、片側 ms。beatoraja 準拠の近似値。
// pg=PGREAT, gr=GREAT, gd=GOOD, bd=BAD(これを超えて遅れると見逃しPOOR / 空打ちは空POOR)。
export const JUDGE_WINDOWS = [
    { pg: 15, gr: 33, gd: 53,  bd: 120 }, // RANK 0 VERY HARD
    { pg: 18, gr: 40, gd: 70,  bd: 120 }, // RANK 1 HARD
    { pg: 21, gr: 60, gd: 120, bd: 200 }, // RANK 2 NORMAL (既定)
    { pg: 25, gr: 75, gd: 150, bd: 250 }, // RANK 3 EASY
];
// #RANK ヘッダ値 → JUDGE_WINDOWS の添字(0..3)。未指定は NORMAL(2)。
export const judgeRankIndex = (rank) => {
    const r = Number(rank);
    if (!Number.isFinite(r)) return 2;
    return Math.max(0, Math.min(3, r));
};

// DJ LEVEL: EX SCORE 率 → ランク(6-2-b で表示)。
export const DJ_LEVEL_TABLE = [
    { min: 8 / 9, label: 'AAA' },
    { min: 7 / 9, label: 'AA' },
    { min: 6 / 9, label: 'A' },
    { min: 5 / 9, label: 'B' },
    { min: 4 / 9, label: 'C' },
    { min: 3 / 9, label: 'D' },
    { min: 2 / 9, label: 'E' },
    { min: 0,     label: 'F' },
];
export const djLevel = (rate) => (DJ_LEVEL_TABLE.find(d => rate >= d.min) || DJ_LEVEL_TABLE[DJ_LEVEL_TABLE.length - 1]).label;

export const KEY_CONFIG_ROWS = [
    [{label:'Shift',keyIndex:0,width:'w-14',isScratch:true},{label:'S',keyIndex:2,width:'w-10'},{label:'D',keyIndex:4,width:'w-10'},{label:'F',keyIndex:6,width:'w-10'}],
    [{label:'',keyIndex:-1,width:'w-14',isSpacer:true},{label:'Z',keyIndex:1,width:'w-10'},{label:'X',keyIndex:3,width:'w-10'},{label:'C',keyIndex:5,width:'w-10'},{label:'V',keyIndex:7,width:'w-10'}]
];

export const DIFFICULTY_MAP = {
    1:{label:'BEGINNER',color:'bg-green-600'},2:{label:'NORMAL',color:'bg-blue-600'},3:{label:'HYPER',color:'bg-yellow-500 text-black'},
    4:{label:'ANOTHER',color:'bg-red-600'},5:{label:'LEGGENDARIA',color:'bg-purple-600'} 
};

export const VISIBILITY_MODES = {
    OFF: 'OFF',
    SUDDEN_PLUS: 'SUDDEN+',
    HIDDEN_PLUS: 'HIDDEN+',
    SUD_HID_PLUS: 'SUD+ & HID+',
    LIFT: 'LIFT',
    LIFT_SUD_PLUS: 'LIFT & SUD+'
};

export const LOOKAHEAD = 0.1;
export const SCHEDULE_INTERVAL = 25;
export const MAX_SHORT_POLYPHONY = 256;

// この秒数以上のノーツ以外の音源を「BGM(著しく長い音源)」とみなす。
// これ未満のノーツ以外の音源は「バックサウンド」。長いインパクト系SEを BGM と誤分類しないための閾値。
export const BGM_MIN_DURATION = 20.0;

// モバイル判定の境界線 (px)
export const MOBILE_BREAKPOINT = 768;

// 6-3: サウンドエフェクト(EQ / ECHO / COMP / FILTER)の初期値。
//   マスターゲイン → FILTER → EQ(3band) → COMP → destination(dry)
//                                              → DELAY → wetGain → destination (feedback ループ付き = ECHO)
//   各エフェクトは常時接続し、無効時は「素通しになる値」にする(再接続によるプチノイズ回避)。
export const DEFAULT_AUDIO_FX = {
  enabled: false,
  filter: { on: false, type: 'lowpass', freq: 12000 }, // type: 'lowpass' | 'highpass'
  eq: { on: false, low: 0, mid: 0, high: 0 },          // dB (-24..+24), mid は 1kHz peaking
  comp: { on: false, threshold: -24, ratio: 4 },        // dB / 比
  echo: { on: false, time: 0.3, feedback: 0.35, mix: 0.25 }, // 秒 / 0..0.9 / 0..1
};

// BGAのデフォルト不透明度
export const DEFAULT_BGA_OPACITY = 0.5;