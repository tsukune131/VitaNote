/**
 * App内課金(SelfCareNote Pro)のプロモーション画像を組み立てる。
 *
 *   node store/make-promo.mjs
 *
 * App Store Connect の要件: JPG/PNG・1024x1024・72dpi・RGB・
 * アルファなし(flattened)・角丸なし。
 *
 * 画面のスクリーンショットは使わない。プロモーション画像は全ての国と地域で
 * 同じものが出るので、購入ボタンや特定通貨の価格が写り込んでいると価格改定の
 * たびに差し替えになる。何が手に入るかだけを描く。
 *
 * 紙面の色と方眼は src/index.css のライトテーマに合わせてある
 * (store/make-screenshots.mjs と同じ手帳の見た目)。
 */
import sharp from 'sharp';

const S = 1024;

const PAPER = '#f5f5f0';
const GRID = '#e7e9e2';
const CARD = '#fffefb';
const INK = '#33362f';
const MUTED = '#8b9085';
const ACCENT = '#cf4a41';
const BORDER = '#e0e2da';

const FONT = 'Yu Gothic UI, Meiryo, Hiragino Sans, sans-serif';

const TITLE = ['健診の数値も、', '同じ手帳に。'];
const ITEMS = [
  '血液検査の結果を、検査日ごとに記録',
  '血圧と血糖値を、グラフで振り返る',
  '買い切り。一度買えば期限はありません',
];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 方眼紙の下地。24pxごとの罫線はアプリの紙面と同じ間隔 */
function grid() {
  const lines = [];
  for (let x = 0; x < S; x += 24) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${S}" stroke="${GRID}" stroke-width="1"/>`);
  }
  for (let y = 0; y < S; y += 24) {
    lines.push(`<line x1="0" y1="${y}" x2="${S}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
  }
  return lines.join('');
}

/** 朱色の見出しタグ。課金であることを最初に見せる */
function badge(x, y) {
  const w = 232;
  const h = 62;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="31" ry="31" fill="${ACCENT}"/>
    <text x="${x + w / 2}" y="${y + 43}" font-family="${FONT}" font-size="34" font-weight="700"
          fill="#fffefb" text-anchor="middle" letter-spacing="2">追加機能 Pro</text>`;
}

/** 箇条書き1行。行頭は朱色の小さな点 */
function item(text, x, y) {
  return `
    <circle cx="${x + 9}" cy="${y - 12}" r="9" fill="${ACCENT}"/>
    <text x="${x + 40}" y="${y}" font-family="${FONT}" font-size="38" fill="${INK}">${esc(text)}</text>`;
}

const svg = `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${S}" height="${S}" fill="${PAPER}"/>
  ${grid()}

  <!-- 手帳のページ。紙の上に1枚置いた見え方にする -->
  <rect x="64" y="64" width="896" height="896" rx="24" ry="24"
        fill="${CARD}" stroke="${BORDER}" stroke-width="2"/>
  <!-- 綴じ側の朱の線 -->
  <rect x="64" y="64" width="10" height="896" rx="5" ry="5" fill="${ACCENT}" opacity="0.85"/>

  ${badge(136, 152)}

  <text x="136" y="336" font-family="${FONT}" font-size="72" font-weight="700" fill="${INK}">${esc(TITLE[0])}</text>
  <text x="136" y="432" font-family="${FONT}" font-size="72" font-weight="700" fill="${INK}">${esc(TITLE[1])}</text>
  <line x1="136" y1="484" x2="256" y2="484" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round"/>

  ${ITEMS.map((t, i) => item(t, 136, 590 + i * 84)).join('')}

  <line x1="136" y1="836" x2="888" y2="836" stroke="${BORDER}" stroke-width="2"/>
  <text x="136" y="898" font-family="${FONT}" font-size="34" fill="${MUTED}">SelfCareNote ・ 体重とお薬と健診の手帳</text>
</svg>`;

const out = 'store/promo-pro-1024.png';

await sharp(Buffer.from(svg))
  .flatten({ background: PAPER }) // アルファを落とす
  .removeAlpha() // 3チャンネル(RGB)で書き出す
  .withMetadata({ density: 72 })
  .png()
  .toFile(out);

const m = await sharp(out).metadata();
console.log(`${out}  ${m.width}x${m.height}  ${m.channels}ch  ${m.density}dpi  alpha=${m.hasAlpha}`);
