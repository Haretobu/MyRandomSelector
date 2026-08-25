import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import react from '@vitejs/plugin-react';

// public/sw.js の APP_VERSION を唯一の情報源とする。
// バージョンを上げたいときは public/sw.js の APP_VERSION だけを書き換えればよい。
const swPath = resolve(__dirname, 'public/sw.js');
const swContent = readFileSync(swPath, 'utf-8');
const versionMatch = swContent.match(/const APP_VERSION = '([^']+)';/);
const APP_VERSION = versionMatch ? versionMatch[1] : 'v0.0.0';

// package.jsonの"version"を、public/sw.jsのAPP_VERSIONに同期するプラグイン
// （npm等のツールとの整合性のためであり、編集の起点はあくまでsw.js）
const syncPackageVersionFromServiceWorker = () => ({
  name: 'sync-package-version-from-sw',
  buildStart() {
    const pkgPath = resolve(__dirname, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const bareVersion = APP_VERSION.replace(/^v/, '');
    if (pkg.version !== bareVersion) {
      pkg.version = bareVersion;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    }
  },
});

export default defineConfig({
  plugins: [react(), syncPackageVersionFromServiceWorker()],
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