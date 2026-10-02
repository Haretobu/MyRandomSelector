// src/bms/hooks/useStoredState.js
// localStorage に保存される state と、state の最新値を持つ ref の小さなフック集。
import { useState, useEffect, useRef } from 'react';

/**
 * localStorage に永続化される useState。
 * @param {string} key localStorage のキー
 * @param {*} defaultValue 保存値が無い / 読めないときの値
 * @param {{ read?: (raw: string) => *, write?: (value: *) => string }} codec
 *   read: 保存文字列 → 値(undefined を返すと defaultValue)。write: 値 → 保存文字列。既定は JSON。
 */
export function useStoredState(key, defaultValue, codec = JSON_CODEC) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
            const v = codec.read(raw);
            return v === undefined ? (typeof defaultValue === 'function' ? defaultValue() : defaultValue) : v;
        } catch { return typeof defaultValue === 'function' ? defaultValue() : defaultValue; } // privacy mode 等
    });
    useEffect(() => {
        try { localStorage.setItem(key, codec.write(value)); } catch { /* quota / privacy mode */ }
    }, [key, value]); // codec は呼び出し側で固定(モジュール定数)の想定
    return [value, setValue];
}

const JSON_CODEC = { read: (raw) => JSON.parse(raw), write: (v) => JSON.stringify(v) };
/** '1' / '0' で保存する真偽値 */
export const BOOL = { read: (raw) => raw === '1', write: (v) => (v ? '1' : '0') };
/** 文字列のまま保存。allowed を渡すとその中の値だけ受け付ける */
export const oneOf = (...allowed) => ({ read: (raw) => (allowed.includes(raw) ? raw : undefined), write: String });
/** 数値。valid(n) が false なら既定値 */
export const num = (valid = Number.isFinite) => ({ read: (raw) => { const n = Number(raw); return valid(n) ? n : undefined; }, write: String });
/** オブジェクト(JSON)。既定値に保存値を浅くマージする(項目追加に強くする)。merge で深いマージも指定可 */
export const mergedJson = (defaults, merge = (d, s) => ({ ...d, ...s })) => ({
    read: (raw) => { const s = JSON.parse(raw); return s && typeof s === 'object' ? merge(defaults, s) : undefined; },
    write: (v) => JSON.stringify(v),
});

/**
 * 常に最新の value を指す ref。renderLoop やイベントリスナーなど、クロージャが古くなる場所から読む用。
 * (描画中に代入するので、別の場所から ref に直接書き込む値には使わないこと)
 */
export function useLatestRef(value) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}
