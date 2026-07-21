import { FOOD_PRESETS, type FoodPreset } from '../data/foodPresets';

/**
 * 検索キー用の正規化。
 * カタカナ→ひらがな、全角英数→半角、大文字→小文字に寄せ、
 * 記号・空白・長音は落とす("カレー ライス" も "かれーらいす" も同じキーになる)。
 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・()（）ー\-_,、.。]/g, '');
}

/** 検索対象の事前計算済みキー(名前+よみ)。起動時に1度だけ作る */
const INDEX: { food: FoodPreset; keys: string[]; order: number }[] = FOOD_PRESETS.map(
  (food, order) => ({
    food,
    keys: [normalize(food.name), normalize(food.kana)],
    order,
  }),
);

/**
 * スコア。小さいほど上位。
 * 完全一致 < 前方一致 < 部分一致 の順に優先し、同点なら
 * 名前が短いもの(=より一般的な料理名)を上に出す。
 */
function score(keys: string[], q: string, nameLen: number): number | null {
  let best: number | null = null;
  for (const k of keys) {
    let s: number | null = null;
    if (k === q) s = 0;
    else if (k.startsWith(q)) s = 1000;
    else if (k.includes(q)) s = 2000;
    if (s != null && (best == null || s < best)) best = s;
  }
  return best == null ? null : best + nameLen;
}

/** 料理名で候補を引く。クエリが空なら空配列 */
export function searchFoods(query: string, limit = 20): FoodPreset[] {
  const q = normalize(query);
  if (!q) return [];
  const hits: { food: FoodPreset; s: number; order: number }[] = [];
  for (const e of INDEX) {
    const s = score(e.keys, q, e.food.name.length);
    if (s != null) hits.push({ food: e.food, s, order: e.order });
  }
  hits.sort((a, b) => a.s - b.s || a.order - b.order);
  return hits.slice(0, limit).map((h) => h.food);
}

/** 量の倍率。少なめ/普通/大盛 */
export const PORTIONS = [
  { label: '少なめ', mult: 0.7 },
  { label: '普通', mult: 1 },
  { label: '大盛', mult: 1.5 },
] as const;

export function applyPortion(kcal: number, mult: number): number {
  return Math.round(kcal * mult);
}
