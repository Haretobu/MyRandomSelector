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

// 判定幅は logic/judge.js(判定方式 BMS / IIDX、#RANK による拡縮)を参照。

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

// 音声の先読み予約(秒)。メインスレッドが一瞬止まっても(低スペック機の引っかかり)予約済みの音は鳴るよう、
// 0.1 → 0.3 に拡大。0.1 だと 0.2 秒程度の停止で「予約が間に合わず捨てられる」キー音が出ていた。
export const LOOKAHEAD = 0.3;
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

// lite モード(低スペック機向け)。enabled が親スイッチで、各項目は enabled のときだけ効く。
// いずれも「見た目・演出と引き換えに軽くする」もの(不具合修正系の軽量化はモードに関係なく常に有効)。
export const DEFAULT_LITE_MODE = {
  enabled: false,
  lowRes: true,         // 描画解像度を等倍(devicePixelRatio=1)に落とす
  fpsCap: true,         // 描画を 60fps に制限(120/144Hz の画面向け)
  noDupVideo: true,     // 背面/サイドBGA表示中は左のプレビューで動画を再生しない
  simpleEffects: true,  // ノーツ通過時の光るグラデーション・ボタンの発光を簡易化
  quietMonitors: true,  // SOUND MONITOR 等のログ更新を間引き、密度グラフのスクロールを即時に
  fxBypass: true,       // サウンドエフェクト無効時はエフェクト処理を経路から外す
};
export const LITE_MODE_ITEMS = [
  { key: 'lowRes', label: '描画解像度を下げる', desc: '高解像度(125%/150%表示など)の画面でも等倍で描画。効果: 大' },
  { key: 'fpsCap', label: '60fps に制限', desc: '120Hz/144Hz の画面で描画回数を抑える。効果: 中〜大' },
  { key: 'noDupVideo', label: '動画BGAの二重再生をしない', desc: '背面/サイドBGA表示中は左のプレビューで動画を再生しない。効果: 大(動画BGAの譜面)' },
  { key: 'simpleEffects', label: 'ノーツ・ボタンの演出を簡易化', desc: '光るグラデーションや発光を省略。効果: 中(高密度譜面)' },
  { key: 'quietMonitors', label: 'モニター表示の更新を減らす', desc: 'SOUND MONITOR 等の更新を間引く。効果: 小〜中' },
  { key: 'fxBypass', label: '未使用のエフェクト処理を外す', desc: 'サウンドエフェクト無効時に音声経路から外す。効果: 小' },
];

// BGAのデフォルト不透明度
export const DEFAULT_BGA_OPACITY = 0.5;