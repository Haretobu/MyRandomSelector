import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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