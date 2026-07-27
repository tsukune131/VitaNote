import { describe, expect, it } from 'vitest';
import { untrackedKcal, withItemAdded, withItemRemoved } from './mealItems';

const カレー = { name: 'カレーライス', kcal: 700 };
const ご飯 = { name: 'ご飯', kcal: 235 };

describe('untrackedKcal', () => {
  it('内訳がなければ合計がまるごと残る', () => {
    expect(untrackedKcal([], 500)).toBe(500);
  });

  it('内訳ぶんを引いた端数を返す', () => {
    expect(untrackedKcal([カレー], 800)).toBe(100);
  });

  it('内訳で合計を満たしていれば0', () => {
    expect(untrackedKcal([カレー, ご飯], 935)).toBe(0);
  });

  it('内訳が合計を超えていても負にしない', () => {
    expect(untrackedKcal([カレー], 100)).toBe(0);
  });
});

describe('withItemAdded', () => {
  it('メニューを足して合計を増やす', () => {
    const r = withItemAdded([], 0, カレー);
    expect(r.items).toEqual([カレー]);
    expect(r.kcal).toBe(700);
  });

  it('既存の合計に上乗せする', () => {
    const r = withItemAdded([カレー], 700, ご飯);
    expect(r.items).toEqual([カレー, ご飯]);
    expect(r.kcal).toBe(935);
  });

  it('同じメニューを複数回足せる', () => {
    const r = withItemAdded([ご飯], 235, ご飯);
    expect(r.items).toHaveLength(2);
    expect(r.kcal).toBe(470);
  });

  it('元の配列を書き換えない', () => {
    const items = [カレー];
    withItemAdded(items, 700, ご飯);
    expect(items).toEqual([カレー]);
  });
});

describe('withItemRemoved', () => {
  it('メニューを外して合計を減らす', () => {
    const r = withItemRemoved([カレー, ご飯], 935, 0);
    expect(r.items).toEqual([ご飯]);
    expect(r.kcal).toBe(235);
  });

  it('末尾も外せる', () => {
    const r = withItemRemoved([カレー, ご飯], 935, 1);
    expect(r.items).toEqual([カレー]);
    expect(r.kcal).toBe(700);
  });

  it('合計を手で減らしていても負にしない', () => {
    const r = withItemRemoved([カレー], 100, 0);
    expect(r.items).toEqual([]);
    expect(r.kcal).toBe(0);
  });

  it('範囲外の指定では何も変えない', () => {
    const r = withItemRemoved([カレー], 700, 5);
    expect(r.items).toEqual([カレー]);
    expect(r.kcal).toBe(700);
  });

  it('元の配列を書き換えない', () => {
    const items = [カレー, ご飯];
    withItemRemoved(items, 935, 0);
    expect(items).toEqual([カレー, ご飯]);
  });
});
