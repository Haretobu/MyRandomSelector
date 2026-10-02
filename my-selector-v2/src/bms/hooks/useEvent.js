// src/bms/hooks/useEvent.js
import { useRef } from 'react';

// 参照が安定した関数を返す(常に最新の実装を呼ぶ)。子の React.memo を効かせるために使う。
export function useEvent(fn) {
    const ref = useRef(fn);
    ref.current = fn;
    return useRef((...a) => ref.current(...a)).current;
}
