// src/bms/components/BgaLayer.jsx
import React, { useRef, useEffect, forwardRef, useImperativeHandle, memo } from 'react';

const BgaLayer = forwardRef(({ bgaState, zIndex, blendMode = 'normal', opacity = 1, isPlaying, isVideoEnabled = true, objectFit = 'cover' }, ref) => {
    const videoRef = useRef(null);
    const lastSyncRef = useRef(0); // ★軽量化: video.currentTime= の実行を間引く

    // 親から「時間を合わせろ」と命令されたときに動く関数
    useImperativeHandle(ref, () => ({
        syncTime: (currentTime) => {
            if (bgaState?.type === 'video' && videoRef.current) {
                const video = videoRef.current;
                const startTime = bgaState.startTime || 0;
                // 動画内での再生位置を計算
                const targetTime = Math.max(0, currentTime - startTime);
                const now = performance.now();

                // ★動画の尺を越えた区間: 最終フレームで止めておく。
                //   以前は終端に達した(ended → paused)動画に毎フレーム play() を呼んでいたが、
                //   ended な動画への play() は仕様上「先頭に巻き戻して再生」になるため、
                //   先頭へ戻る → 終端へシーク → また ended … を繰り返して BGA がちらついていた。
                const vd = video.duration;
                if (Number.isFinite(vd) && targetTime >= vd - 0.05) {
                    if (!video.paused) video.pause();
                    if (!video.ended && vd - video.currentTime > 0.1 && now - lastSyncRef.current > 250) {
                        lastSyncRef.current = now;
                        video.currentTime = vd;
                    }
                    return;
                }

                // ★軽量化: 毎フレーム video.currentTime= を代入するとデコーダが詰まって重い。
                //   ズレの許容を 0.3s に広げ、実際のシークは最大 ~4Hz に間引く。
                //   ended 状態からの復帰(シークで巻き戻した等)は play() より先に即シークし、先頭再生を挟まない。
                if ((video.ended || now - lastSyncRef.current > 250) && Math.abs(video.currentTime - targetTime) > 0.3) {
                    lastSyncRef.current = now;
                    video.currentTime = targetTime;
                }

                // 再生中なら再生、停止中なら停止
                if (isPlaying) {
                    if (video.paused) video.play().catch(() => {});
                } else {
                    if (!video.paused) video.pause();
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
                // 終端に達した動画への play() は先頭からの再生になるため、ここでは触らない(syncTime に任せる)
                if (!video.ended) video.play().catch(() => {});
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
              className="absolute inset-0 w-full h-full"
              style={{ zIndex, mixBlendMode: blendMode, opacity, objectFit }}
              muted
              playsInline
              loop={false}
          />
        );
    }
    
    return (
      <img
          src={bgaState.src || bgaState.url}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex, mixBlendMode: blendMode, opacity, objectFit }}
          alt="BGA"
      />
    );
});

export default memo(BgaLayer);