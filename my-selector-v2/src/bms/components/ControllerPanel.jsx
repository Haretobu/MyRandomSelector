// src/bms/components/ControllerPanel.jsx
import React from 'react';
import { Gamepad2, Keyboard } from 'lucide-react';
import { KEY_CONFIG_ROWS } from '../constants';
import DensityGraph from './DensityGraph';

const ControllerPanel = ({ controllerRefs, keyboardRefs, noteCounts, is2P, parsedSong, difficultyInfo, currentMeasure }) => {
    return (
        <div className="w-64 flex flex-col border-r border-blue-900/30 bg-[#080808] p-2 gap-2 shrink-0 overflow-y-auto scrollbar-hide text-blue-100">
            {/* コントローラー (ターンテーブル等) */}
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

            {/* キーマッピング (★光り方を強化) */}
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

            <DensityGraph parsedSong={parsedSong} currentMeasure={currentMeasure} />

            {/* 曲情報パネル */}
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
    );
};

export default ControllerPanel;