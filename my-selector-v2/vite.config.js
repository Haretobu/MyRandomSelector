import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import react from '@vitejs/plugin-react';

// package.jsonの"version"を唯一の情報源とする。
// バージョンを上げたいときはpackage.jsonのversionだけを書き換えればよい。
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const APP_VERSION = `v${pkg.version}`;

// public/sw.js は静的ファイルとしてそのまま配信されるため、Viteのdefineでは中身を書き換えられない。
// ビルド・開発サーバー起動のたびに、sw.js内のAPP_VERSION定数をpackage.jsonの値へ同期する。
const syncAppVersionToServiceWorker = () => ({
  name: 'sync-app-version-to-sw',
  buildStart() {
    const swPath = resolve(__dirname, 'public/sw.js');
    const content = readFileSync(swPath, 'utf-8');
    const updated = content.replace(
      /const APP_VERSION = '[^']*';/,
      `const APP_VERSION = '${APP_VERSION}';`
    );
    if (updated !== content) {
      writeFileSync(swPath, updated, 'utf-8');
    }
  },
});

export default defineConfig({
  plugins: [react(), syncAppVersionToServiceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        price: resolve(__dirname, 'price_comparison.html'),
        bms: resolve(__dirname, 'bms.html'), // ★ここを追加！
      },
    },
  },
});