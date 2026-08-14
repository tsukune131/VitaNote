import { describe, expect, it } from 'vitest';
import { dayOfMonthOf, isLastDayOfMonth, rollOverDate, weekdayOf } from './date';

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

describe('rollOverDate', () => {
  it('今日を見ている人は新しい今日へ連れていく', () => {
    // 「きょう」タブを開いたまま日付をまたいだ状態。ここを動かさないと、
    // 翌朝の入力が前日の日付で保存され、連続記録も途切れずに見えてしまう
    expect(rollOverDate('2026-08-13', '2026-08-13', '2026-08-14')).toBe('2026-08-14');
  });

  it('自分で過去の日を開いている人は動かさない', () => {
    expect(rollOverDate('2026-08-10', '2026-08-13', '2026-08-14')).toBe('2026-08-10');
  });

  it('日付が変わっていなければそのまま', () => {
    expect(rollOverDate('2026-08-13', '2026-08-13', '2026-08-13')).toBe('2026-08-13');
    expect(rollOverDate('2026-08-10', '2026-08-13', '2026-08-13')).toBe('2026-08-10');
  });

  it('2日以上またいでも今日に追いつく', () => {
    expect(rollOverDate('2026-08-13', '2026-08-13', '2026-08-16')).toBe('2026-08-16');
  });
});
