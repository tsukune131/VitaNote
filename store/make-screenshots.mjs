/**
 * App Store 用のスクリーンショットを組み立てる。
 *
 *   node store/make-screenshots.mjs
 *
 * photo/ に入れた実機のスクリーンショット(1206x2622 = 6.3インチ)を、
 * App Store Connect が要求する 6.9インチ枠 1320x2868 の紙面に載せ、
 * 上にキャプションの帯を置く。
 *
 * 切り取って寸法を変えるとアップロードで弾かれるが、所定の寸法の
 * キャンバスに載せるぶんには自由。撮り直さずに枠を合わせられる。
 *
 * 紙面の色と方眼は src/index.css のライトテーマに合わせてある。
 *
 * photo/ は .gitignore に入れている。実機の記録がそのまま写っているので、
 * 公開リポジトリには置かない。ストアに出す組み上がりだけを store/screenshots/
 * に残す(こちらはどのみち App Store で公開されるもの)。
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

/**
 * 出力する紙面。6.9インチだけが必須で、6.5インチは任意。
 * 6.5インチの枠にも出したいときのために両方作る。
 *
 * 6.5インチには 1242x2688 と 1284x2778 の2つが認められているが、
 * どちらか一方を5枚揃えればよい。縦横比が6.9インチに近い後者を使う
 * (帯とスクリーンショットの比率をそのまま縮められる)。
 */
const SIZES = [
  { W: 1320, H: 2868, dir: 'store/screenshots' },
  { W: 1284, H: 2778, dir: 'store/screenshots-65' },
];

/** 版面の基準。ここからの比で他の寸法の余白と文字を決める */
const BASE_W = 1320;

const PAPER = '#f5f5f0';
const GRID = '#e7e9e2';
const INK = '#33362f';
const MUTED = '#8b9085';
const ACCENT = '#cf4a41';
const CARD = '#fffefb';
const BORDER = '#e0e2da';

const FONT = 'Yu Gothic UI, Meiryo, Hiragino Sans, sans-serif';

/** 帯の高さ(基準の版面での値)。スクリーンショットはこの下に置く */
const BASE_BAND = 430;
/** 載せるスクリーンショットの幅(元は1206px。少し縮めて余白を作る) */
const BASE_SHOT_W = 1080;

/**
 * top/bottom は元画像の高さに対する割合で、切り出す範囲。
 * 既定でステータスバー(時刻・電池)を落とす。アプリの中身だけを見せたいので、
 * 端末の情報は要らない。空白が続く画面は bottom で詰める。
 */
const SHOTS = [
  { file: 'IMG_2422.PNG', title: '体重とお薬を、1冊にまとめて', sub: '朝の体重も、飲んだお薬も、同じ手帳に' },
  { file: 'IMG_2423.PNG', title: '飲んだかどうかを、その場で', sub: '食前・食後、週1回や月1回のお薬にも', top: 0.062 },
  { file: 'IMG_2430.PNG', title: '続けた分だけ、線になる', sub: '体重と腹囲を重ねて、1か月をひと目で' },
  { file: 'IMG_2427.PNG', title: '1か月を、1日1行で見渡す', sub: '歩数は自動。通院やジムの予定も書ける' },
  // 表の下は空くが、切り詰めると表そのものが途中で切れて据わりが悪い。
  // アプリの実際の見え方でもあるので、そのまま全画面で見せる
  { file: 'IMG_2421.PNG', title: '健診の数値も、同じ手帳に', sub: '血液検査と血圧・血糖値(Pro)' },
];

const DEFAULT_TOP = 0.045;

/** 方眼紙の下地。24pxごとの罫線はアプリの紙面と同じ間隔 */
function background(W, H) {
  const lines = [];
  for (let x = 0; x < W; x += 24) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID}" stroke-width="1"/>`);
  }
  for (let y = 0; y < H; y += 24) {
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
  }
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="${PAPER}"/>
      ${lines.join('')}
    </svg>`,
  );
}

/** 上の帯: 見出し・小さな添え書き・朱色の下線 */
function caption(title, sub, W, BAND) {
  // 版面が小さいほうでは、余白も文字も同じ比で縮める
  const k = W / BASE_W;
  const r = (n) => Math.round(n * k);
  return Buffer.from(
    `<svg width="${W}" height="${BAND}" xmlns="http://www.w3.org/2000/svg">
      <text x="${W / 2}" y="${r(196)}" font-family="${FONT}" font-size="${r(70)}" font-weight="700"
            fill="${INK}" text-anchor="middle">${esc(title)}</text>
      <line x1="${W / 2 - r(60)}" y1="${r(238)}" x2="${W / 2 + r(60)}" y2="${r(238)}"
            stroke="${ACCENT}" stroke-width="${r(5)}" stroke-linecap="round"/>
      <text x="${W / 2}" y="${r(308)}" font-family="${FONT}" font-size="${r(38)}"
            fill="${MUTED}" text-anchor="middle">${esc(sub)}</text>
    </svg>`,
  );
}

/** 角丸の切り抜き。手帳に写真を貼ったように見せる */
function roundedMask(w, h, r = 44) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/>
    </svg>`,
  );
}

/** 角丸の縁取り(紙とスクリーンショットの境目をはっきりさせる) */
function frame(w, h, r = 44) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" ry="${r}"
            fill="none" stroke="${BORDER}" stroke-width="2"/>
    </svg>`,
  );
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

for (const { W, H, dir } of SIZES) {
  await mkdir(dir, { recursive: true });

  const BAND = Math.round((BASE_BAND * W) / BASE_W);
  const SHOT_W = Math.round((BASE_SHOT_W * W) / BASE_W);

  for (const [i, shot] of SHOTS.entries()) {
    const meta = await sharp(`photo/${shot.file}`).metadata();

    // 元画像のうち使う範囲を切り出してから、幅を揃えて縮める
    const cutTop = Math.round(meta.height * (shot.top ?? DEFAULT_TOP));
    const cutBottom = Math.round(meta.height * (shot.bottom ?? 1));
    const region = { left: 0, top: cutTop, width: meta.width, height: cutBottom - cutTop };

    const resized = await sharp(`photo/${shot.file}`)
      .extract(region)
      .resize(SHOT_W)
      .png()
      .toBuffer();

    const rm = await sharp(resized).metadata();
    // 帯の下に入りきらないときは下端で切る(紙の外へ流れる見せ方)
    const area = H - BAND - Math.round((90 * W) / BASE_W);
    const visibleH = Math.min(rm.height, area);
    const body =
      visibleH === rm.height
        ? resized
        : await sharp(resized).extract({ left: 0, top: 0, width: SHOT_W, height: visibleH }).png().toBuffer();

    const card = await sharp(body)
      .composite([
        { input: roundedMask(SHOT_W, visibleH), blend: 'dest-in' },
        { input: frame(SHOT_W, visibleH), blend: 'over' },
      ])
      .png()
      .toBuffer();

    // 縦は帯の下の余白に対して中央。短い画面でも据わりが悪くならない
    const top = BAND + Math.round((area - visibleH) / 2);

    const out = `${dir}/${String(i + 1).padStart(2, '0')}-${shot.file.replace(/\.PNG$/i, '')}.png`;
    await sharp(background(W, H))
      .composite([
        { input: caption(shot.title, shot.sub, W, BAND), top: 0, left: 0 },
        { input: card, top, left: Math.round((W - SHOT_W) / 2) },
      ])
      .removeAlpha() // 3チャンネル(RGB)で書き出す。アルファ付きは弾かれる
      .png()
      .toFile(out);

    const check = await sharp(out).metadata();
    console.log(`${out}  ${check.width}x${check.height}  ${check.channels}ch  ${shot.title}`);
  }
}
