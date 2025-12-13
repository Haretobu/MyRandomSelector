// src/bms/constants.js

export const LANE_MAP = {
  '16':{index:0,isScratch:true,isLong:false},'11':{index:1,isScratch:false,isLong:false},'12':{index:2,isScratch:false,isLong:false},'13':{index:3,isScratch:false,isLong:false},
  '14':{index:4,isScratch:false,isLong:false},'15':{index:5,isScratch:false,isLong:false},'18':{index:6,isScratch:false,isLong:false},'19':{index:7,isScratch:false,isLong:false},
  '56':{index:0,isScratch:true,isLong:true},'51':{index:1,isScratch:false,isLong:true},'52':{index:2,isScratch:false,isLong:true},'53':{index:3,isScratch:false,isLong:true},
  '54':{index:4,isScratch:false,isLong:true},'55':{index:5,isScratch:false,isLong:true},'58':{index:6,isScratch:false,isLong:true},'59':{index:7,isScratch:false,isLong:true},
  '01':{index:-1,isBg:true}, '04':{index:-1,isBg:true}, '06':{index:-1,isBg:true}, '07':{index:-1,isBg:true}
};

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