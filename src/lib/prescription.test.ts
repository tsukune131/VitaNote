import { describe, expect, it } from 'vitest';
import { prescriptionView } from './prescription';

describe('prescriptionView', () => {
  it('食事・体重が未記録なら案内状態', () => {
    expect(prescriptionView(undefined, 500, false)).toEqual({ kind: 'need-record' });
    expect(prescriptionView(undefined, 500, true)).toEqual({ kind: 'need-record' });
  });

  it('夕食前・余裕あり → 予算(あと何kcal食べられるか)', () => {
    // deficit 800, required 500 → budget 300
    expect(prescriptionView(800, 500, false)).toEqual({ kind: 'budget-ok', budget: 300 });
  });

  it('夕食前・このままだとオーバー → 予算オーバー(まだ間に合う)', () => {
    // deficit 300, required 500 → budget -200
    expect(prescriptionView(300, 500, false)).toEqual({ kind: 'budget-over', over: 200 });
  });

  it('夕食後・達成', () => {
    expect(prescriptionView(600, 500, true)).toEqual({ kind: 'achieved' });
    expect(prescriptionView(500, 500, true)).toEqual({ kind: 'achieved' }); // ちょうどは達成扱い
  });

  it('夕食後・オーバー確定 → 翌日調整', () => {
    // deficit 100, required 500 → over 400
    expect(prescriptionView(100, 500, true)).toEqual({ kind: 'over', over: 400 });
  });

  it('同じ数値でも夕食の有無で予算/結果が切り替わる', () => {
    expect(prescriptionView(300, 500, false).kind).toBe('budget-over');
    expect(prescriptionView(300, 500, true).kind).toBe('over');
  });
});
