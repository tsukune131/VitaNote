import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initSync } from './lib/sync';
import './index.css';

// エラー監視(SentryのDSNが設定されているときだけ有効。未設定なら何も読み込まない)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn: sentryDsn, sendDefaultPii: false });
  });
}

initSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
