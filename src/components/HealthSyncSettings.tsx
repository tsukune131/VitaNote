import { useEffect, useState } from 'react';
import { db, type Profile } from '../db';
import { importStepsFromHealth, isHealthAvailable, requestHealthAccess } from '../lib/health';

/**
 * ヘルスケア(HealthKit)連携の設定。
 * iOSのアプリ版でしか使えないため、それ以外の環境では案内だけを出す。
 */
export function HealthSyncSettings({ profile }: { profile: Profile }) {
  const [available, setAvailable] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const on = profile.syncHealth ?? false;

  useEffect(() => {
    void isHealthAvailable().then(setAvailable);
  }, []);

  async function toggle(checked: boolean) {
    if (!checked) {
      await db.profiles.update(profile.id, { syncHealth: false });
      setMessage(undefined);
      return;
    }

    setBusy(true);
    try {
      // 許可シートを出してから、その場で一度取り込んで結果を見せる
      const asked = await requestHealthAccess();
      if (!asked) {
        setMessage('ヘルスケアに接続できませんでした。');
        return;
      }
      await db.profiles.update(profile.id, { syncHealth: true });
      const days = await importStepsFromHealth(profile.id);
      setMessage(
        days > 0
          ? `${days}日ぶんの歩数を取り込みました。`
          : '歩数を取り込めませんでした。iPhoneの「設定」→「アプリ」→「ヘルスケア」でVitaNoteの歩数の読み取りが許可されているか確認してください。',
      );
    } finally {
      setBusy(false);
    }
  }

  if (available === undefined) return null; // 判定中

  return (
    <div className="card">
      <h2>ヘルスケア連携</h2>
      {available ? (
        <>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={on}
              disabled={busy}
              onChange={(e) => void toggle(e.target.checked)}
            />
            iPhoneのヘルスケアと連携する
          </label>
          <p className="muted" style={{ marginBottom: 0 }}>
            歩数を自動で取り込み(時間帯別も)、記録した体重・体脂肪率をヘルスケアへ書き戻します。
            歩数の転記が要らなくなります。
          </p>
          {message && (
            <p className="muted" style={{ marginBottom: 0 }}>
              {message}
            </p>
          )}
        </>
      ) : (
        <p className="muted" style={{ marginBottom: 0 }}>
          ヘルスケアとの連携はiPhoneのアプリ版でご利用いただけます。
        </p>
      )}
    </div>
  );
}
