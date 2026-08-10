import type { Sex } from '../db';

/**
 * 体脂肪1kgの減量に必要な消費カロリー。
 * 出典: 厚生労働省「健康づくりのための身体活動・運動ガイド2023」情報シート
 * (「体脂肪1kgを減らすために必要なエネルギー量は約7,000kcalである」)。
 *
 * 画面に見せる出典はsources.tsに集約している。ここを変えるときはあちらも直す。
 */
export const KCAL_PER_KG = 7000;

export const ACTIVITY_LEVELS: { value: number; label: string }[] = [
  { value: 1.2, label: 'ほとんど運動しない' },
  { value: 1.375, label: '軽い運動(週1〜3回)' },
  { value: 1.55, label: '中程度の運動(週3〜5回)' },
  { value: 1.725, label: '激しい運動(週6〜7回)' },
  { value: 1.9, label: '非常に激しい運動・肉体労働' },
];

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(v: number): string {
  if (v < 18.5) return '低体重';
  if (v < 25) return '普通体重';
  if (v < 30) return '肥満(1度)';
  if (v < 35) return '肥満(2度)';
  if (v < 40) return '肥満(3度)';
  return '肥満(4度)';
}

// メタボリックシンドロームの腹囲判定(isMetaboWaist / METABO_WAIST_THRESHOLD)は削除した。
// 画面からは一度も呼ばれておらず、規約と出典シートでは「判定は行いません」と明言している。
// 判定ロジックがコードに残っていると、その宣言と食い違ううえ、うっかりUIに繋がる事故も招く。

export function ageAt(birthDate: string, on: Date = new Date()): number {
  const b = new Date(birthDate + 'T00:00:00');
  let age = on.getFullYear() - b.getFullYear();
  const beforeBirthday =
    on.getMonth() < b.getMonth() ||
    (on.getMonth() === b.getMonth() && on.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** 基礎代謝量(Mifflin-St Jeor式)。出典は sources.ts の 'bmr' を参照 */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/**
 * プロフィールの任意項目から基礎代謝を求める。
 * 身長・生年月日・性別はどれも任意入力なので、欠けていれば推定せずundefinedを返す。
 */
export function profileBmr(
  profile: { heightCm?: number; birthDate?: string; sex?: Sex },
  weightKg: number,
  on: Date = new Date(),
): number | undefined {
  const { heightCm, birthDate, sex } = profile;
  if (heightCm == null || heightCm <= 0 || !birthDate || !sex) return undefined;
  return bmr(weightKg, heightCm, ageAt(birthDate, on), sex);
}

/** 1日の推定消費カロリー(TDEE) */
export function tdee(bmrKcal: number, activityLevel: number): number {
  return bmrKcal * activityLevel;
}

/** 目標体重達成に必要な総消費カロリー(差分×7,000kcal)。既に達成済みなら0 */
export function totalKcalToGoal(currentKg: number, targetKg: number): number {
  return Math.max(0, (currentKg - targetKg) * KCAL_PER_KG);
}

/** from(省略時は今日)からtargetDateまでの残日数。過ぎていれば0 */
export function daysUntil(targetDate: string, from: Date = new Date()): number {
  const t = new Date(targetDate + 'T00:00:00');
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.max(0, Math.round((t.getTime() - f.getTime()) / 86400000));
}

/** 期間から逆算した必要1日消費カロリー */
export function requiredDailyKcal(totalKcal: number, days: number): number {
  if (days <= 0) return totalKcal > 0 ? Infinity : 0;
  return totalKcal / days;
}

/** 座位ベースの活動係数。カロリー貯金の計算では活動を記録から積み上げるため、二重計上を避けてこれを使う */
export const SEDENTARY_FACTOR = 1.2;

/**
 * 1日のカロリー貯金(消費と摂取の差) = 座位ベース消費(BMR×1.2) + 活動消費(歩数+運動) − 摂取。
 * 運動を増やしても摂取を抑えても貯金は増える。プラスなら体重が減る方向。
 */
export function dailyDeficit(
  bmrKcal: number,
  activityKcal: number,
  intakeKcal: number,
): number {
  return bmrKcal * SEDENTARY_FACTOR + activityKcal - intakeKcal;
}

/**
 * 減量中の1日あたり摂取カロリーの絶対的な下限。
 *
 * 基礎代謝が小さい人(小柄・高齢)で下限が下がりすぎるのを止めるための底。
 * 米国 AHA/ACC/TOS の肥満ガイドラインが自己管理での減量に示す下限
 * (女性1,200〜1,500kcal/日)に合わせている。出典は sources.ts の 'intakeFloor' を参照。
 */
export const MIN_INTAKE_KCAL = 1200;

/**
 * その日に指示してよい摂取カロリーの下限 = max(基礎代謝量, 1,200kcal)。
 *
 * 基礎代謝を下回る食事量を勧めるのは、座位消費を基礎代謝×1.2としている
 * このアプリの計算モデル自体と矛盾する。目標がどれだけ厳しくても、ここは割らない。
 */
export function minIntakeKcal(bmrKcal: number): number {
  return Math.max(bmrKcal, MIN_INTAKE_KCAL);
}

/**
 * その日に指示してよいカロリー貯金の上限。
 * 摂取が下限を割らない範囲(= 消費 − 下限)に頭打ちする。活動した日はその分だけ緩む。
 */
export function maxSafeDailyDeficit(bmrKcal: number, activityKcal = 0): number {
  return Math.max(0, bmrKcal * SEDENTARY_FACTOR + activityKcal - minIntakeKcal(bmrKcal));
}

/**
 * 目標から逆算した必要1日消費カロリーを、安全な範囲に丸める。
 *
 * 目標体重と達成日の割り算をそのまま出すと、たとえば「5kgを30日」でも
 * 1日300kcalしか食べられない指示になり、極端な目標なら数十万kcalにもなる。
 * 丸めたかどうか(capped)を返し、画面側で「この目標には無理がある」と伝えられるようにする。
 */
export function safeRequiredDailyKcal(
  required: number,
  bmrKcal: number,
  activityKcal = 0,
): { value: number; capped: boolean } {
  const cap = maxSafeDailyDeficit(bmrKcal, activityKcal);
  return required > cap ? { value: cap, capped: true } : { value: required, capped: false };
}

/**
 * 目標からの逆算値を、その日の実データに照らして画面に出せる形に整える。
 *
 * **逆算値を画面に出す箇所は、必ずこの関数を通すこと。** 生のrequiredDailyKcalを
 * そのまま表示すると、同じ目標に対して画面ごとに違う数字が出る(頭打ちが効いている
 * 画面と効いていない画面が並ぶ)。App Store Reviewガイドライン1.4.1に対して
 * 「下限を割らないところで頭打ちにしている」と説明している以上、そこに例外を作らない。
 *
 * 基礎代謝が推定できない日(身長・生年月日・性別が任意入力で欠けている場合)は、
 * 安全な上限そのものが決まらない。頭打ちできない数字を出すよりは何も出さない方が
 * 安全なので、undefinedを返して呼び出し側に「—」を出させる。
 */
export function safeRequiredForDay(
  required: number | undefined,
  bmrKcal: number | undefined,
  activityKcal = 0,
): { value: number; capped: boolean } | undefined {
  if (required == null || !Number.isFinite(required) || required <= 0) return undefined;
  if (bmrKcal == null) return undefined;
  return safeRequiredDailyKcal(required, bmrKcal, activityKcal);
}

/** 歩数からの距離推定(歩幅0.7m) */
export function stepsToKm(steps: number): number {
  return steps * 0.0007;
}

/**
 * 歩行の想定速度(km/h)。
 *
 * メッツ表で3.0メッツが当たるのは「普通歩行(平地、67m/分)」= 時速約4.0km。
 * 以前は時速4.8kmとしながら3.0メッツを当てていたが、その組み合わせはメッツ表の
 * どの行にも無く、消費を約2割小さく見積もっていた。速度をメッツ値に合わせる。
 * 出典は sources.ts の 'mets' を参照。
 */
export const WALK_SPEED_KMH = 4.0;

/** 歩行のメッツ値(普通歩行)。WALK_SPEED_KMHと対で1つの表の行に対応する */
export const WALK_METS = 3.0;

/**
 * 歩数からの消費カロリー推定。
 * 歩幅0.7m・時速4.0km・普通歩行3.0METsとして kcal = METs × 体重 × 時間 × 1.05
 * METs値と換算式の出典は sources.ts の 'mets' を参照。
 */
export function stepsToKcal(steps: number, weightKg: number): number {
  const km = stepsToKm(steps);
  const hours = km / WALK_SPEED_KMH;
  return WALK_METS * weightKg * hours * 1.05;
}

/**
 * 消費カロリーの推定に使う体重を選ぶ。
 * 当日の記録 > その日以前の最新 > 全体の最新 の順。1件も無ければundefined。
 */
export function pickReferenceWeight(
  weights: readonly { date: string; kg: number }[],
  date: string,
): number | undefined {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return (
    sorted.find((w) => w.date === date)?.kg ??
    sorted.filter((w) => w.date <= date).at(-1)?.kg ??
    sorted.at(-1)?.kg
  );
}

/**
 * 運動の消費カロリー推定。kcal = METs × 体重 × 時間 × 1.05
 * 歩数の推定(stepsToKcal)と同じ式で、安静時分を含む総消費として扱う。
 */
export function metsToKcal(mets: number, weightKg: number, minutes: number): number {
  if (mets <= 0 || weightKg <= 0 || minutes <= 0) return 0;
  return mets * weightKg * (minutes / 60) * 1.05;
}

/** stepsToKcalの逆算。指定カロリー分を歩くのに必要な歩数 */
export function kcalToSteps(kcal: number, weightKg: number): number {
  if (kcal <= 0 || weightKg <= 0) return 0;
  return kcal / ((0.0007 / WALK_SPEED_KMH) * WALK_METS * weightKg * 1.05);
}

/**
 * 「歩けば取り返せます」と勧めてよい歩数の上限。
 *
 * 逆算をそのまま出すと、ありふれた食べ過ぎ(1,000kcal程度)でも3万歩を超える。
 * 25kmを歩けと勧めるのは身体的な危害を招きうるので、超える量は歩数に言い換えない。
 *
 * 10,000歩は日常でよく使われる1日の目標歩数だが、**公的な推奨値ではない**。
 * 厚生労働省「健康づくりのための身体活動・運動ガイド2023」が成人に推奨するのは
 * 歩行等を1日60分以上(約8,000歩以上に相当)で、この上限はそれを上回る。
 * つまりこれは本アプリが表示上置いた歯止めであって、医学的な推奨量ではない。
 * sources.ts の 'mets' でも、そう断ったうえで参考値として推奨量を併記している。
 */
export const MAX_SUGGESTED_STEPS = 10000;

/**
 * 不足カロリーを「歩数」で言い換えてよいかを判定する。
 * 勧めてよい範囲なら歩数を、超えるならundefinedを返して呼び出し側に別の言い方をさせる。
 */
export function suggestedSteps(kcal: number, weightKg: number | undefined): number | undefined {
  if (weightKg == null || weightKg <= 0 || kcal <= 0) return undefined;
  const steps = Math.round(kcalToSteps(kcal, weightKg));
  return steps > MAX_SUGGESTED_STEPS ? undefined : steps;
}

/**
 * ご飯茶碗1杯(中盛り、白米150g)のおおよそのカロリー。食事量の目安換算に使う。
 *
 * 食品成分表の「めし・精白米」100gあたり156kcal → 150gで234kcal。
 * 食事プリセット(foodPresets.tsの「ご飯」)も235kcalなので、同じ食べ物に
 * 2つの数字を持たないようここも235に揃えている。出典は sources.ts の 'rice' を参照。
 */
export const RICE_BOWL_KCAL = 235;
