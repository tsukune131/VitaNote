import { describe, expect, it } from 'vitest';
import { dayOfMonthOf, isLastDayOfMonth, weekdayOf } from './date';

describe('weekdayOf', () => {
  it('2026-07-19は日曜日', () => {
    expect(weekdayOf('2026-07-19')).toBe(0);
  });
  it('2026-07-20は月曜日', () => {
    expect(weekdayOf('2026-07-20')).toBe(1);
  });
});

describe('dayOfMonthOf', () => {
  it('日にちを取り出す', () => {
    expect(dayOfMonthOf('2026-07-19')).toBe(19);
    expect(dayOfMonthOf('2026-02-01')).toBe(1);
  });
});

describe('isLastDayOfMonth', () => {
  it('31日ある月の月末を判定', () => {
    expect(isLastDayOfMonth('2026-07-31')).toBe(true);
    expect(isLastDayOfMonth('2026-07-30')).toBe(false);
  });
  it('2月(平年28日)の月末を判定', () => {
    expect(isLastDayOfMonth('2026-02-28')).toBe(true);
    expect(isLastDayOfMonth('2026-02-27')).toBe(false);
  });
});
