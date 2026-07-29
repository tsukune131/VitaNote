import { useEffect, useState } from 'react';
import {
  db,
  DEFAULT_WAIST_NOTIFY_WEEKDAY,
  DEFAULT_WEIGHT_NOTIFY_TIMES,
  type Profile,
} from '../db';
import { WEEKDAY_LABELS } from '../lib/date';
import { ensureNotificationPermission, MAX_WEIGHT_NOTIFY_TIMES } from '../lib/notifications';
import { isNativeApp } from '../lib/platform';

/**
 * リマインダー通知の設定。
 * 実際の予約はApp.tsxが設定値の変化を見て貼り直すので、ここは値の保存だけを行う。
 * オンにするときだけ、その場でOSの許可を求める(断られたら画面で知らせる)。
 */
export function NotificationSettings({ profile }: { profile: Profile }) {
  const native = isNativeApp();
  const [denied, setDenied] = useState(false);
  const weightOn = profile.notifyWeight ?? false;
  const weightTimes = profile.notifyWeightTimes ?? DEFAULT_WEIGHT_NOTIFY_TIMES;
  const waistOn = profile.notifyWaist ?? false;
  const waistWeekday = profile.notifyWaistWeekday ?? DEFAULT_WAIST_NOTIFY_WEEKDAY;

  // 端末側で通知を切られていることがあるので、開くたびに確かめる
  useEffect(() => {
    if (!native || !(weightOn || waistOn)) return;
    void ensureNotificationPermission().then((p) => setDenied(p === 'denied'));
  }, [native, weightOn, waistOn]);

  /** オンにするときはその場で許可を求め、断られたら設定は変えずに知らせる */
  async function askIfEnabling(checked: boolean): Promise<boolean> {
    if (!checked || !native) return true;
    const permission = await ensureNotificationPermission();
    setDenied(permission === 'denied');
    return permission !== 'denied';
  }

  async function toggleWeight(checked: boolean) {
    if (!(await askIfEnabling(checked))) return;
    await db.profiles.update(profile.id, {
      notifyWeight: checked,
      notifyWeightTimes: profile.notifyWeightTimes ?? DEFAULT_WEIGHT_NOTIFY_TIMES,
    });
  }

  async function updateWeightTime(i: number, value: string) {
    const next = [...weightTimes];
    next[i] = value;
    await db.profiles.update(profile.id, { notifyWeightTimes: next });
  }

  async function addWeightTime() {
    await db.profiles.update(profile.id, { notifyWeightTimes: [...weightTimes, '12:00'] });
  }

  async function removeWeightTime(i: number) {
    await db.profiles.update(profile.id, {
      notifyWeightTimes: weightTimes.filter((_, idx) => idx !== i),
    });
  }

  async function toggleWaist(checked: boolean) {
    if (!(await askIfEnabling(checked))) return;
    await db.profiles.update(profile.id, {
      notifyWaist: checked,
      notifyWaistWeekday: profile.notifyWaistWeekday ?? DEFAULT_WAIST_NOTIFY_WEEKDAY,
    });
  }

  return (
    <div className="card">
      <h2>リマインダー通知</h2>
      {!native && (
        <p className="muted" style={{ marginTop: 0 }}>
          ここでは設定のみ行えます。実際に通知が届くのはiPhoneのアプリ版からになります。
        </p>
      )}
      {denied && (
        <p className="muted" style={{ marginTop: 0 }}>
          通知が許可されていません。iPhoneの「設定」→「通知」→「VitaNote」から許可してください。
        </p>
      )}

      <label className="checkbox-inline" style={{ marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={weightOn}
          onChange={(e) => void toggleWeight(e.target.checked)}
        />
        体重の記録を知らせる
      </label>
      {weightOn && (
        <div style={{ marginBottom: 12 }}>
          {weightTimes.map((t, i) => (
            <div key={i}>
              <div className="row" style={{ alignItems: 'flex-end', marginBottom: 2 }}>
                <label className="field field-fixed-time" style={{ marginBottom: 0 }}>
                  {`${i + 1}件目`}
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => void updateWeightTime(i, e.target.value)}
                  />
                </label>
                {weightTimes.length > 1 && (
                  <button
                    className="ghost"
                    onClick={() => void removeWeightTime(i)}
                    style={{ flex: '0 0 auto' }}
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className="muted" style={{ margin: '0 0 8px' }}>
            その日の体重を入力済みなら届きません
          </p>
          {weightTimes.length < MAX_WEIGHT_NOTIFY_TIMES && (
            <button className="secondary" onClick={() => void addWeightTime()}>
              + 時刻を追加
            </button>
          )}
        </div>
      )}

      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={waistOn}
          onChange={(e) => void toggleWaist(e.target.checked)}
        />
        腹囲の記録を知らせる(週1回)
      </label>
      {waistOn && (
        <label className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          通知曜日(9:00)
          <select
            value={waistWeekday}
            onChange={(e) =>
              void db.profiles.update(profile.id, {
                notifyWaistWeekday: Number(e.target.value),
              })
            }
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                毎週{label}曜日
              </option>
            ))}
          </select>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            直前の1週間に腹囲を入力済みなら届きません
          </p>
        </label>
      )}
      {waistOn && (
        <p className="muted" style={{ marginBottom: 0 }}>
          指定した曜日の朝9時にお知らせします。
        </p>
      )}
    </div>
  );
}
