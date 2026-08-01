import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { hideSplash } from './lib/nativeUi';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 描画が一巡してからスプラッシュを閉じる(先に閉じると白い画面が一瞬見える)
requestAnimationFrame(() => void hideSplash());
