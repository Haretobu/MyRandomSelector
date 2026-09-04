// src/bms/components/BgaStage.jsx
// back / layer / poor BGA の3枚をまとめて絶対配置で重ねるステージ。
// PC の「レーン背面BGA」「サイドBGAパネル」で使う。syncTime で動画BGAの位置合わせを行う。
import React, { forwardRef, useImperativeHandle, useRef, memo } from 'react';
import BgaLayer from './BgaLayer';

const BgaStage = forwardRef(({
    backBga, layerBga, poorBga, showMiss,
    isPlaying, isVideoEnabled = true, opacity = 1,
}, ref) => {
    const backRef = useRef(null);
    const layerRef = useRef(null);
    const poorRef = useRef(null);

    useImperativeHandle(ref, () => ({
        syncTime: (t) => {
            backRef.current?.syncTime(t);
            layerRef.current?.syncTime(t);
            if (showMiss) poorRef.current?.syncTime(t);
        },
    }));

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ opacity }}>
            <BgaLayer ref={backRef} bgaState={backBga} zIndex={0} isPlaying={isPlaying} isVideoEnabled={isVideoEnabled} />
            <BgaLayer ref={layerRef} bgaState={layerBga} zIndex={10} blendMode="screen" isPlaying={isPlaying} isVideoEnabled={isVideoEnabled} />
            {showMiss && poorBga && (
                <div className="absolute inset-0 w-full h-full z-50 bg-black/50">
                    <BgaLayer ref={poorRef} bgaState={poorBga} zIndex={50} isPlaying={isPlaying} isVideoEnabled={isVideoEnabled} />
                </div>
            )}
        </div>
    );
});

export default memo(BgaStage);
