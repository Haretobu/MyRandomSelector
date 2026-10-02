// src/bms/components/MobileBgaLayers.jsx
// スマホ用の背景BGA と、サイドBGAパネルのプレースホルダ。
// BGA の値はストアから購読する(BmsViewer 本体を再レンダリングさせないため)。
import React from 'react';
import BgaLayer from './BgaLayer';
import { useLiveStore } from '../logic/liveStore';

export default function MobileBgaLayers({ live, isPlaying, playBgaVideo, opacity, backRef, layerRef, poorRef }) {
    const back = useLiveStore(live, s => s.backBga);
    const layer = useLiveStore(live, s => s.layerBga);
    const poor = useLiveStore(live, s => s.poorBga);
    const showMiss = useLiveStore(live, s => s.showMiss);
    return (
        <div className="absolute inset-0 z-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none" style={{ opacity }}>
            <BgaLayer ref={backRef} bgaState={back} zIndex={0} isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
            <BgaLayer ref={layerRef} bgaState={layer} zIndex={10} blendMode="screen" isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
            {showMiss && poor && (
                <div className="absolute inset-0 w-full h-full z-50 bg-black/50 flex items-center justify-center">
                    <BgaLayer ref={poorRef} bgaState={poor} zIndex={50} isPlaying={isPlaying} isVideoEnabled={playBgaVideo} />
                </div>
            )}
        </div>
    );
}

// サイドBGAパネルの「BGA」プレースホルダ(BGA が無いときだけ表示)
export function BgaPlaceholder({ live }) {
    const hasBga = useLiveStore(live, s => !!(s.backBga || s.layerBga));
    return hasBga ? null : <div className="text-blue-900/40 text-xs font-bold tracking-widest pointer-events-none">BGA</div>;
}
