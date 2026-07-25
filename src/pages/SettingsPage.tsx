import { db, type Profile } from '../db';
import { HealthSyncSettings } from '../components/HealthSyncSettings';
import { NotificationSettings } from '../components/NotificationSettings';

/** 記録そのものではなく、アプリの振る舞いを決める設定をまとめたタブ */
export function SettingsPage({ profile }: { profile: Profile }) {
  return (
    <div>
      <div className="card">
        <h2>検査値の記録</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          オンにした項目だけ「きょう」タブに入力欄が出て、「ふりかえり」タブで推移を確認できます。
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(
            [
              ['trackBloodPressure', '血圧'],
              ['trackGlucose', '血糖値'],
            ] as const satisfies readonly (readonly [
              'trackBloodPressure' | 'trackGlucose',
              string,
            ])[]
          ).map(([key, label]) => (
            <label className="checkbox-inline" key={key}>
              <input
                type="checkbox"
                checked={profile[key] ?? false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void db.profiles.update(profile.id, { [key]: checked } as Partial<Profile>);
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <HealthSyncSettings profile={profile} />

      <NotificationSettings profile={profile} />
    </div>
  );
}
