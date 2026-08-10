import { useLiveQuery } from 'dexie-react-hooks';
import { type Profile } from '../db';
import { daysUntil, requiredDailyKcal, safeRequiredForDay, totalKcalToGoal } from '../lib/calc';
import { getRecentDayStats } from '../lib/dailyStats';
import { todayStr } from '../lib/date';
import { calcStreak } from '../lib/streak';
import { SourcesLink } from './SourcesSheet';

const WINDOW_DAYS = 7;

/** 目標進捗リング(案3由来のUIを手帳トーンで) */
function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 41;
  const circumference = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`きょうの貯金 ${Math.round(clamped)}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="47" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--text)">
        {Math.round(clamped)}%
      </text>
      <text x="50" y="63" textAnchor="middle" fontSize="8.5" fill="var(--muted)">
        きょうの貯金
      </text>
    </svg>
  );
}

export function StreakSummary({ profile }: { profile: Profile }) {
  const recent = useLiveQuery(
    () => getRecentDayStats(profile, WINDOW_DAYS),
    [profile.id, profile.heightCm, profile.sex, profile.birthDate],
  );

  if (!recent) return null;

  const { days, weightDates } = recent;
  const streak = calcStreak(weightDates, todayStr());

  const recordedWeights = days.filter((d) => d.weight != null);
  const weightChange =
    recordedWeights.length >= 2
      ? recordedWeights.at(-1)!.weight! - recordedWeights[0].weight!
      : undefined;

  const deficits = days.filter((d): d is typeof d & { deficit: number } => d.deficit != null);
  const totalSavings = deficits.reduce((s, d) => s + d.deficit, 0);
  const todayDeficit = days.at(-1)?.deficit;

  const latestWeight = recordedWeights.at(-1)?.weight;
  const rawRequired =
    profile.targetWeightKg != null && profile.targetDate && latestWeight != null
      ? requiredDailyKcal(
          totalKcalToGoal(latestWeight, profile.targetWeightKg),
          daysUntil(profile.targetDate),
        )
      : undefined;
  // 「きょうの処方箋」と同じ日・同じ活動量で頭打ちにする。
  // ここだけ生の逆算値を出すと、同じタブの上下で目標が食い違って見える
  const today = days.at(-1);
  const safe = safeRequiredForDay(rawRequired, today?.bmr, today?.burn);
  const required = safe?.value;
  const showRequired = required != null && required > 0;
  // 達成日数も、画面に出している目標(頭打ち後)と同じ数字で数える
  const achievedDays = showRequired ? deficits.filter((d) => d.deficit >= required).length : undefined;

  if (streak.count === 0 && recordedWeights.length === 0) return null;

  const percent = showRequired && todayDeficit != null ? (todayDeficit / required) * 100 : undefined;
  const hasGoal = profile.targetWeightKg != null && !!profile.targetDate;
  const message = !showRequired
    ? !hasGoal
      ? '「あなた」タブで目標を設定すると進捗が見えます'
      : latestWeight == null
        ? '体重を記録すると目標の進捗が見えます'
        : '「あなた」タブで身長・生年月日・性別(任意)を入れると目標の進捗が見えます'
    : todayDeficit == null
      ? '食事と体重を記録すると貯金が見えます'
      : todayDeficit >= required
        ? 'きょうの目標を達成しました!'
        : `目標まであと ${Math.round(required - todayDeficit).toLocaleString()} kcal`;

  return (
    <div className="card">
      <div className="journal-hero">
        {percent != null && <ProgressRing percent={percent} />}
        <div className="journal-hero-info">
          {showRequired && todayDeficit != null && (
            <div className="big">
              {Math.round(todayDeficit).toLocaleString()}
              <small> / {Math.round(required).toLocaleString()} kcal</small>
            </div>
          )}
          <div className="muted">{message}</div>
          {!streak.recordedToday && streak.count > 0 && (
            <div className="muted">きょうの体重を記録してスタンプを続けましょう</div>
          )}
        </div>
        <div className="stamp" aria-label={`連続${streak.count}日記録中`}>
          <b>{streak.count}</b>
          <span>日連続</span>
        </div>
      </div>
      <div className="journal-lines">
        <div className="list-item">
          <span className="muted">直近7日の体重変化</span>
          {weightChange != null ? (
            <strong style={{ color: weightChange <= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {weightChange > 0 ? '+' : ''}
              {weightChange.toFixed(1)} kg
            </strong>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
        <div className="list-item">
          <span className="muted">7日間の貯金合計</span>
          {deficits.length > 0 ? (
            <strong>{Math.round(totalSavings).toLocaleString()} kcal</strong>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
        {showRequired && (
          <div className="list-item">
            <span className="muted">目標を達成できた日</span>
            <strong>
              {achievedDays} / {deficits.length}日
            </strong>
          </div>
        )}
      </div>
      {/* 頭打ちにした数字を黙って出さない。「きょうの処方箋」と同じ理由を同じ言葉で伝える */}
      {safe?.capped && (
        <p className="muted note" style={{ marginBottom: 0 }}>
          ※この目標を達成日までに実現しようとすると、1日の食事量が安全な下限を下回ってしまいます。
          上の目標は、食事量がそこを下回らないところで止めた数字です。
          達成日を延ばすか目標体重を見直すことをおすすめします。減量の進め方は医師にご相談ください。
          <SourcesLink focus="intakeFloor" label="下限の考え方と出典" />
        </p>
      )}
      {/* 貯金という推定値を出しているカードなので、出典と医師相談は条件を付けずに置く(1.4.1) */}
      <p className="source-link" style={{ marginBottom: 0 }}>
        「貯金」は 基礎代謝×1.2 + 歩数・運動の推定消費 − 摂取カロリー で求めた推定値です。
        減量の進め方は、体調や持病に応じて医師にご相談ください。
        <SourcesLink focus="fatKcal" label="出典を見る" />
      </p>
    </div>
  );
}
