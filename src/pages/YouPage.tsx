import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Profile } from '../db';
import { BloodTestManager } from '../components/BloodTestManager';
import { ProfileForm } from '../components/ProfileForm';
import { SourcesLink } from '../components/SourcesSheet';
import { todayStr } from '../lib/date';
import {
  bmi,
  bmiCategory,
  daysUntil,
  minIntakeKcal,
  profileBmr,
  requiredDailyKcal,
  safeRequiredForDay,
  tdee,
  totalKcalToGoal,
} from '../lib/calc';

export function YouPage({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [targetWeight, setTargetWeight] = useState(
    profile.targetWeightKg != null ? String(profile.targetWeightKg) : '',
  );
  const [targetFat, setTargetFat] = useState(
    profile.targetFatPct != null ? String(profile.targetFatPct) : '',
  );
  const [targetWaist, setTargetWaist] = useState(
    profile.targetWaistCm != null ? String(profile.targetWaistCm) : '',
  );
  const [targetDate, setTargetDate] = useState(profile.targetDate ?? '');

  // プロフィール切替時にフォームを同期
  useEffect(() => {
    setTargetWeight(profile.targetWeightKg != null ? String(profile.targetWeightKg) : '');
    setTargetFat(profile.targetFatPct != null ? String(profile.targetFatPct) : '');
    setTargetWaist(profile.targetWaistCm != null ? String(profile.targetWaistCm) : '');
    setTargetDate(profile.targetDate ?? '');
    setEditing(false);
  }, [
    profile.id,
    profile.targetWeightKg,
    profile.targetFatPct,
    profile.targetWaistCm,
    profile.targetDate,
  ]);

  const latest = useLiveQuery(
    async () => {
      const rows = await db.weights.where('profileId').equals(profile.id).toArray();
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const metrics = await db.healthMetrics.where('profileId').equals(profile.id).toArray();
      metrics.sort((a, b) => a.date.localeCompare(b.date));
      return {
        weight: rows.at(-1),
        fatPct: rows.findLast((r) => r.bodyFatPct != null)?.bodyFatPct,
        waist: metrics.findLast((m) => m.waist != null)?.waist,
      };
    },
    [profile.id],
  );

  const weightKg = latest?.weight?.kg;

  // 身長・生年月日・性別は任意入力。欠けている推定値は「—」で伏せる
  const bmiValue =
    weightKg != null && profile.heightCm != null ? bmi(weightKg, profile.heightCm) : undefined;
  const bmrValue = weightKg != null ? profileBmr(profile, weightKg) : undefined;
  const tdeeValue = bmrValue != null ? tdee(bmrValue, profile.activityLevel) : undefined;

  const targetKg = Number(targetWeight);
  const hasGoal = targetKg > 0 && targetDate !== '' && weightKg != null;
  const totalKcal = hasGoal ? totalKcalToGoal(weightKg, targetKg) : undefined;
  const remainDays = hasGoal ? daysUntil(targetDate) : undefined;
  const rawDailyKcal =
    totalKcal != null && remainDays != null ? requiredDailyKcal(totalKcal, remainDays) : undefined;
  // 逆算をそのまま出すと、達成日が近いほど食事量が極端に少ない目安になる。
  // 「きょうの処方箋」と同じ下限で頭打ちにし、頭打ちにしたことをこの場で伝える。
  // 基礎代謝が推定できず頭打ちできないときは、生の逆算値に落とさず「—」にする
  const safeDaily = safeRequiredForDay(rawDailyKcal, bmrValue);
  const dailyKcal = safeDaily?.value;

  // 目標体重がBMI18.5(低体重)を下回らないか。身長が未入力なら判定しない
  const targetBmi =
    targetKg > 0 && profile.heightCm != null ? bmi(targetKg, profile.heightCm) : undefined;
  const targetUnderweight = targetBmi != null && targetBmi < 18.5;

  const [goalSaved, setGoalSaved] = useState(false);

  async function saveGoal() {
    const fat = Number(targetFat);
    const waist = Number(targetWaist);
    await db.profiles.update(profile.id, {
      targetWeightKg: targetKg > 0 ? targetKg : undefined,
      targetFatPct: fat > 0 ? fat : undefined,
      targetWaistCm: waist > 0 ? waist : undefined,
      targetDate: targetDate || undefined,
    });
    setGoalSaved(true);
    setTimeout(() => setGoalSaved(false), 1500);
  }

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h2>{profile.name ? `${profile.name} さんの現在` : '現在の記録'}</h2>
          <button className="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? '閉じる' : '編集'}
          </button>
        </div>
        {editing && (
          <div style={{ marginBottom: 12 }}>
            <ProfileForm profile={profile} onSaved={() => setEditing(false)} />
          </div>
        )}
        <div className="stat-grid">
          <div className="stat">
            <div className="label">身長</div>
            <div className="value">
              {profile.heightCm != null ? profile.heightCm : '未設定'}
              {profile.heightCm != null && <small> cm</small>}
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
            <div className="label">腹囲(最新の記録)</div>
            <div className="value">
              {latest?.waist != null ? latest.waist.toFixed(1) : '未記録'}
              {latest?.waist != null && <small> cm</small>}
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
        {weightKg == null && (
          <p className="muted">「きょう」タブで体重を入力するとBMIなどが表示されます。</p>
        )}
        {weightKg != null && (bmiValue == null || tdeeValue == null) && (
          <p className="muted">
            BMIには身長、推定消費カロリーには身長・生年月日・性別が必要です。
            いずれも任意で、「編集」からいつでも入力・削除できます。入力しなくても記録機能はすべて使えます。
          </p>
        )}
        {/* BMIの判定も推定消費カロリーも医学的な計算なので、数字のすぐ下から出典に行けるようにする */}
        <p className="source-link" style={{ marginBottom: 0 }}>
          BMIの判定は日本肥満学会の肥満度分類、推定消費カロリーはMifflin-St
          Jeor式による推定です。
          <SourcesLink focus="bmi" label="出典を見る" />
        </p>
      </div>

      <div className="card">
        <h2>目標</h2>
        <div className="row">
          <label className="field">
            体重(kg)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
            />
          </label>
          <label className="field">
            体脂肪率(%)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              max="80"
              value={targetFat}
              onChange={(e) => setTargetFat(e.target.value)}
            />
          </label>
          <label className="field">
            腹囲(cm)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              value={targetWaist}
              onChange={(e) => setTargetWaist(e.target.value)}
            />
          </label>
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field field-fixed-date">
            達成日
            {/* 過去の日付は「残り0日」となり逆算が破綻するので、今日より前は選ばせない */}
            <input
              type="date"
              min={todayStr()}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
          <button style={{ flex: '0 0 auto', marginBottom: 8 }} onClick={() => void saveGoal()}>
            {goalSaved ? '保存しました ✓' : '目標を保存'}
          </button>
        </div>

        {hasGoal && totalKcal != null && remainDays != null && dailyKcal != null && (
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="label">目標までの体重差</div>
              <div className="value">
                {(weightKg - targetKg).toFixed(1)}
                <small> kg</small>
              </div>
            </div>
            {latest?.fatPct != null && Number(targetFat) > 0 && (
              <div className="stat">
                <div className="label">目標までの体脂肪率差</div>
                <div className="value">
                  {(latest.fatPct - Number(targetFat)).toFixed(1)}
                  <small> %</small>
                </div>
              </div>
            )}
            {latest?.waist != null && Number(targetWaist) > 0 && (
              <div className="stat">
                <div className="label">目標までの腹囲差</div>
                <div className="value">
                  {(latest.waist - Number(targetWaist)).toFixed(1)}
                  <small> cm</small>
                </div>
              </div>
            )}
            <div className="stat">
              <div className="label">必要な総消費カロリー(×7,000)</div>
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
                {dailyKcal != null && Number.isFinite(dailyKcal)
                  ? Math.round(dailyKcal).toLocaleString()
                  : '—'}
                <small> kcal/日</small>
              </div>
            </div>
          </div>
        )}
        {hasGoal && totalKcal != null && (
          <p className="muted" style={{ marginBottom: 0 }}>
            必要1日消費カロリーは、運動を増やすことでも摂取カロリーを抑えることでも達成できます。
            日々の達成状況は「ふりかえり」タブの消費・貯金で確認できます。
          </p>
        )}
        {/* 頭打ちにできない数字は出さない。何を入れれば出るのかだけを伝える */}
        {hasGoal && totalKcal != null && dailyKcal == null && (
          <p className="muted note" style={{ marginBottom: 0 }}>
            ※必要1日消費カロリーは、勧める食事量が安全な下限を下回らないか確かめてから表示します。
            その確認には推定基礎代謝量が要るため、上の「編集」から身長・生年月日・性別
            (いずれも任意)を入力すると計算されます。
          </p>
        )}
        {/* 無理な目標を黙って受け取らない。保存は妨げず、何が起きるかを伝える */}
        {safeDaily?.capped && bmrValue != null && (
          <p className="goal-warning">
            この達成日を守ろうとすると、1日の食事量が
            {Math.round(minIntakeKcal(bmrValue)).toLocaleString()}kcalを下回ってしまいます。
            アプリが出す目安は食事量がそこを下回らないところで止めているため、
            この目標のままでは達成日に届きません。達成日を延ばすか、目標体重を見直してください。
            減量の進め方は医師にご相談ください。
            <SourcesLink focus="intakeFloor" label="下限の考え方と出典" />
          </p>
        )}
        {targetUnderweight && (
          <p className="goal-warning">
            この目標体重はBMI{targetBmi?.toFixed(1)}で、低体重(18.5未満)にあたります。
            設定はできますが、健康を損なうおそれがあります。医師にご相談ください。
            <SourcesLink focus="bmi" label="BMIの判定基準と出典" />
          </p>
        )}
        {hasGoal && totalKcal != null && (
          <p className="source-link">
            体重1kgあたり7,000kcalとして逆算しています。減量・食事制限は体調や持病に応じて
            医師にご相談のうえ行ってください。
            <SourcesLink focus="fatKcal" label="出典を見る" />
          </p>
        )}
        {hasGoal && remainDays === 0 && totalKcal != null && totalKcal > 0 && (
          <p className="muted">目標日を過ぎています。目標達成日を更新してください。</p>
        )}
      </div>

      <BloodTestManager profileId={profile.id} />
    </div>
  );
}
