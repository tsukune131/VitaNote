import { describe, expect, it } from 'vitest';
import {
  ageAt,
  bmi,
  bmiCategory,
  bmr,
  dailyDeficit,
  daysUntil,
  isMetaboWaist,
  kcalToSteps,
  maxSafeDailyDeficit,
  metsToKcal,
  minIntakeKcal,
  pickReferenceWeight,
  profileBmr,
  requiredDailyKcal,
  safeRequiredDailyKcal,
  safeRequiredForDay,
  stepsToKcal,
  tdee,
  totalKcalToGoal,
} from './calc';

describe('bmi', () => {
  it('身長170cm・体重70kgでBMI約24.2', () => {
    expect(bmi(70, 170)).toBeCloseTo(24.22, 1);
  });
  it('カテゴリ判定', () => {
    expect(bmiCategory(18)).toBe('低体重');
    expect(bmiCategory(22)).toBe('普通体重');
    expect(bmiCategory(27)).toBe('肥満(1度)');
  });
});

describe('isMetaboWaist', () => {
  it('男性は85cm以上で該当', () => {
    expect(isMetaboWaist(85, 'male')).toBe(true);
    expect(isMetaboWaist(84.9, 'male')).toBe(false);
  });
  it('女性は90cm以上で該当', () => {
    expect(isMetaboWaist(90, 'female')).toBe(true);
    expect(isMetaboWaist(89.9, 'female')).toBe(false);
  });
});

describe('ageAt', () => {
  it('誕生日前は1歳少ない', () => {
    expect(ageAt('1990-06-15', new Date('2026-06-14T00:00:00'))).toBe(35);
    expect(ageAt('1990-06-15', new Date('2026-06-15T00:00:00'))).toBe(36);
  });
});

describe('bmr / tdee', () => {
  it('男性70kg・170cm・36歳のBMR', () => {
    // 10*70 + 6.25*170 - 5*36 + 5 = 1587.5
    expect(bmr(70, 170, 36, 'male')).toBeCloseTo(1587.5);
  });
  it('女性は-161の補正', () => {
    expect(bmr(55, 160, 30, 'female')).toBeCloseTo(10 * 55 + 6.25 * 160 - 150 - 161);
  });
  it('TDEEは活動係数を掛ける', () => {
    expect(tdee(1600, 1.55)).toBeCloseTo(2480);
  });
});

describe('profileBmr', () => {
  const full = { heightCm: 170, birthDate: '1990-06-15', sex: 'male' as const };
  const on = new Date('2026-06-15T00:00:00');

  it('身長・生年月日・性別が揃っていればBMRを返す', () => {
    expect(profileBmr(full, 70, on)).toBeCloseTo(bmr(70, 170, 36, 'male'));
  });
  it('どれか1つでも未入力ならundefined', () => {
    expect(profileBmr({ ...full, heightCm: undefined }, 70, on)).toBeUndefined();
    expect(profileBmr({ ...full, birthDate: undefined }, 70, on)).toBeUndefined();
    expect(profileBmr({ ...full, sex: undefined }, 70, on)).toBeUndefined();
    expect(profileBmr({}, 70, on)).toBeUndefined();
  });
});

describe('食事量の下限(無理な目標を頭打ちにする)', () => {
  it('下限は基礎代謝と1,200kcalの高い方', () => {
    expect(minIntakeKcal(1568)).toBe(1568);
    expect(minIntakeKcal(1000)).toBe(1200); // 小柄・高齢で基礎代謝が低い場合
  });

  it('指示してよい貯金は「消費 − 下限」まで', () => {
    // 基礎代謝1,568kcalなら座位消費1,881.6kcal。下限1,568を残すと313.6kcalが上限
    expect(maxSafeDailyDeficit(1568)).toBeCloseTo(313.6, 1);
    // 歩いた分だけ上限は緩む
    expect(maxSafeDailyDeficit(1568, 300)).toBeCloseTo(613.6, 1);
  });

  it('下限を割る目標は頭打ちにし、cappedを立てる', () => {
    // 70kg→65kgを30日(必要1,167kcal/日)は、そのままだと食事が714kcalになる
    const capped = safeRequiredDailyKcal(1167, 1568);
    expect(capped.capped).toBe(true);
    expect(capped.value).toBeCloseTo(313.6, 1);
  });

  it('極端な目標でも歯止めが効く', () => {
    // 70kg→1kgを1日: 逆算では483,000kcal/日
    const capped = safeRequiredDailyKcal(483000, 1568);
    expect(capped.value).toBeCloseTo(313.6, 1);
  });

  it('無理のない目標はそのまま通す', () => {
    const ok = safeRequiredDailyKcal(200, 1568);
    expect(ok).toEqual({ value: 200, capped: false });
  });

  it('消費が下限に届かない場合は貯金を求めない(0で頭打ち)', () => {
    // 基礎代謝900kcal → 座位消費1,080kcalに対し下限は1,200kcal
    expect(maxSafeDailyDeficit(900)).toBe(0);
    expect(safeRequiredDailyKcal(500, 900)).toEqual({ value: 0, capped: true });
  });
});

describe('safeRequiredForDay', () => {
  // 逆算値を画面に出す箇所はすべてこれを通す。頭打ちできない状況では
  // 生の逆算値に落ちず、undefinedを返して画面に「—」を出させるのが肝心
  it('基礎代謝が分かれば頭打ちした値を返す', () => {
    const safe = safeRequiredForDay(1167, 1568);
    expect(safe?.capped).toBe(true);
    expect(safe?.value).toBeCloseTo(313.6, 1);
  });

  it('その日の活動量ぶんだけ上限が緩む', () => {
    // 歩いた日は消費が増えるので、同じ下限でも貯金の上限が上がる
    const safe = safeRequiredForDay(1167, 1568, 300);
    expect(safe?.capped).toBe(true);
    expect(safe?.value).toBeCloseTo(613.6, 1);
  });

  it('基礎代謝が推定できなければ数字を出さない', () => {
    expect(safeRequiredForDay(1167, undefined)).toBeUndefined();
    // 483,000kcal/日のような極端な逆算値も、頭打ちできない以上は伏せる
    expect(safeRequiredForDay(483000, undefined)).toBeUndefined();
  });

  it('逆算値そのものが使えないときも数字を出さない', () => {
    expect(safeRequiredForDay(undefined, 1568)).toBeUndefined();
    // 達成日が今日以前だとrequiredDailyKcalはInfinityを返す
    expect(safeRequiredForDay(Infinity, 1568)).toBeUndefined();
    expect(safeRequiredForDay(NaN, 1568)).toBeUndefined();
    // 目標達成済み(残り0kcal)は「必要な消費」ではない
    expect(safeRequiredForDay(0, 1568)).toBeUndefined();
    expect(safeRequiredForDay(-100, 1568)).toBeUndefined();
  });

  it('無理のない目標はそのまま通す', () => {
    expect(safeRequiredForDay(200, 1568)).toEqual({ value: 200, capped: false });
  });
});

describe('goal calculations', () => {
  it('体重差×7000kcal', () => {
    expect(totalKcalToGoal(70, 65)).toBe(5 * 7000);
  });
  it('目標達成済みなら0', () => {
    expect(totalKcalToGoal(60, 65)).toBe(0);
  });
  it('残日数の計算', () => {
    expect(daysUntil('2026-08-01', new Date('2026-07-19T10:30:00'))).toBe(13);
    expect(daysUntil('2026-07-01', new Date('2026-07-19T00:00:00'))).toBe(0);
  });
  it('必要1日消費カロリー', () => {
    expect(requiredDailyKcal(36000, 30)).toBe(1200);
    expect(requiredDailyKcal(36000, 0)).toBe(Infinity);
    expect(requiredDailyKcal(0, 0)).toBe(0);
  });
});

describe('dailyDeficit', () => {
  it('座位消費+活動−摂取', () => {
    // 1500×1.2 + 300 − 1800 = 300
    expect(dailyDeficit(1500, 300, 1800)).toBeCloseTo(300);
  });
  it('食べ過ぎればマイナス', () => {
    expect(dailyDeficit(1500, 0, 2500)).toBeCloseTo(-700);
  });
});

describe('stepsToKcal', () => {
  it('10000歩・70kgで約322kcal', () => {
    // 7km ÷ 4.8km/h = 1.458h, 3.0 × 70 × 1.458 × 1.05 ≈ 321.6
    expect(stepsToKcal(10000, 70)).toBeCloseTo(321.6, 0);
  });
  it('0歩は0kcal', () => {
    expect(stepsToKcal(0, 70)).toBe(0);
  });
});

describe('kcalToSteps', () => {
  it('stepsToKcalの逆算になっている', () => {
    const steps = kcalToSteps(stepsToKcal(10000, 70), 70);
    expect(steps).toBeCloseTo(10000, 5);
  });
  it('0kcal以下は0歩', () => {
    expect(kcalToSteps(0, 70)).toBe(0);
    expect(kcalToSteps(-10, 70)).toBe(0);
  });
});

describe('metsToKcal', () => {
  it('体重60kgでクロール(8.3METs)30分は約262kcal', () => {
    expect(metsToKcal(8.3, 60, 30)).toBeCloseTo(261.45, 1);
  });

  it('時間・体重・強度のどれかが0以下なら0', () => {
    expect(metsToKcal(8.3, 60, 0)).toBe(0);
    expect(metsToKcal(8.3, 0, 30)).toBe(0);
    expect(metsToKcal(0, 60, 30)).toBe(0);
  });
});

describe('pickReferenceWeight', () => {
  const weights = [
    { date: '2026-07-01', kg: 70 },
    { date: '2026-07-10', kg: 68 },
  ];

  it('当日の記録を最優先する', () => {
    expect(pickReferenceWeight(weights, '2026-07-10')).toBe(68);
  });

  it('当日が無ければそれ以前の最新を使う', () => {
    expect(pickReferenceWeight(weights, '2026-07-05')).toBe(70);
  });

  it('その日以前が無ければ全体の最新で代用する', () => {
    expect(pickReferenceWeight(weights, '2026-06-01')).toBe(68);
  });

  it('1件も無ければundefined', () => {
    expect(pickReferenceWeight([], '2026-07-10')).toBeUndefined();
  });
});
