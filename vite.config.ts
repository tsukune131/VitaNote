import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

// mode 'capacitor' はネイティブアプリ用ビルド:
// 相対パス配信+Service Worker(PWA)なし。通常はGitHub Pagesのサブパス配信
export default defineConfig(({ mode }) => ({
  base: mode === 'capacitor' ? './' : '/VitaNote/',
  plugins: [
    react(),
    ...(mode === 'capacitor'
      ? []
      : [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'VitaNote',
        short_name: 'VitaNote',
        description: '体重・血圧・血糖値・服薬などを毎日書き込む健康手帳アプリ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#f5f5f0',
        background_color: '#f5f5f0',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
        ]),
  ],
}));
