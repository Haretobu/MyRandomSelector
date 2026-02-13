// src/bms/components/BgaLayer.jsx
import React, { useRef, useEffect } from 'react';

const BgaLayer = ({ bgaState, zIndex, blendMode = 'normal', opacity = 1, isPlaying, currentTime, isVideoEnabled = true }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        if (bgaState?.type === 'video' && videoRef.current) {
             const video = videoRef.current;
             const targetTime = Math.max(0, currentTime - (bgaState.startTime || 0));
             
             if (isPlaying) {
                 if (video.paused) video.play().catch(() => {});
                 if (Math.abs(video.currentTime - targetTime) > 0.05) {
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
              // ★修正: object-contain -> object-cover に変更 (画面いっぱいに表示)
              className="absolute inset-0 w-full h-full object-cover" 
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
          // ★修正: object-contain -> object-cover に変更
          className="absolute inset-0 w-full h-full object-cover" 
          style={{ zIndex, mixBlendMode: blendMode, opacity }} 
          alt="BGA" 
      />
    );
};

export default BgaLayer;