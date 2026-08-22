import {
  db,
  type ExerciseEntry,
  type MealEntry,
  type Profile,
  type StepEntry,
  type WeightEntry,
} from '../db';
import { dailyDeficit, profileBmr, stepsToKcal } from './calc';
import { addDays, todayStr } from './date';

export interface DayStat {
  date: string;
  weight?: number;
  intake?: number;
  /** きょうの歩数(未記録の日はundefined) */
  steps?: number;
  /** 歩数分の消費kcal(体重が分かる日のみ)。burnの内訳として表示用に保持する */
  stepKcal?: number;
  burn: number;
  /** カロリー貯金(消費−摂取)。食事と体重の記録が揃っている日のみ算出 */
  deficit?: number;
  /** 推定基礎代謝量。勧める食事量の下限を決めるのに使う(プロフィールが揃った日のみ) */
  bmr?: number;
  /** 夕食が記録済みか(kcalか時刻のどちらかが入っていれば済み)。その日の決着判定に使う */
  dinnerLogged: boolean;
}

export interface RecentStats {
  days: DayStat[];
  /** このプロフィールで体重を記録した全日付(昇順)。ストリーク計算に使う */
  weightDates: string[];
}

/** 今日を含む直近windowDays日分の記録を集計する */
export async function getRecentDayStats(profile: Profile, windowDays: number): Promise<RecentStats> {
  const today = todayStr();
  const start = addDays(today, -(windowDays - 1));

  const range = <T,>(table: 'weights' | 'meals' | 'steps' | 'exercises') =>
    db
      .table(table)
      .where('[profileId+date]')
      .between([profile.id, start], [profile.id, today], true, true)
      .toArray() as Promise<T[]>;

  const [weights, meals, steps, exercises, allWeights] = await Promise.all([
    range<WeightEntry>('weights'),
    range<MealEntry>('meals'),
    range<StepEntry>('steps'),
    range<ExerciseEntry>('exercises'),
    db.weights.where('profileId').equals(profile.id).toArray(),
  ]);

  const sortedWeights = [...allWeights].sort((a, b) => a.date.localeCompare(b.date));

  const days: DayStat[] = [];
  for (let i = 0; i < windowDays; i++) {
    const date = addDays(start, i);
    const w = weights.find((x) => x.date === date);
    const meal = meals.find((x) => x.date === date);
    const step = steps.find((x) => x.date === date);
    const exs = exercises.filter((x) => x.date === date);

    const refWeight =
      w?.kg ?? sortedWeights.filter((x) => x.date <= date).at(-1)?.kg ?? sortedWeights.at(-1)?.kg;

    const stepKcal = step && refWeight != null ? stepsToKcal(step.total, refWeight) : 0;
    const exerciseKcal = exs.reduce((s, e) => s + e.kcal, 0);
    const burn = stepKcal + exerciseKcal;
    const intake = meal ? meal.breakfast + meal.lunch + meal.dinner + meal.snack : undefined;
    // 基礎代謝はプロフィールが揃っている場合のみ求まる(身長などは任意入力)
    const bmrKcal = refWeight != null ? profileBmr(profile, refWeight) : undefined;
    const deficit =
      meal != null && bmrKcal != null ? dailyDeficit(bmrKcal, burn, intake ?? 0) : undefined;

    const dinnerLogged = meal != null && (meal.dinner > 0 || !!meal.dinnerTime);
    days.push({
      date,
      weight: w?.kg,
      intake,
      steps: step?.total,
      stepKcal: step ? stepKcal : undefined,
      burn,
      deficit,
      bmr: bmrKcal,
      dinnerLogged,
    });
  }

  return { days, weightDates: sortedWeights.map((w) => w.date) };
}
