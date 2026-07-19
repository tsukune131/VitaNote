import { describe, expect, it } from 'vitest';
import { tipForDate } from './tips';

describe('tipForDate', () => {
  it('同じ日付なら常に同じひとことを返す', () => {
    expect(tipForDate('2026-07-19')).toBe(tipForDate('2026-07-19'));
  });

  it('日付が変わるとひとことも変わりうる(30日間で複数種類出る)', () => {
    const tips = new Set(
      Array.from({ length: 30 }, (_, i) =>
        tipForDate(`2026-07-${String(i + 1).padStart(2, '0')}`),
      ),
    );
    expect(tips.size).toBeGreaterThan(5);
  });

  it('季節外のひとことは出ない(7月に冬のネタが出ない)', () => {
    for (let d = 1; d <= 31; d++) {
      const tip = tipForDate(`2026-07-${String(d).padStart(2, '0')}`);
      expect(tip).not.toContain('鍋');
      expect(tip).not.toContain('年末年始');
    }
  });

  it('常に空でない文字列を返す', () => {
    expect(tipForDate('2026-01-01').length).toBeGreaterThan(0);
    expect(tipForDate('2026-12-31').length).toBeGreaterThan(0);
  });

  it('服薬管理オフの人には薬のひとことが出ない', () => {
    for (let d = 1; d <= 31; d++) {
      const tip = tipForDate(`2026-07-${String(d).padStart(2, '0')}`, false);
      expect(tip).not.toContain('薬');
    }
  });

  it('服薬管理オンなら薬のひとことも候補に入る(1年でどこかで出る)', () => {
    const dates: string[] = [];
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        dates.push(`2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }
    expect(dates.some((date) => tipForDate(date, true).includes('薬'))).toBe(true);
  });
});
