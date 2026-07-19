import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { User } from 'firebase/auth';
import { db } from '../db';
import { isFirebaseConfigured, signInWithGoogle, signOutUser, watchAuth } from '../lib/firebase';
import { parseSyncInfo, syncNow } from '../lib/sync';

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

export function SyncCard() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void watchAuth(setUser).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const info = useLiveQuery(
    async () => parseSyncInfo((await db.settings.get('syncInfo'))?.value),
    [],
  );

  if (!isFirebaseConfigured) return null;

  async function handleLogin() {
    setError(undefined);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    try {
      await syncNow();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>クラウド同期</h2>
      {!user ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            ログインすると記録がクラウドに保存され、機種変更や複数端末でも
            同じ手帳を使えます。
          </p>
          <button onClick={() => void handleLogin()} disabled={busy}>
            Googleでログイン
          </button>
        </>
      ) : (
        <>
          <div className="list-item">
            <span className="muted">アカウント</span>
            <span>{user.email ?? user.displayName ?? 'ログイン中'}</span>
          </div>
          <div className="list-item">
            <span className="muted">最終同期</span>
            <span>
              {info ? (
                <>
                  {formatTime(info.at)}
                  {info.error ? (
                    <span style={{ color: 'var(--danger)' }}> (失敗)</span>
                  ) : (
                    ' ✓'
                  )}
                </>
              ) : (
                '未同期'
              )}
            </span>
          </div>
          {info?.error && (
            <p className="muted" style={{ color: 'var(--danger)' }}>
              {info.error}
            </p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={() => void handleSync()} disabled={busy}>
              {busy ? '同期中…' : '今すぐ同期'}
            </button>
            <button className="secondary" onClick={() => void signOutUser()} disabled={busy}>
              ログアウト
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="muted" style={{ color: 'var(--danger)', marginBottom: 0 }}>
          ログインに失敗しました: {error}
        </p>
      )}
    </div>
  );
}
