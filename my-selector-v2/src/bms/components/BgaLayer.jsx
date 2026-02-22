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

                // ズレが0.1秒以上あったら強制的に合わせる
                if (Math.abs(video.currentTime - targetTime) > 0.1) {
                    video.currentTime = targetTime;
                }
            }
        }
    }));

    // ★修正ポイント1：BGA画像/動画が切り替わった時だけリセットする
    useEffect(() => {
        if (bgaState?.type === 'video' && videoRef.current) {
             const video = videoRef.current;
             // 動画ファイルが変わったので0秒に戻す
             video.currentTime = 0;
             // もし曲が再生中なら、動画も再生開始する
             if(isPlaying) video.play().catch(()=>{});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bgaState]); // ← 依存配列から isPlaying を削除しました！

    // ★修正ポイント2：一時停止/再開ボタンが押された時の処理（時間はリセットしない）
    useEffect(() => {
        if (bgaState?.type === 'video' && videoRef.current) {
            const video = videoRef.current;
            if (isPlaying) {
                video.play().catch(() => {});
            } else {
                video.pause(); // 時間は維持したまま停止
            }
        }
    }, [isPlaying]);

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