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

// BGAのデフォルト不透明度
export const DEFAULT_BGA_OPACITY = 0.5;