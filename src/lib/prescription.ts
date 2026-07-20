/**
 * 「きょうの処方箋」の表示状態を決める純関数。
 *
 * 夕食が入るまではその日の摂取が確定しないので、決着前は「あと何kcal食べられるか」の
 * 予算表示、夕食を入れたら「達成/オーバー」の結果表示に切り替える。
 * オーバーが確定した後は無理な運動を促さず翌日に送る(夕食後にできることは少ないため)。
 */
export type PrescriptionView =
  | { kind: 'need-record' } // 食事・体重が未記録で貯金が出せない
  | { kind: 'budget-ok'; budget: number } // 夕食前・まだ食べる余裕がある
  | { kind: 'budget-over'; over: number } // 夕食前・このままだとオーバー(まだ間に合う)
  | { kind: 'achieved' } // 夕食後・目標達成
  | { kind: 'over'; over: number }; // 夕食後・オーバー確定(翌日調整)

export function prescriptionView(
  deficit: number | undefined,
  required: number,
  dinnerLogged: boolean,
): PrescriptionView {
  if (deficit == null) return { kind: 'need-record' };
  const budget = deficit - required;
  if (!dinnerLogged) {
    return budget >= 0 ? { kind: 'budget-ok', budget } : { kind: 'budget-over', over: -budget };
  }
  return budget >= 0 ? { kind: 'achieved' } : { kind: 'over', over: -budget };
}
