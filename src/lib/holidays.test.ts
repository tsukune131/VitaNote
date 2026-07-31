import { describe, expect, it } from 'vitest';
import { holidayName, isHoliday } from './holidays';

describe('holidayName', () => {
  it('日付が決まっている祝日', () => {
    expect(holidayName('2026-01-01')).toBe('元日');
    expect(holidayName('2026-02-11')).toBe('建国記念の日');
    expect(holidayName('2026-02-23')).toBe('天皇誕生日');
    expect(holidayName('2026-08-11')).toBe('山の日');
    expect(holidayName('2026-11-23')).toBe('勤労感謝の日');
  });

  it('ハッピーマンデーはその月のn番目の月曜', () => {
    expect(holidayName('2026-01-12')).toBe('成人の日');
    expect(holidayName('2026-07-20')).toBe('海の日');
    expect(holidayName('2026-09-21')).toBe('敬老の日');
    expect(holidayName('2026-10-12')).toBe('スポーツの日');
  });

  it('春分・秋分は年ごとに動く', () => {
    expect(holidayName('2026-03-20')).toBe('春分の日');
    expect(holidayName('2026-09-23')).toBe('秋分の日');
    expect(holidayName('2025-03-20')).toBe('春分の日');
    expect(holidayName('2025-09-23')).toBe('秋分の日');
  });

  it('日曜と重なると次の平日が振替休日になる', () => {
    // 2026年の憲法記念日は日曜。5/4・5/5を飛ばして5/6が振替
    expect(holidayName('2026-05-03')).toBe('憲法記念日');
    expect(holidayName('2026-05-06')).toBe('振替休日');
  });

  it('祝日に挟まれた平日は国民の休日', () => {
    // 2026年9月は敬老の日(21日)と秋分の日(23日)に挟まれる
    expect(holidayName('2026-09-22')).toBe('国民の休日');
  });

  it('五輪で移動した2021年', () => {
    expect(holidayName('2021-07-22')).toBe('海の日');
    expect(holidayName('2021-07-23')).toBe('スポーツの日');
    expect(holidayName('2021-08-08')).toBe('山の日');
    expect(holidayName('2021-08-09')).toBe('振替休日');
    expect(isHoliday('2021-07-19')).toBe(false); // 例年の海の日(第3月曜)
  });

  it('祝日でない日', () => {
    expect(holidayName('2026-08-01')).toBeUndefined();
    expect(isHoliday('2026-08-03')).toBe(false);
  });
});
