// src/bms/logic/liveStore.js
// 再生中に高頻度で変わる表示用の値(BGA / ミスレイヤー / 現在小節など)を保持する小さなストア。
// ★軽量化: これらを BmsViewer の useState に置くと、BGA が切り替わるたび(コマ送りBGAなら毎秒数十回)に
//   巨大な BmsViewer 全体が再レンダリングされ、低スペック機での引っかかりの原因になっていた。
//   ストアに置き、値を表示するコンポーネントだけが useLiveStore で購読して再レンダリングする。
import { useSyncExternalStore } from 'react';

export function createLiveStore(initial) {
    let state = initial;
    const subs = new Set();
    return {
        get: () => state,
        // 値が変わったキーがあるときだけ通知する(同じ値の set は何もしない)
        set: (patch) => {
            let changed = false;
            for (const k in patch) { if (state[k] !== patch[k]) { changed = true; break; } }
            if (!changed) return;
            state = { ...state, ...patch };
            subs.forEach(f => f());
        },
        subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    };
}

// selector は state の一部(プリミティブ or 参照が安定した値)を返すこと
export function useLiveStore(store, selector) {
    return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
