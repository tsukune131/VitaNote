import { describe, expect, it } from 'vitest';
import { parseSyncInfo, shouldApplyRemote, shouldApplyTombstone } from './sync';

describe('shouldApplyRemote (LWW)', () => {
  it('リモートが新しければ適用する', () => {
    expect(shouldApplyRemote(100, 200)).toBe(true);
  });
  it('ローカルが新しければ適用しない', () => {
    expect(shouldApplyRemote(200, 100)).toBe(false);
  });
  it('同時刻はローカルを守る', () => {
    expect(shouldApplyRemote(100, 100)).toBe(false);
  });
  it('ローカルにタイムスタンプがない(古い行)ならリモートが勝つ', () => {
    expect(shouldApplyRemote(undefined, 1)).toBe(true);
  });
  it('リモートにタイムスタンプがなければ適用しない', () => {
    expect(shouldApplyRemote(100, undefined)).toBe(false);
    expect(shouldApplyRemote(undefined, undefined)).toBe(false);
  });
});

describe('shouldApplyTombstone', () => {
  it('削除の方が新しければローカルの行を消す', () => {
    expect(shouldApplyTombstone(100, 200)).toBe(true);
  });
  it('削除後に作り直された(より新しい)行は守る', () => {
    expect(shouldApplyTombstone(300, 200)).toBe(false);
  });
  it('タイムスタンプのない行は削除される', () => {
    expect(shouldApplyTombstone(undefined, 1)).toBe(true);
  });
});

describe('parseSyncInfo', () => {
  it('JSONを復元する', () => {
    expect(parseSyncInfo('{"at":1,"pushed":2,"pulled":3}')).toEqual({ at: 1, pushed: 2, pulled: 3 });
  });
  it('壊れた値や未設定はundefined', () => {
    expect(parseSyncInfo(undefined)).toBeUndefined();
    expect(parseSyncInfo('not json')).toBeUndefined();
  });
});
