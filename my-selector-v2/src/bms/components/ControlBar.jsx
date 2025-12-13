// src/bms/components/ControlBar.jsx
import React from 'react';
import { FolderOpen, ChevronFirst, Pause, Play, VolumeX, Volume2 } from 'lucide-react';

const ControlBar = ({
    handleFileSelect, selectedBmsIndex, setSelectedBmsIndex, bmsList,
    stopPlayback, isPlaying, pausePlayback, startPlayback,
    duration, playbackTimeDisplay, handleSeek,
    hiSpeed, setHiSpeed, volume, setVolume, toggleMute
}) => {
    return (
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
    );
};

export default ControlBar;