import { useState } from 'react';
import { db, type Profile } from '../db';
import { MedicationManager } from './MedicationManager';

/**
 * 服薬管理を使うかどうかと、お薬の登録・編集。
 * どちらも毎日触るものではないので、「きょう」の食事カードではなく設定に置く。
 * 日々のチェックだけが「きょう」タブに残る。
 */
export function MedicationSettings({ profile }: { profile: Profile }) {
  const on = profile.useMedication ?? false;
  const [showManager, setShowManager] = useState(false);

  async function toggle(checked: boolean) {
    await db.profiles.update(profile.id, { useMedication: checked });
    if (!checked) setShowManager(false);
  }

  return (
    <div className="card">
      <h2>お薬</h2>
      <label className="checkbox-inline">
        <input type="checkbox" checked={on} onChange={(e) => void toggle(e.target.checked)} />
        💊 服薬を記録する
      </label>
      <p className="muted" style={{ marginBottom: 0 }}>
        オンにすると「きょう」タブの食事ごとに、お薬のチェック欄が出ます。
      </p>
      {on && (
        <>
          <button
            className={`ghost menu-toggle ${showManager ? 'active' : ''}`}
            onClick={() => setShowManager((v) => !v)}
          >
            💊 お薬を登録・編集する
          </button>
          {showManager && <MedicationManager profileId={profile.id} />}
        </>
      )}
    </div>
  );
}
