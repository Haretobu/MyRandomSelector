import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        price: resolve(__dirname, 'price_comparison.html'), // 価格比較ページも忘れずに！
      },
    },
  },
});