import { useEffect, useState } from 'react';
import { db, type Profile } from '../db';
import {
  checkHealthAvailability,
  importStepsFromHealth,
  requestHealthAccess,
  type HealthAvailability,
} from '../lib/health';

/**
 * ヘルスケア(HealthKit)連携の設定。
 * iOSのアプリ版でしか使えないため、それ以外の環境では案内だけを出す。
 * 実機でしか再現しない不具合を画面から追えるよう、使えないときは理由も出す。
 */
export function HealthSyncSettings({ profile }: { profile: Profile }) {
  const [status, setStatus] = useState<HealthAvailability | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  // 既定でオン。オフにしたときだけfalseが入る
  const on = profile.syncHealth ?? true;

  useEffect(() => {
    void checkHealthAvailability().then(setStatus);
  }, []);

  /** 許可を求めてから取り込み、結果を出す。オンにしたときと「今すぐ取り込む」で共用 */
  async function connectAndImport() {
    setBusy(true);
    try {
      // 一度応答した項目についてOSは許可シートを出し直さないので、
      // 出てこないときは端末の設定から直してもらう
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
          : '歩数を取り込めませんでした。iPhoneの「設定」→「プライバシーとセキュリティ」→「ヘルスケア」→「VitaNote」で、歩数の読み取りが許可されているか確認してください。',
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(checked: boolean) {
    if (!checked) {
      await db.profiles.update(profile.id, { syncHealth: false });
      setMessage(undefined);
      return;
    }
    await connectAndImport();
  }

  return (
    <div className="card">
      <h2>ヘルスケア連携</h2>
      {status === undefined ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          確認中…
        </p>
      ) : status.available ? (
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
          {on && (
            <button
              className="secondary"
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={() => void connectAndImport()}
            >
              今すぐ取り込む
            </button>
          )}
          {message && (
            <p className="muted" style={{ marginBottom: 0 }}>
              {message}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 0 }}>
            ヘルスケアとの連携はiPhoneのアプリ版でご利用いただけます。
          </p>
          {status.reason && (
            <p className="muted" style={{ marginBottom: 0, fontSize: 12 }}>
              ({status.reason})
            </p>
          )}
        </>
      )}
    </div>
  );
}
