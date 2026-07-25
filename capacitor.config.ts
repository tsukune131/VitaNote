import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tsukune.vitanote',
  appName: 'VitaNote',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // 描画が済んだらJS側から閉じる(白い画面を挟まないため)。
      // ただし自動非表示は切らない。JSが動かなかったときに
      // スプラッシュが出たまま戻らなくなるのを避けるための保険
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#f5f5f0',
    },
  },
};

export default config;
