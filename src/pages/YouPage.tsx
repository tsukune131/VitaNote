import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteProfile, setActiveProfileId, type Profile } from '../db';
import { ProfileForm } from '../components/ProfileForm';
import {
  ACTIVITY_LEVELS,
  ageAt,
  bmi,
  bmiCategory,
  bmr,
  daysUntil,
  requiredDailyKcal,
  tdee,
  totalKcalToGoal,
} from '../lib/calc';
import { exportAllData, importAllData } from '../lib/backup';

export function YouPage({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [targetWeight, setTargetWeight] = useState(
    profile.targetWeightKg != null ? String(profile.targetWeightKg) : '',
  );
  const [targetDate, setTargetDate] = useState(profile.targetDate ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  // プロフィール切替時にフォームを同期
  useEffect(() => {
    setTargetWeight(profile.targetWeightKg != null ? String(profile.targetWeightKg) : '');
    setTargetDate(profile.targetDate ?? '');
    setEditing(false);
    setAdding(false);
  }, [profile.id, profile.targetWeightKg, profile.targetDate]);

  const latest = useLiveQuery(
    async () => {
      const rows = await db.weights.where('profileId').equals(profile.id).toArray();
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return {
        weight: rows.at(-1),
        fatPct: rows.findLast((r) => r.bodyFatPct != null)?.bodyFatPct,
      };
    },
    [profile.id],
  );

  const weightKg = latest?.weight?.kg;
  const age = ageAt(profile.birthDate);
  const activityLabel =
    ACTIVITY_LEVELS.find((a) => a.value === profile.activityLevel)?.label ??
    `係数 ${profile.activityLevel}`;

  const bmiValue = weightKg != null ? bmi(weightKg, profile.heightCm) : undefined;
  const tdeeValue =
    weightKg != null
      ? tdee(bmr(weightKg, profile.heightCm, age, profile.sex), profile.activityLevel)
      : undefined;

  const targetKg = Number(targetWeight);
  const hasGoal = targetKg > 0 && targetDate !== '' && weightKg != null;
  const totalKcal = hasGoal ? totalKcalToGoal(weightKg, targetKg) : undefined;
  const remainDays = hasGoal ? daysUntil(targetDate) : undefined;
  const dailyKcal =
    totalKcal != null && remainDays != null ? requiredDailyKcal(totalKcal, remainDays) : undefined;

  async function saveGoal() {
    await db.profiles.update(profile.id, {
      targetWeightKg: targetKg > 0 ? targetKg : undefined,
      targetDate: targetDate || undefined,
    });
  }

  async function handleDelete() {
    if (!confirm(`プロフィール「${profile.name}」とその記録をすべて削除します。よろしいですか?`))
      return;
    await deleteProfile(profile.id);
  }

  async function handleImport(file: File) {
    if (!confirm('現在の全データをインポート内容で置き換えます。よろしいですか?')) return;
    try {
      await importAllData(file);
      alert('インポートが完了しました');
    } catch (e) {
      alert(`インポートに失敗しました: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>{profile.name} さんの現在</h2>
        <div className="stat-grid">
          <div className="stat">
            <div className="label">身長</div>
            <div className="value">
              {profile.heightCm}
              <small> cm</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">体重(最新の記録)</div>
            <div className="value">
              {weightKg != null ? weightKg.toFixed(1) : '未記録'}
              {weightKg != null && <small> kg</small>}
            </div>
          </div>
          <div className="stat">
            <div className="label">体脂肪率(最新の記録)</div>
            <div className="value">
              {latest?.fatPct != null ? latest.fatPct.toFixed(1) : '未記録'}
              {latest?.fatPct != null && <small> %</small>}
            </div>
          </div>
          <div className="stat">
            <div className="label">BMI</div>
            <div className="value">
              {bmiValue != null ? bmiValue.toFixed(1) : '—'}
              {bmiValue != null && <small> {bmiCategory(bmiValue)}</small>}
            </div>
          </div>
          <div className="stat">
            <div className="label">推定消費カロリー/日</div>
            <div className="value">
              {tdeeValue != null ? Math.round(tdeeValue) : '—'}
              {tdeeValue != null && <small> kcal</small>}
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          活動レベル: {activityLabel} ・ {age}歳 ・ 推定消費は基礎代謝(Mifflin-St Jeor式)×活動係数
        </p>
        {weightKg == null && (
          <p className="muted">「記録」タブで体重を入力するとBMIなどが表示されます。</p>
        )}
      </div>

      <div className="card">
        <h2>目標</h2>
        <div className="row">
          <label className="field">
            目標体重(kg)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
            />
          </label>
          <label className="field field-fixed-date">
            目標達成日
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
        </div>
        <button onClick={() => void saveGoal()}>目標を保存</button>

        {hasGoal && totalKcal != null && remainDays != null && dailyKcal != null && (
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="label">目標までの体重差</div>
              <div className="value">
                {(weightKg - targetKg).toFixed(1)}
                <small> kg</small>
              </div>
            </div>
            <div className="stat">
              <div className="label">必要な総消費カロリー(×7200)</div>
              <div className="value">
                {Math.round(totalKcal).toLocaleString()}
                <small> kcal</small>
              </div>
            </div>
            <div className="stat">
              <div className="label">達成までの期間</div>
              <div className="value">
                {remainDays}
                <small> 日</small>
              </div>
            </div>
            <div className="stat">
              <div className="label">必要1日消費カロリー</div>
              <div className="value">
                {Number.isFinite(dailyKcal) ? Math.round(dailyKcal).toLocaleString() : '—'}
                <small> kcal/日</small>
              </div>
            </div>
          </div>
        )}
        {hasGoal && totalKcal != null && (
          <p className="muted" style={{ marginBottom: 0 }}>
            必要1日消費カロリーは、運動を増やすことでも摂取カロリーを抑えることでも達成できます。
            日々の達成状況は「推移」タブの消費・貯金で確認できます。
          </p>
        )}
        {hasGoal && remainDays === 0 && totalKcal != null && totalKcal > 0 && (
          <p className="muted">目標日を過ぎています。目標達成日を更新してください。</p>
        )}
      </div>

      <div className="card">
        <h2>プロフィール設定</h2>
        {editing ? (
          <ProfileForm profile={profile} onSaved={() => setEditing(false)} />
        ) : (
          <div className="row">
            <button className="secondary" onClick={() => setEditing(true)}>
              編集
            </button>
            <button className="secondary" onClick={() => setAdding((v) => !v)}>
              家族を追加
            </button>
            <button className="danger" onClick={() => void handleDelete()}>
              削除
            </button>
          </div>
        )}
        {adding && (
          <div style={{ marginTop: 12 }}>
            <h3>新しいプロフィール</h3>
            <ProfileForm
              onSaved={async (id) => {
                await setActiveProfileId(id);
                setAdding(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="card">
        <h2>バックアップ</h2>
        <p className="muted">
          データはこの端末のブラウザ内にのみ保存されます。定期的にエクスポートしてください。
        </p>
        <div className="row">
          <button className="secondary" onClick={() => void exportAllData()}>
            エクスポート
          </button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            インポート
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
