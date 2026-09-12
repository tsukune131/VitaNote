/**
 * デザイン検討用に、実機ショットから寄りの切り出しを作る。
 *
 *   node store/canvas/prep-assets.mjs
 *
 * 切り出し範囲は photo/ の実機ショット(1206x2622)を目で見て決めた値。
 * キャンバスに載せる下絵なので、寸法も画質も本番より落としてある。
 */
import sharp from 'sharp';
import { statSync } from 'node:fs';

const PAPER = { r: 245, g: 245, b: 240 };

/** 単純な切り出し */
const JOBS = [
  // 1枚目: 全画面(ステータスバーだけ落とす)
  { out: 'screen-today.jpg', src: 'IMG_2493.PNG', left: 0, top: 131, width: 1206, height: 2622 - 131, w: 520, q: 72 },
  // 3枚目: カレンダーの日ごとの表。通院・ジム・旅行のメモが並ぶところ
  { out: 'calendar-table.jpg', src: 'IMG_2495.PNG', left: 39, top: 1349, width: 1127, height: 1022, w: 760, q: 80 },
  // 4枚目: 体重・腹囲の二軸グラフのカードだけ。
  // IMG_2683 は近似直線が入った 1.3 のビルドで撮り直したもの
  // (グラフのフォーカス枠を消した後。目標を73kgにして縦軸を締めてある)
  { out: 'graph-card.jpg', src: 'IMG_2683.PNG', left: 39, top: 642, width: 1127, height: 1015, w: 760, q: 80 },
  // 5枚目: 血液検査9項目の表。注意書きと「基準範囲の出典」まで入れる(審査メモとの整合)
  { out: 'blood-card.jpg', src: 'IMG_2496.PNG', left: 39, top: 498, width: 1127, height: 1218, w: 700, q: 78 },
];

for (const j of JOBS) {
  await sharp(`photo/${j.src}`)
    .extract({ left: j.left, top: j.top, width: j.width, height: j.height })
    .resize(j.w)
    .jpeg({ quality: j.q, chromaSubsampling: '4:4:4' })
    .toFile(`store/canvas/${j.out}`);
  const m = await sharp(`store/canvas/${j.out}`).metadata();
  console.log(`${j.out}  ${m.width}x${m.height}  ${(statSync(`store/canvas/${j.out}`).size / 1024).toFixed(0)}KB`);
}

/**
 * 2枚目: 朝・昼・夕のお薬の欄だけを切り出して縦に積む。
 * 実機では3枚のカードに分かれていて画面に一度に収まらないが、
 * 「朝✓ 昼✓ 夕☐」が1枚で見えると、何をするアプリか一目で分かる。
 * 3つとも同じ幅で切り、間に紙の色の隙間を入れて並べている。
 */
const STRIP_X = 111;
const STRIP_W = 983;
const STRIP_H = 184;
const STRIP_TOPS = [661, 1379, 2100]; // 朝食のお薬 / 昼食のお薬 / 夕食のお薬
const GAP = 18;

const strips = await Promise.all(
  STRIP_TOPS.map((top) =>
    sharp('photo/IMG_2494.PNG')
      .extract({ left: STRIP_X, top, width: STRIP_W, height: STRIP_H })
      .png()
      .toBuffer(),
  ),
);

// sharp は composite より先に resize を適用するので、
// 貼り合わせと縮小はパイプを分ける(同じ鎖に置くと下地だけ先に縮んで弾かれる)
const stacked = await sharp({
  create: {
    width: STRIP_W,
    height: STRIP_H * 3 + GAP * 2,
    channels: 3,
    background: PAPER,
  },
})
  .composite(strips.map((input, i) => ({ input, left: 0, top: (STRIP_H + GAP) * i })))
  .png()
  .toBuffer();

await sharp(stacked)
  .resize(760)
  .jpeg({ quality: 82, chromaSubsampling: '4:4:4' })
  .toFile('store/canvas/med-strips.jpg');

{
  const m = await sharp('store/canvas/med-strips.jpg').metadata();
  console.log(`med-strips.jpg  ${m.width}x${m.height}  ${(statSync('store/canvas/med-strips.jpg').size / 1024).toFixed(0)}KB`);
}
