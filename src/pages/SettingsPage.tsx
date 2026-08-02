import { useState } from 'react';
import { db, type Profile } from '../db';
import { HealthSyncSettings } from '../components/HealthSyncSettings';
import { LegalLink } from '../components/LegalLink';
import { MedicationSettings } from '../components/MedicationSettings';
import { NotificationSettings } from '../components/NotificationSettings';
import { ProBadge, ProLock, ProSheet } from '../components/ProGate';
import { UsageGuide } from '../components/UsageGuide';
import { usePro } from '../lib/pro';

/** 記録そのものではなく、アプリの振る舞いを決める設定をまとめたタブ */
export function SettingsPage({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <ProCard />

      <div className="card">
        <h2>
          検査値の記録
          <ProBadge />
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          オンにした項目だけ「きょう」タブに入力欄が出て、「ふりかえり」タブで推移を確認できます。
        </p>
        {/* オンにしても書けないのでは戸惑わせる。スイッチごとProの側に置く */}
        <ProLock label="血圧・血糖値の記録はProの機能です">
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
        </ProLock>
      </div>

      <MedicationSettings profile={profile} />

      <HealthSyncSettings profile={profile} />

      <NotificationSettings profile={profile} />

      <div className="card">
        <h2>使い方</h2>
        {open ? (
          <>
            <UsageGuide />
            <button className="ghost" onClick={() => setOpen(false)}>
              ▲ 閉じる
            </button>
          </>
        ) : (
          <button className="ghost" onClick={() => setOpen(true)}>
            ▼ 各タブの使い方を読む
          </button>
        )}
      </div>

      {/* 規約類は記録の邪魔にならないよう、アプリの設定と同じ場所にまとめる */}
      <div className="card">
        <h2>このアプリについて</h2>
        <p className="legal-links" style={{ marginBottom: 0 }}>
          <LegalLink doc="privacy" />
          ・
          <LegalLink doc="terms" />
        </p>
      </div>
    </div>
  );
}

/**
 * Proの状態と、購入・復元の入口。
 * 復元はApp Storeの審査で必須なので、買ったあとも消さずに残す
 * (機種変更したときに、ここから引き継げないと詰んでしまう)
 */
function ProCard() {
  const { isPro, price, storefront, busy, restore, error } = usePro();
  const [sheet, setSheet] = useState(false);

  return (
    <div className="card">
      <h2>SelfCareNote Pro</h2>
      {isPro ? (
        <p className="muted" style={{ marginTop: 0 }}>
          購入済みです。血液検査と検査値(血圧・血糖値)の記録がお使いいただけます。
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>
          血液検査と検査値(血圧・血糖値)を記録できるようになる、買い切りの追加機能です。
          {price != null && `${price}(買い切り)。`}
        </p>
      )}
      <div className="row">
        {!isPro && (
          <button onClick={() => setSheet(true)} style={{ flex: '0 0 auto' }}>
            くわしく見る
          </button>
        )}
        <button
          className="secondary"
          onClick={() => void restore()}
          disabled={busy}
          style={{ flex: '0 0 auto' }}
        >
          購入を復元
        </button>
      </div>
      {error && <p className="pro-error">{error}</p>}
      {/* 切り分け用(一時): 通貨がおかしいときにStoreKitがどの国のストアを
          見ているか確かめる。原因が分かったらこの3行を消す */}
      {storefront != null && (
        <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>
          ストアフロント: {storefront} / 価格: {price ?? '取得できず'}
        </p>
      )}
      {sheet && <ProSheet onClose={() => setSheet(false)} />}
    </div>
  );
}
