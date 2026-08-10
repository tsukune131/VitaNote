import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  hasMealTiming,
  MEDICATION_SLOT_LABELS,
  MEDICATION_TIMING_LABELS,
  type Food,
  type MealItem,
  type MealSlot,
  type Profile,
} from '../db';
import { AutosaveNote, useAutosave } from '../components/autosave';
import { type FoodPreset } from '../data/foodPresets';
import { PORTIONS, applyPortion, searchFoods } from '../lib/foodSearch';
import { matchExercise, searchExercises } from '../lib/exerciseSearch';
import { untrackedKcal, withItemAdded, withItemRemoved } from '../lib/mealItems';
import { StreakSummary } from '../components/StreakSummary';
import { TodayPrescription } from '../components/TodayPrescription';
import { ProBadge, ProLock } from '../components/ProGate';
import { SourcesLink } from '../components/SourcesSheet';
import {
  dailyDeficit,
  daysUntil,
  metsToKcal,
  pickReferenceWeight,
  profileBmr,
  requiredDailyKcal,
  safeRequiredForDay,
  stepsToKcal,
  totalKcalToGoal,
} from '../lib/calc';
import {
  addDays,
  dayOfMonthOf,
  formatDateShort,
  isLastDayOfMonth,
  nowTimeStr,
  todayStr,
  weekdayOf,
} from '../lib/date';
import { isHealthSyncEnabled, writeBodyMetricsToHealth } from '../lib/health';
import { tapFeedback } from '../lib/nativeUi';
import { refreshReminders } from '../lib/reminderSync';

export function RecordPage({ profile }: { profile: Profile }) {
  const [date, setDate] = useState(todayStr());

  return (
    <div>
      <StreakSummary profile={profile} />
      <TodayPrescription profile={profile} />

      <div className="date-nav">
        <button onClick={() => setDate((d) => addDays(d, -1))}>◀</button>
        <div className="title">{formatDateShort(date)}</div>
        <button onClick={() => setDate((d) => addDays(d, 1))} disabled={date >= todayStr()}>
          ▶
        </button>
        <button onClick={() => setDate(todayStr())} disabled={date === todayStr()}>
          今日
        </button>
      </div>

      <BodyMetricsSection key={`w-${profile.id}-${date}`} profile={profile} date={date} />
      <HealthMetricsSection key={`h-${profile.id}-${date}`} profile={profile} date={date} />
      <MealSection key={`m-${profile.id}-${date}`} profile={profile} date={date} />
      <WaterSection profileId={profile.id} date={date} />
      <ExerciseSection profileId={profile.id} date={date} />
      <DailySummary profile={profile} date={date} />
    </div>
  );
}

function useEntry<T>(table: string, profileId: number, date: string): T | undefined {
  return useLiveQuery(
    () => db.table(table).where('[profileId+date]').equals([profileId, date]).first() as Promise<T | undefined>,
    [table, profileId, date],
  );
}

/* ---------- 体重・体脂肪率・腹囲 ---------- */

function BodyMetricsSection({ profile, date }: { profile: Profile; date: string }) {
  const profileId = profile.id;
  const weightEntry = useEntry<{ id: number; kg: number; bodyFatPct?: number }>(
    'weights',
    profileId,
    date,
  );
  const metricEntry = useEntry<{ id: number; waist?: number }>('healthMetrics', profileId, date);
  const [kg, setKg] = useState('');
  const [fat, setFat] = useState('');
  const [waist, setWaist] = useState('');

  useEffect(() => {
    if (weightEntry) {
      setKg(String(weightEntry.kg));
      setFat(weightEntry.bodyFatPct != null ? String(weightEntry.bodyFatPct) : '');
    }
  }, [weightEntry?.id]);

  useEffect(() => {
    if (metricEntry) {
      setWaist(metricEntry.waist != null ? String(metricEntry.waist) : '');
    }
  }, [metricEntry?.id]);

  const kgN = Number(kg) || 0;
  const fatN = Number(fat) || 0;
  const waistN = Number(waist) || 0;
  const dirty =
    kgN !== (weightEntry?.kg ?? 0) ||
    fatN !== (weightEntry?.bodyFatPct ?? 0) ||
    waistN !== (metricEntry?.waist ?? 0);

  async function save() {
    const v = Number(kg);
    const w = Number(waist);
    if (!(v > 0) && !(w > 0)) return; // 体重・腹囲のどちらか一方だけの入力でも保存できる

    if (v > 0) {
      const f = Number(fat);
      const data = { kg: v, bodyFatPct: f > 0 ? f : undefined };
      if (weightEntry) await db.weights.update(weightEntry.id, data);
      else await db.weights.add({ profileId, date, ...data } as never);
      if (isHealthSyncEnabled(profile)) await writeBodyMetricsToHealth(date, v, data.bodyFatPct);
    }

    const waistData = { waist: w > 0 ? w : undefined };
    if (metricEntry) await db.healthMetrics.update(metricEntry.id, waistData);
    else if (w > 0) await db.healthMetrics.add({ profileId, date, ...waistData } as never);

    // 記録した内容によっては、これから届く予定のリマインダー通知が不要になる
    if (date === todayStr()) await refreshReminders(profile);
  }

  useAutosave(`${kg}|${fat}|${waist}`, dirty, save);

  return (
    <div className="card">
      <h2>体重・体脂肪率・腹囲</h2>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          体重(kg)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          体脂肪率(%)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            max="80"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </label>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          腹囲(cm)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
        </label>
        <AutosaveNote dirty={dirty} saved={(weightEntry != null || metricEntry != null) && !dirty} />
      </div>
    </div>
  );
}

/* ---------- 血圧・血糖値(任意) ---------- */

const OPTIONAL_METRIC_FIELDS = [['glucose', '血糖値', 'mg/dL', 'trackGlucose']] as const;

function HealthMetricsSection({ profile, date }: { profile: Profile; date: string }) {
  const profileId = profile.id;
  const entry = useEntry<{
    id: number;
    waist?: number;
    glucose?: number;
    systolic?: number;
    diastolic?: number;
  }>('healthMetrics', profileId, date);

  const [values, setValues] = useState<Record<string, string>>({});
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');

  useEffect(() => {
    if (entry) {
      setValues({
        glucose: entry.glucose != null ? String(entry.glucose) : '',
      });
      setSystolic(entry.systolic != null ? String(entry.systolic) : '');
      setDiastolic(entry.diastolic != null ? String(entry.diastolic) : '');
    }
  }, [entry?.id]);

  const activeFields = OPTIONAL_METRIC_FIELDS.filter(([, , , flag]) => profile[flag]);

  const dirty =
    (Number(values.glucose) || 0) !== (entry?.glucose ?? 0) ||
    (Number(systolic) || 0) !== (entry?.systolic ?? 0) ||
    (Number(diastolic) || 0) !== (entry?.diastolic ?? 0);
  const hasSaved =
    entry != null &&
    (entry.glucose != null || entry.systolic != null || entry.diastolic != null);

  async function save() {
    const data: Record<string, number | undefined> = {};
    for (const [key] of OPTIONAL_METRIC_FIELDS) {
      const v = Number(values[key]);
      data[key] = v > 0 ? v : undefined;
    }
    const sys = Number(systolic);
    const dia = Number(diastolic);
    data.systolic = sys > 0 ? sys : undefined;
    data.diastolic = dia > 0 ? dia : undefined;

    // waistは体重セクションが管理するフィールドなので、ここでは触らない
    if (entry) await db.healthMetrics.update(entry.id, data);
    else await db.healthMetrics.add({ profileId, date, ...data } as never);
  }

  useAutosave(`${values.glucose ?? ''}|${systolic}|${diastolic}`, dirty, save);

  if (!activeFields.length && !profile.trackBloodPressure) return null;

  return (
    <div className="card">
      <h2>
        血圧・血糖値
        <ProBadge />
      </h2>
      {/* 1.4.1は「端末のセンサーだけで血圧・血糖値を測る」と称するアプリを名指しで禁じている。
          手入力の記録であることを、規約の中だけでなく入力画面そのものに書いておく */}
      <p className="muted note" style={{ marginTop: 0 }}>
        ご家庭の血圧計・血糖測定器などで測った値を書き写して記録します。
        本アプリやiPhoneのセンサーが血圧・血糖値を測定することはありません。
        数値の意味や治療の判断は医師にご相談ください。
      </p>
      <ProLock>
      {activeFields.map(([key, label, unit]) => (
        <label className="field" key={key}>
          {label}({unit})
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={values[key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </label>
      ))}
      {profile.trackBloodPressure && (
        <div className="row">
          <label className="field">
            血圧・収縮期(mmHg)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
            />
          </label>
          <label className="field">
            血圧・拡張期(mmHg)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="row" style={{ marginTop: 4 }}>
        <AutosaveNote dirty={dirty} saved={hasSaved && !dirty} />
      </div>
      </ProLock>
    </div>
  );
}

/* ---------- 食事カロリー ---------- */

const MEAL_FIELDS = [
  ['breakfast', '朝食'],
  ['lunch', '昼食'],
  ['dinner', '夕食'],
  ['snack', '間食'],
] as const;

/** 見出しを字面より先に絵で拾えるようにする */
const MEAL_ICONS: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🍱',
  dinner: '🍲',
  snack: '🍪',
};

const emptyByMeal = (): Record<string, string> => ({
  breakfast: '',
  lunch: '',
  dinner: '',
  snack: '',
});

function MealSection({ profile, date }: { profile: Profile; date: string }) {
  const profileId = profile.id;
  const entry = useEntry<{
    id: number;
    breakfast: number;
    lunch: number;
    dinner: number;
    snack: number;
    breakfastTime?: string;
    lunchTime?: string;
    dinnerTime?: string;
    snackTime?: string;
    breakfastItems?: MealItem[];
    lunchItems?: MealItem[];
    dinnerItems?: MealItem[];
    snackItems?: MealItem[];
  }>('meals', profileId, date);
  const [values, setValues] = useState<Record<string, string>>({
    breakfast: '',
    lunch: '',
    dinner: '',
    snack: '',
  });
  const [times, setTimes] = useState<Record<string, string>>({
    breakfast: '',
    lunch: '',
    dinner: '',
    snack: '',
  });
  const [items, setItems] = useState<Record<string, MealItem[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  });

  useEffect(() => {
    if (entry) {
      setValues({
        breakfast: entry.breakfast ? String(entry.breakfast) : '',
        lunch: entry.lunch ? String(entry.lunch) : '',
        dinner: entry.dinner ? String(entry.dinner) : '',
        snack: entry.snack ? String(entry.snack) : '',
      });
      setTimes({
        breakfast: entry.breakfastTime ?? '',
        lunch: entry.lunchTime ?? '',
        dinner: entry.dinnerTime ?? '',
        snack: entry.snackTime ?? '',
      });
      setItems({
        breakfast: entry.breakfastItems ?? [],
        lunch: entry.lunchItems ?? [],
        dinner: entry.dinnerItems ?? [],
        snack: entry.snackItems ?? [],
      });
    }
  }, [entry?.id]);

  const total = MEAL_FIELDS.reduce((sum, [k]) => sum + (Number(values[k]) || 0), 0);

  // マイメニュー
  const foods = useLiveQuery(
    async () => {
      const rows = await db.foods.where('profileId').equals(profileId).toArray();
      rows.sort((a, b) => b.uses - a.uses);
      return rows;
    },
    [profileId],
  );
  // 手動のkcal・時刻入力とオリジナルメニュー登録は使う頻度が低いので折りたたむ
  const [manualFor, setManualFor] = useState<string | null>(null);
  // 手入力は「追加分」。合計を直接書き換えると検索で積んだ内訳と食い違うため触らせない
  const [extras, setExtras] = useState<Record<string, string>>(emptyByMeal);
  const [newName, setNewName] = useState('');
  const [newKcal, setNewKcal] = useState('');
  // 料理名検索。食事ごとに独立した入力欄なので検索語と量も食事ごとに持つ
  const [queries, setQueries] = useState<Record<string, string>>(emptyByMeal);
  const clearQuery = (key: string) => setQueries((q) => ({ ...q, [key]: '' }));
  const [portions, setPortions] = useState<Record<string, number>>({
    breakfast: 1,
    lunch: 1,
    dinner: 1,
    snack: 1,
  });
  const results = useMemo(() => {
    const out: Record<string, FoodPreset[]> = {};
    for (const [k] of MEAL_FIELDS) out[k] = searchFoods(queries[k]);
    return out;
  }, [queries]);
  // 検索結果に「マイメニュー登録済み」の★を出すための名前セット
  const savedNames = useMemo(() => new Set((foods ?? []).map((f) => f.name)), [foods]);
  // 追加した手応えを返すための一時表示(検索欄は空に戻すので、代わりに名前を出す)
  const [justAdded, setJustAdded] = useState<{ key: string; name: string } | null>(null);

  function noteAdded(key: string, name: string) {
    setJustAdded({ key, name });
    window.setTimeout(
      () => setJustAdded((cur) => (cur && cur.key === key && cur.name === name ? null : cur)),
      2000,
    );
  }

  /** メニューを内訳に足し、そのぶん合計kcalを増やす。時刻が未入力なら現在時刻を入れる */
  function addItem(key: string, item: MealItem) {
    const next = withItemAdded(items[key] ?? [], Number(values[key]) || 0, item);
    setItems((s) => ({ ...s, [key]: next.items }));
    setValues((v) => ({ ...v, [key]: String(next.kcal) }));
    setTimes((t) => (t[key] ? t : { ...t, [key]: nowTimeStr() }));
  }

  function removeItem(key: string, index: number) {
    const next = withItemRemoved(items[key] ?? [], Number(values[key]) || 0, index);
    setItems((s) => ({ ...s, [key]: next.items }));
    setValues((v) => ({ ...v, [key]: next.kcal ? String(next.kcal) : '' }));
  }

  /**
   * 手動パネルの開閉。
   * 開くときは時刻を現在時刻に入れ直す。あとから手で足すぶんは
   * 「いま食べた物」なので、最初の1品を入れた時刻が残っていても意味がない。
   */
  function toggleManual(key: string) {
    const opening = manualFor !== key;
    setManualFor(opening ? key : null);
    if (opening) setTimes((t) => ({ ...t, [key]: nowTimeStr() }));
  }

  /** 内訳に載っていないぶんを合計から差し引く。内訳は触らない */
  function dropUntracked(key: string, kcal: number) {
    const rest = (Number(values[key]) || 0) - kcal;
    setValues((v) => ({ ...v, [key]: rest > 0 ? String(rest) : '' }));
  }

  /** 名前のない手入力ぶんを1つ足す。あとから消せるように内訳へも「手入力」で残す */
  function addExtra(key: string) {
    const k = Number(extras[key]);
    if (!(k > 0)) return;
    addItem(key, { name: '手入力', kcal: Math.round(k) });
    setExtras((s) => ({ ...s, [key]: '' }));
    noteAdded(key, `手入力 ${Math.round(k)}kcal`);
  }

  async function applyFood(key: string, food: Food) {
    addItem(key, { name: food.name, kcal: food.kcal });
    noteAdded(key, food.name);
    await db.foods.update(food.id, { uses: food.uses + 1 });
  }

  function findFood(name: string) {
    return db.foods
      .where('profileId')
      .equals(profileId)
      .filter((f) => f.name === name)
      .first();
  }

  /**
   * 同梱テーブルから選んだぶんを加算する。
   * マイメニューへの登録は★の明示操作だけで行う(検索で食べた物が勝手に増えないように)。
   * 登録済みの物だけ使用回数を進めて、チップの「よく使う順」に反映する。
   * 続けて2品目を探せるように、追加できたら検索欄は空に戻す。
   */
  async function applyPreset(key: string, preset: FoodPreset) {
    addItem(key, { name: preset.name, kcal: applyPortion(preset.kcal, portions[key]) });
    clearQuery(key);
    noteAdded(key, preset.name);
    const existing = await findFood(preset.name);
    if (existing) await db.foods.update(existing.id, { uses: existing.uses + 1 });
  }

  /** ★でマイメニューへの登録・解除。保存するのは倍率をかける前の基準kcal */
  async function toggleSaved(preset: FoodPreset) {
    const existing = await findFood(preset.name);
    if (existing) await db.foods.delete(existing.id);
    else await db.foods.add({ profileId, name: preset.name, kcal: preset.kcal, uses: 0 } as never);
    void tapFeedback();
  }

  async function addFood() {
    const k = Number(newKcal);
    if (!newName.trim() || !(k > 0)) return;
    await db.foods.add({ profileId, name: newName.trim(), kcal: k, uses: 0 } as never);
    setNewName('');
    setNewKcal('');
  }

  // 服薬管理
  // 服薬を使うかどうかと薬の登録は「設定」タブ。ここは日々のチェックだけを扱う
  const useMedication = profile.useMedication ?? false;
  const medications = useLiveQuery(
    async () => (useMedication ? db.medications.where('profileId').equals(profileId).toArray() : []),
    [profileId, useMedication],
  );
  const medLogs = useLiveQuery(
    async () =>
      useMedication
        ? db.medicationLogs.where('[profileId+date]').equals([profileId, date]).toArray()
        : [],
    [profileId, date, useMedication],
  );

  async function toggleTaken(medicationId: number, meal: MealSlot | undefined, taken: boolean) {
    const existing = medLogs?.find((l) => l.medicationId === medicationId && l.meal === meal);
    if (taken && !existing) {
      await db.medicationLogs.add({ profileId, date, medicationId, meal } as never);
      void tapFeedback(); // 飲んだ印を付けた手応えを返す
    } else if (!taken && existing) {
      await db.medicationLogs.delete(existing.id);
    }
  }

  const mealMedications = (medications ?? []).filter((m) => (m.frequency ?? 'meal') === 'meal');
  const otherMedications = (medications ?? []).filter((m) => {
    const freq = m.frequency ?? 'meal';
    if (freq === 'weekly') return (m.weekday ?? 0) === weekdayOf(date);
    if (freq === 'monthly')
      return m.dayOfMonth === dayOfMonthOf(date) || ((m.dayOfMonth ?? 1) > 28 && isLastDayOfMonth(date));
    return false;
  });

  const dirty =
    MEAL_FIELDS.some(([k]) => (Number(values[k]) || 0) !== (entry?.[k] ?? 0)) ||
    (times.breakfast || '') !== (entry?.breakfastTime ?? '') ||
    (times.lunch || '') !== (entry?.lunchTime ?? '') ||
    (times.dinner || '') !== (entry?.dinnerTime ?? '') ||
    (times.snack || '') !== (entry?.snackTime ?? '') ||
    MEAL_FIELDS.some(
      ([k]) => JSON.stringify(items[k] ?? []) !== JSON.stringify(entry?.[`${k}Items`] ?? []),
    );

  async function save() {
    const data = {
      breakfast: Number(values.breakfast) || 0,
      lunch: Number(values.lunch) || 0,
      dinner: Number(values.dinner) || 0,
      snack: Number(values.snack) || 0,
      breakfastTime: times.breakfast || undefined,
      lunchTime: times.lunch || undefined,
      dinnerTime: times.dinner || undefined,
      snackTime: times.snack || undefined,
      breakfastItems: items.breakfast.length ? items.breakfast : undefined,
      lunchItems: items.lunch.length ? items.lunch : undefined,
      dinnerItems: items.dinner.length ? items.dinner : undefined,
      snackItems: items.snack.length ? items.snack : undefined,
    };
    if (entry) await db.meals.update(entry.id, data);
    else await db.meals.add({ profileId, date, ...data } as never);
  }

  useAutosave(JSON.stringify({ values, times, items }), dirty, save);

  return (
    <div className="card">
      <h2>食事</h2>
      {MEAL_FIELDS.map(([key, label]) => {
        const medsForMeal = mealMedications.filter((m) => (m.meals ?? []).includes(key));
        const q = queries[key].trim();
        // 内訳を持たない古い記録ぶん。チップにして取り消せるようにする
        const untracked = untrackedKcal(items[key] ?? [], Number(values[key]) || 0);
        return (
        <div className="meal-block" key={key}>
          {/* 4食が地続きに見えないよう、1食ずつ紙片として区切る */}
          <div className="meal-head">
            <span className="meal-title">
              <span className="meal-icon" aria-hidden="true">
                {MEAL_ICONS[key]}
              </span>
              {label}
            </span>
            {Number(values[key]) > 0 ? (
              <span className="meal-sum">
                {times[key] && <span className="muted meal-time">{times[key]}</span>}
                <span>
                  <strong>{Number(values[key])}</strong>kcal
                </span>
              </span>
            ) : (
              <span className="muted meal-sum">未入力</span>
            )}
          </div>
          {((items[key] ?? []).length > 0 || untracked > 0) && (
            <div className="meal-items">
              {untracked > 0 && (
                <span className="chip">
                  <span className="chip-label">
                    内訳なし <span className="muted">{untracked}kcal</span>
                  </span>
                  <button
                    className="chip-x"
                    aria-label={`内訳なしの${untracked}kcalを取り消す`}
                    onClick={() => dropUntracked(key, untracked)}
                  >
                    ×
                  </button>
                </span>
              )}
              {items[key].map((it, i) => (
                <span className="chip" key={`${it.name}-${i}`}>
                  <span className="chip-label">
                    {it.name} <span className="muted">{it.kcal}kcal</span>
                  </span>
                  <button
                    className="chip-x"
                    aria-label={`${it.name}を削除`}
                    onClick={() => removeItem(key, i)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* 入力の主役はメニュー検索。開くひと手間をなくして最初から出しておく */}
          <div>
            {/* 見出しは置かず、欄を1行に抑える。何を書くかはプレースホルダで足りる */}
            <input
              className="food-query"
              type="search"
              aria-label={`${label}の料理名で探す`}
              placeholder="料理名で探す(例: カレー、ご飯)"
              value={queries[key]}
              onChange={(e) => setQueries((s) => ({ ...s, [key]: e.target.value }))}
            />
            {justAdded?.key === key && (
              <p className="muted food-added-note">✓ {justAdded.name} を追加しました</p>
            )}
            {q !== '' && (
              <>
                <div className="portion-row">
                  <span className="muted">量</span>
                  {PORTIONS.map((p) => (
                    <button
                      key={p.label}
                      className={`ghost portion-btn ${portions[key] === p.mult ? 'active' : ''}`}
                      onClick={() => setPortions((s) => ({ ...s, [key]: p.mult }))}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {results[key].length === 0 ? (
                  <p className="muted" style={{ margin: '6px 0' }}>
                    見つかりませんでした。下の「手動で入力」から名前とkcalを登録できます。
                  </p>
                ) : (
                  <ul className="food-results">
                    {results[key].map((f) => {
                      const saved = savedNames.has(f.name);
                      return (
                      <li key={f.name}>
                        <button className="food-add" onClick={() => void applyPreset(key, f)}>
                          <span className="food-name">{f.name}</span>
                          <span className="muted food-unit">{f.unit}</span>
                          <span className="food-kcal">
                            約{applyPortion(f.kcal, portions[key])}kcal
                          </span>
                        </button>
                        <button
                          className={`food-star ${saved ? 'on' : ''}`}
                          aria-pressed={saved}
                          aria-label={
                            saved ? `${f.name}をマイメニューから外す` : `${f.name}をマイメニューに登録`
                          }
                          onClick={() => void toggleSaved(f)}
                        >
                          {saved ? '★' : '☆'}
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
                <p className="muted food-note">
                  カロリーは一般的な目安です。店やレシピで変わります。
                  <SourcesLink focus="food" label="出典を見る" />
                  <br />
                  ☆を押すとマイメニューに登録され、次回から検索なしで選べます。
                </p>
              </>
            )}
            {q === '' && (foods ?? []).length > 0 && (
              <div className="chips">
                {foods!.map((f) => (
                  <span className="chip" key={f.id}>
                    <button className="chip-main" onClick={() => void applyFood(key, f)}>
                      {f.name} {f.kcal}kcal
                    </button>
                    <button
                      className="chip-x"
                      aria-label={`${f.name}を削除`}
                      onClick={() => void db.foods.delete(f.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 手動のkcal・時刻とオリジナルメニュー登録は補助。畳んでおいて必要なときだけ開く */}
          <button
            className={`ghost manual-toggle ${manualFor === key ? 'active' : ''}`}
            aria-expanded={manualFor === key}
            onClick={() => toggleManual(key)}
          >
            手動で入力・お気に入り登録 <span aria-hidden="true">{manualFor === key ? '⌃' : '⌄'}</span>
          </button>
          {manualFor === key && (
            <div className="manual-panel">
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  追加分(kcal)
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={extras[key]}
                    onChange={(e) => setExtras((s) => ({ ...s, [key]: e.target.value }))}
                  />
                </label>
                <label className="field field-fixed-time" style={{ marginBottom: 0 }}>
                  時刻
                  <input
                    type="time"
                    value={times[key]}
                    onChange={(e) => setTimes((t) => ({ ...t, [key]: e.target.value }))}
                  />
                </label>
                <button
                  className="secondary"
                  style={{ flex: '0 0 auto' }}
                  onClick={() => addExtra(key)}
                  disabled={!(Number(extras[key]) > 0)}
                >
                  追加
                </button>
              </div>
              <div className="manual-sub">お気に入りに登録</div>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  名前
                  <input
                    type="text"
                    placeholder="例: 納豆ごはん"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  kcal
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={newKcal}
                    onChange={(e) => setNewKcal(e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  style={{ flex: '0 0 auto' }}
                  onClick={() => void addFood()}
                  disabled={!newName.trim() || !(Number(newKcal) > 0)}
                >
                  登録
                </button>
              </div>
              <p className="muted food-note">
                登録した物は検索欄の下に並び、次回からタップだけで追加できます。
              </p>
            </div>
          )}
          {/* 服薬チェックは食事の記録とは別の作業なので、入力の流れを断たないよう末尾に置く */}
          {useMedication && medsForMeal.length > 0 && (
            <div className="medicine-box">
              <div className="medicine-head">💊 {MEDICATION_SLOT_LABELS[key]}のお薬</div>
              {medsForMeal.map((m) => {
                const taken =
                  medLogs?.some((l) => l.medicationId === m.id && l.meal === key) ?? false;
                return (
                  <label className="checkbox-inline medicine-row" key={m.id}>
                    <input
                      type="checkbox"
                      checked={taken}
                      onChange={(e) => void toggleTaken(m.id, key, e.target.checked)}
                    />
                    {m.name}
                    {hasMealTiming(key) && (
                      <span className="muted">
                        ({MEDICATION_TIMING_LABELS[m.timing ?? 'after']})
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        );
      })}
      {useMedication && otherMedications.length > 0 && (
        <div className="medicine-box">
          <div className="medicine-head">💊 きょうのその他のお薬</div>
          {otherMedications.map((m) => {
            const taken = medLogs?.some((l) => l.medicationId === m.id && l.meal == null) ?? false;
            return (
              <label className="checkbox-inline medicine-row" key={m.id}>
                <input
                  type="checkbox"
                  checked={taken}
                  onChange={(e) => void toggleTaken(m.id, undefined, e.target.checked)}
                />
                {m.name}
                <span className="muted">
                  ({(m.frequency ?? 'meal') === 'weekly' ? '週1回' : '月1回'})
                </span>
              </label>
            );
          })}
        </div>
      )}
      <div className="row meal-total" style={{ alignItems: 'center' }}>
        <div>
          <span className="muted">1日の合計</span> <strong>{total.toLocaleString()}</strong>
          <span className="muted"> kcal</span>
        </div>
        <AutosaveNote dirty={dirty} saved={entry != null && !dirty} />
      </div>
    </div>
  );
}

/* ---------- 飲水 ---------- */

function WaterSection({ profileId, date }: { profileId: number; date: string }) {
  const logs = useLiveQuery(
    async () => {
      const rows = await db.waterLogs.where('[profileId+date]').equals([profileId, date]).toArray();
      rows.sort((a, b) => a.time.localeCompare(b.time));
      return rows;
    },
    [profileId, date],
  );
  const [custom, setCustom] = useState('');

  const total = (logs ?? []).reduce((s, l) => s + l.ml, 0);

  async function add(ml: number) {
    if (!(ml > 0)) return;
    await db.waterLogs.add({ profileId, date, time: nowTimeStr(), ml } as never);
    void tapFeedback(); // ボタン一発で記録が増えるので、入った合図を返す
  }

  return (
    <div className="card">
      <h2>飲水 <span className="chart-sub">合計 {total.toLocaleString()} ml</span></h2>
      <div className="row">
        {(
          [
            { ml: 100, label: '1〜2口' },
            { ml: 200, label: 'コップ1杯' },
            { ml: 500, label: 'ペットボトル' },
          ] as const
        ).map(({ ml, label }) => (
          <button key={ml} className="secondary water-btn" onClick={() => void add(ml)}>
            {label}
            <small>{ml}ml</small>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          その他(ml)
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            void add(Number(custom));
            setCustom('');
          }}
          disabled={!(Number(custom) > 0)}
          style={{ flex: '0 0 auto' }}
        >
          追加
        </button>
      </div>
      {(logs ?? []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {logs!.map((l) => (
            <div className="list-item" key={l.id}>
              <span>
                {l.time} <strong>{l.ml}ml</strong>
              </span>
              <button className="danger" onClick={() => void db.waterLogs.delete(l.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 運動 ---------- */

function ExerciseSection({ profileId, date }: { profileId: number; date: string }) {
  const items = useLiveQuery(
    () => db.exercises.where('[profileId+date]').equals([profileId, date]).toArray(),
    [profileId, date],
  );
  const weights = useLiveQuery(
    () => db.weights.where('profileId').equals(profileId).toArray(),
    [profileId],
  );
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [kcal, setKcal] = useState('');
  // 推定値をそのまま使うか、ユーザーが上書きしたかを覚えておく
  const [kcalEdited, setKcalEdited] = useState(false);
  // 候補リストを出すか。datalistは初回タップで開かない端末があるので自前で出す
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestions = useMemo(() => searchExercises(name, 8), [name]);

  const refWeight = pickReferenceWeight(weights ?? [], date);
  const preset = matchExercise(name);
  const estimate =
    preset && refWeight != null ? Math.round(metsToKcal(preset.mets, refWeight, Number(minutes))) : 0;

  // 種目か時間を変えたら推定値を入れ直す(kcalを自分で直した後は触らない)
  useEffect(() => {
    if (kcalEdited) return;
    setKcal(estimate > 0 ? String(estimate) : '');
  }, [estimate, kcalEdited]);

  async function add() {
    const v = Number(kcal);
    if (!(v > 0)) return;
    const label = name.trim() || '運動';
    const mins = Number(minutes);
    await db.exercises.add({
      profileId,
      date,
      name: mins > 0 ? `${label} ${mins}分` : label,
      kcal: v,
    } as never);
    setName('');
    setMinutes('');
    setKcal('');
    setKcalEdited(false);
    setShowSuggest(false);
  }

  return (
    <div className="card">
      <h2>運動での消費カロリー</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        歩数以外の運動(筋トレ・水泳など)の消費カロリーを追加します。
        種目と時間を入れると消費カロリーの目安が入ります。
      </p>
      <p className="source-link">
        目安はメッツ表を使ったMETs法(メッツ×体重×時間×1.05)による推定です。
        <SourcesLink focus="mets" label="出典を見る" />
      </p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field exercise-name" style={{ marginBottom: 0 }}>
          内容
          <input
            type="text"
            placeholder="例: 水泳、筋トレ"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
          />
          {showSuggest && suggestions.length > 0 && (
            <ul className="food-results exercise-suggest">
              {suggestions.map((p) => (
                <li key={p.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setName(p.name);
                      setShowSuggest(false);
                    }}
                  >
                    <span className="food-name">{p.name}</span>
                    <span className="muted food-unit">{p.cat}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label className="field field-fixed-min" style={{ marginBottom: 0 }}>
          時間(分)
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="30"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          消費(kcal)
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={kcal}
            onChange={(e) => {
              setKcalEdited(true);
              setKcal(e.target.value);
            }}
          />
        </label>
        <button onClick={() => void add()} disabled={!(Number(kcal) > 0)} style={{ flex: '0 0 auto' }}>
          追加
        </button>
      </div>
      <p className="muted" style={{ margin: '6px 0 0' }}>
        {estimate > 0
          ? `${preset!.name} ${Number(minutes)}分は約${estimate}kcalの目安です(体重${refWeight}kgで計算)。違う場合は書き換えてください。`
          : preset && refWeight == null
            ? '体重を記録すると、種目と時間から消費カロリーを推定できます。'
            : '一覧にない運動も、そのまま入力してkcalを直接入れれば記録できます。'}
      </p>
      {(items ?? []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {items!.map((it) => (
            <div className="list-item" key={it.id}>
              <span>
                {it.name} <strong>{it.kcal}kcal</strong>
              </span>
              <button className="danger" onClick={() => void db.exercises.delete(it.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 当日サマリー ---------- */

function DailySummary({ profile, date }: { profile: Profile; date: string }) {
  const data = useLiveQuery(
    async () => {
      const key = [profile.id, date] as [number, string];
      const [meal, step, exercises, allWeights] = await Promise.all([
        db.meals.where('[profileId+date]').equals(key).first(),
        db.steps.where('[profileId+date]').equals(key).first(),
        db.exercises.where('[profileId+date]').equals(key).toArray(),
        db.weights.where('profileId').equals(profile.id).toArray(),
      ]);
      return { meal, step, exercises, allWeights };
    },
    [profile.id, date],
  );

  if (!data) return null;
  const { meal, step, exercises, allWeights } = data;

  const sorted = [...allWeights].sort((a, b) => a.date.localeCompare(b.date));
  const refWeight = pickReferenceWeight(allWeights, date);

  const intake = meal ? meal.breakfast + meal.lunch + meal.dinner + meal.snack : 0;
  const stepKcal = step && refWeight != null ? stepsToKcal(step.total, refWeight) : 0;
  const exerciseKcal = exercises.reduce((s, e) => s + e.kcal, 0);
  const burn = stepKcal + exerciseKcal;

  // カロリー貯金 = 基礎代謝×1.2 + 活動消費 − 摂取
  // (食事と体重の記録があり、かつ基礎代謝を出せるプロフィールが入っている日のみ)
  const bmrKcal = refWeight != null ? profileBmr(profile, refWeight) : undefined;
  const deficit = meal != null && bmrKcal != null ? dailyDeficit(bmrKcal, burn, intake) : undefined;

  // 必要1日消費(目標設定がある場合)。
  // 生の逆算値は出さない。その日の基礎代謝・活動量で頭打ちにしてから表示する
  // (同じタブの進捗カード・きょうの処方箋と数字を揃えるため)
  const latestKg = sorted.at(-1)?.kg;
  const rawRequired =
    profile.targetWeightKg != null && profile.targetDate && latestKg != null
      ? requiredDailyKcal(
          totalKcalToGoal(latestKg, profile.targetWeightKg),
          daysUntil(profile.targetDate),
        )
      : undefined;
  const safe = safeRequiredForDay(rawRequired, bmrKcal, burn);
  const required = safe?.value;
  const showRequired = required != null && required > 0;

  return (
    <div className="card">
      <h2>この日のまとめ</h2>
      <div className="stat-grid">
        <div className="stat">
          <div className="label">摂取カロリー</div>
          <div className="value">
            {intake.toLocaleString()}
            <small> kcal</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">活動消費(歩数+運動)</div>
          <div className="value">
            {Math.round(burn).toLocaleString()}
            <small> kcal</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">今日のカロリー貯金</div>
          <div className="value">
            {deficit != null ? Math.round(deficit).toLocaleString() : '—'}
            {deficit != null && <small> kcal</small>}
          </div>
        </div>
        <div className="stat">
          <div className="label">1日の目標との差</div>
          <div className="value">
            {deficit != null && showRequired ? (
              <span style={{ color: deficit >= required ? 'var(--success)' : 'var(--danger)' }}>
                {deficit >= required ? '+' : ''}
                {Math.round(deficit - required).toLocaleString()}
                <small> kcal</small>
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        歩数分 {Math.round(stepKcal)}kcal + 運動分 {exerciseKcal}kcal。
        カロリー貯金は「使ったカロリー(基礎代謝×1.2+歩数・運動)−食べたカロリー」。
        プラスなら体重が減る方向で、運動でも食事を抑えることでも貯まります。
      </p>
      {/* 注記は説明文に埋もれないよう行を分ける */}
      {refWeight == null && (
        <p className="muted note" style={{ marginBottom: 0 }}>
          ※体重が未記録のため計算できません。
        </p>
      )}
      {refWeight != null && meal == null && (
        <p className="muted note" style={{ marginBottom: 0 }}>
          ※食事を記録するとカロリー貯金が表示されます。
        </p>
      )}
      {refWeight != null && bmrKcal == null && (
        <p className="muted note" style={{ marginBottom: 0 }}>
          ※基礎代謝の推定には身長・生年月日・性別が必要です(任意項目)。
          「あなた」タブで入力すると計算されます。
        </p>
      )}
      {/* 頭打ちにした数字を黙って出さない。他の画面と同じ理由を同じ言葉で伝える */}
      {safe?.capped && (
        <p className="muted note" style={{ marginBottom: 0 }}>
          ※この目標を達成日までに実現しようとすると、1日の食事量が安全な下限を下回ってしまいます。
          「1日の目標との差」は、食事量がそこを下回らないところで止めた目標との差です。
          達成日を延ばすか目標体重を見直すことをおすすめします。減量の進め方は医師にご相談ください。
          <SourcesLink focus="intakeFloor" label="下限の考え方と出典" />
        </p>
      )}
      {/* このカードは「きょう」タブで唯一いつでも描かれる。上で計算式を見せている以上、
          出典への入口と医師相談の促しは条件を付けずにここへ置く(ガイドライン1.4.1) */}
      <p className="muted note" style={{ marginBottom: 0 }}>
        ※基礎代謝はMifflin-St Jeor式、歩数・運動の消費はMETs法による推定です。体脂肪1kg≒7,000kcalは
        厚生労働省「健康づくりのための身体活動・運動ガイド2023」に基づく目安で、実際の減量には
        個人差があります。
        <br />
        ※減量・食事制限・運動は、体調や持病に応じて医師にご相談のうえ行ってください。
      </p>
      <p className="source-link" style={{ marginBottom: 0 }}>
        <SourcesLink focus="fatKcal" label="この計算の出典を見る" />
      </p>
    </div>
  );
}
