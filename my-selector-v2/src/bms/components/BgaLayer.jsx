// src/bms/components/BgaLayer.jsx
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const BgaLayer = forwardRef(({ bgaState, zIndex, blendMode = 'normal', opacity = 1, isPlaying, isVideoEnabled = true }, ref) => {
    const videoRef = useRef(null);

    // 親から「時間を合わせろ」と命令されたときに動く関数
    useImperativeHandle(ref, () => ({
        syncTime: (currentTime) => {
            if (bgaState?.type === 'video' && videoRef.current) {
                const video = videoRef.current;
                const startTime = bgaState.startTime || 0;
                // 動画内での再生位置を計算
                const targetTime = Math.max(0, currentTime - startTime);

                // 再生中なら再生、停止中なら停止
                if (isPlaying) {
                    if (video.paused) video.play().catch(() => {});
                } else {
                    if (!video.paused) video.pause();
                }

                // ズレが0.1秒以上あったら強制的に合わせる（頻繁にやりすぎないように許容範囲を持つ）
                if (Math.abs(video.currentTime - targetTime) > 0.1) {
                    video.currentTime = targetTime;
                }
            }
        }
    }));

    // bgaState（再生するファイル）が変わったときだけ動く初期化処理
    useEffect(() => {
        if (bgaState?.type === 'video' && videoRef.current) {
             const video = videoRef.current;
             // ファイルが変わったらリセット
             video.currentTime = 0;
             if(isPlaying) video.play().catch(()=>{});
        }
    }, [bgaState, isPlaying]);

    if (!bgaState) return null;

    if (bgaState.type === 'video') {
        if (!isVideoEnabled) return null;
        return (
          <video 
              ref={videoRef}
              src={bgaState.url || bgaState.src} 
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
          className="absolute inset-0 w-full h-full object-cover" 
          style={{ zIndex, mixBlendMode: blendMode, opacity }} 
          alt="BGA" 
      />
    );
});

export default BgaLayer;