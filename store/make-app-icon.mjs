/**
 * iOSのAppアイコンを焼く。
 *
 *   node store/make-app-icon.mjs
 *
 * 元絵は public/favicon.svg (方眼に折れ線と朱のチェック)。PWAとiOSで同じ絵を
 * 使うが、iOSに入れるものだけ2点変える:
 *
 *   - 角丸を外す。iOSが自前でマスクをかけるので、角丸付きを入れると
 *     二重に丸まって縁が欠ける
 *   - アルファを落とす。透過を含むAppアイコンはアップロードで弾かれる
 *
 * PWA側(public/pwa-*.png, apple-touch-icon.png)は角丸のままで正しいので触らない。
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const SRC = 'public/favicon.svg';
const OUT = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';

/** App Store Connectが受け取るAppアイコンの寸法 */
const S = 1024;

const svg = await readFile(SRC, 'utf8');

// 角丸を落とす。下地の矩形に付いている rx だけが対象で、他の図形には rx は無い
const squared = svg.replace(/(<rect[^>]*?)\s+rx="\d+"/, '$1');
if (squared === svg) {
  console.error(`${SRC} に角丸の指定が見つからない。元絵の構造が変わっていないか確認すること`);
  process.exit(1);
}

await sharp(Buffer.from(squared), { density: 384 }) // 512の版を1024で焼くので2倍以上の解像度で読む
  .resize(S, S)
  .flatten({ background: '#f7f7f3' }) // 下地の紙の色。アルファを落とす
  .removeAlpha() // 3チャンネル(RGB)で書き出す
  .png()
  .toFile(OUT);

const m = await sharp(OUT).metadata();
console.log(`${OUT}  ${m.width}x${m.height}  ${m.channels}ch  alpha=${m.hasAlpha}`);
