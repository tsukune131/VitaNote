import { describe, expect, it } from 'vitest';
import { FOOD_PRESETS } from '../data/foodPresets';
import { applyPortion, normalize, searchFoods } from './foodSearch';

describe('normalize', () => {
  it('カタカナをひらがなに寄せる', () => {
    expect(normalize('カレー')).toBe(normalize('かれー').replace('ー', ''));
  });
  it('記号と空白を落とす', () => {
    expect(normalize('カレー ライス')).toBe(normalize('カレーライス'));
    expect(normalize('ご飯(大盛)')).toBe(normalize('ご飯大盛'));
  });
  it('全角英数を半角にする', () => {
    expect(normalize('ＢＬＴ')).toBe('blt');
  });
});

describe('searchFoods', () => {
  it('空クエリでは何も返さない', () => {
    expect(searchFoods('')).toEqual([]);
    expect(searchFoods('   ')).toEqual([]);
  });

  it('カタカナでもひらがなでも同じ料理に当たる', () => {
    const a = searchFoods('カレーライス')[0];
    const b = searchFoods('かれーらいす')[0];
    expect(a.name).toBe('カレーライス');
    expect(b.name).toBe('カレーライス');
  });

  it('部分入力で候補が出る', () => {
    const names = searchFoods('カレー').map((f) => f.name);
    expect(names).toContain('カレーライス');
    expect(names).toContain('カツカレー');
  });

  it('完全一致を最上位に出す', () => {
    expect(searchFoods('ご飯')[0].name).toBe('ご飯');
    expect(searchFoods('ラーメン(味噌)')[0].name).toBe('ラーメン(味噌)');
  });

  it('漢字の料理名を読みで引ける', () => {
    expect(searchFoods('からあげ')[0].name).toBe('唐揚げ');
    expect(searchFoods('ぎょうざ')[0].name).toBe('餃子');
  });

  it('limitを超えない', () => {
    expect(searchFoods('ご', 5).length).toBeLessThanOrEqual(5);
  });

  it('該当なしなら空', () => {
    expect(searchFoods('zzzzどこにもない料理')).toEqual([]);
  });
});

describe('FOOD_PRESETS', () => {
  it('パースできている', () => {
    expect(FOOD_PRESETS.length).toBeGreaterThan(400);
  });

  it('全件が正のkcalと単位とカテゴリを持つ', () => {
    for (const f of FOOD_PRESETS) {
      expect(f.kcal, f.name).toBeGreaterThan(0);
      expect(Number.isFinite(f.kcal), f.name).toBe(true);
      expect(f.unit, f.name).toBeTruthy();
      expect(f.cat, f.name).toBeTruthy();
    }
  });

  it('kcalが現実的な範囲に収まっている', () => {
    for (const f of FOOD_PRESETS) {
      expect(f.kcal, f.name).toBeLessThanOrEqual(1500);
    }
  });

  it('名前が重複していない', () => {
    const names = FOOD_PRESETS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('よみがひらがな・英数のみ', () => {
    for (const f of FOOD_PRESETS) {
      expect(f.kana, `${f.name} の読み`).toMatch(/^[ぁ-んー0-9a-zA-Z/]+$/);
    }
  });
});

describe('applyPortion', () => {
  it('倍率をかけて丸める', () => {
    expect(applyPortion(700, 1)).toBe(700);
    expect(applyPortion(700, 0.7)).toBe(490);
    expect(applyPortion(235, 1.5)).toBe(353);
  });
});
