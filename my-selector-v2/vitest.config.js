// 単体テスト(Vitest)の設定。npm test で実行する。
// ※ vite.config.js(ビルド用)とは分けている: ビルド用のプラグイン(package.json のバージョン同期など)を
//   テスト実行時に動かさないため。
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/unit/**/*.test.js'],
        environment: 'node',
    },
});
