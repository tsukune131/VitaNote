import { describe, expect, it } from 'vitest';
import { readStepsParam } from './stepsImport';

describe('readStepsParam', () => {
  it('stepsパラメータを読み取る(日付省略時は今日)', () => {
    expect(readStepsParam('?steps=7842', '2026-07-19')).toEqual({
      steps: 7842,
      date: '2026-07-19',
    });
  });
  it('日付指定があればその日として取り込む', () => {
    expect(readStepsParam('?steps=100&date=2026-07-18', '2026-07-19')).toEqual({
      steps: 100,
      date: '2026-07-18',
    });
  });
  it('不正な日付は無視して今日にする', () => {
    expect(readStepsParam('?steps=100&date=abc', '2026-07-19')?.date).toBe('2026-07-19');
  });
  it('小数は丸める', () => {
    expect(readStepsParam('?steps=100.6', '2026-07-19')?.steps).toBe(101);
  });
  it('無効な値はundefined', () => {
    expect(readStepsParam('?steps=0')).toBeUndefined();
    expect(readStepsParam('?steps=-5')).toBeUndefined();
    expect(readStepsParam('?steps=abc')).toBeUndefined();
    expect(readStepsParam('')).toBeUndefined();
  });
});
