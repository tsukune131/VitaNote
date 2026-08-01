import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// 配信先はiOSアプリ(WKWebView)だけ。相対パスで出す。
//
// 以前はGitHub Pagesのサブパス配信を兼ねていて `base: '/VitaNote/'` だったが、
// その出力をWKWebViewから読むと全アセットが404になり真っ白になる。
// ブラウザ版をやめた今、絶対パスに戻す理由はない(2026-08-01)。
export default defineConfig({
  base: './',
  plugins: [react()],
});
