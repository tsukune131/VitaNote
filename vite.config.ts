import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages (https://<user>.github.io/WeightNote/) のサブパス配信用
  base: '/WeightNote/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '体重管理',
        short_name: '体重管理',
        description: '体重・食事・飲水・歩数を記録して目標達成を管理するアプリ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#2563eb',
        background_color: '#f4f6fa',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
