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
import { mkdir, readdir, unlink } from 'node:fs/promises';

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

/**
 * 帯の高さ(基準の版面での値)。スクリーンショットはこの下に置く。
 * 見出しを2行に割って大きく見せるぶん、以前より厚くとってある。
 */
const BASE_BAND = 770;
/**
 * 載せるスクリーンショットの幅(元は1206px)。
 * 帯を主役にしたいので、画面そのものは小さめに置いて周りに紙を残す。
 */
const BASE_SHOT_W = 900;

/**
 * lead / punch は見出しの1行目と2行目。2行に割って、言いたいほう(punch)だけを
 * 大きく朱色にする。1本の <text> の中で色を変えると版面の中央揃えが崩れるので、
 * 行ごとに分けて中央に置いている。
 *
 * top/bottom は元画像の高さに対する割合で、切り出す範囲。
 * 既定でステータスバー(時刻・電池)を落とす。アプリの中身だけを見せたいので、
 * 端末の情報は要らない。空白が続く画面は bottom で詰める。
 */
const SHOTS = [
  // 1枚目は一覧で最初に目に入る。機能ではなくアプリ全体の約束を置く。
  // 「書きたいものだけでいい」は、続けられるか不安な人に向けた一番の口説き文句
  // 1・4・5枚目は 2026-08-11 に撮り直し。1.4.1対応で入れた出典リンクと医師相談の行、
  // 歩行の前提(時速4.0km)、血液検査の基準値(尿酸2.1〜7.0 / eGFR 60.0以上)が写っている必要がある。
  // 2・3枚目は写っているものが変わっていないので据え置き。
  // TestFlightから起動して撮ったので、ステータスバーに「◀ TestFlight」の行が入る。
  // 既定の切り取りでは残るため、この1枚だけ深めに落とす
  { file: 'IMG_2487.PNG', lead: 'バラバラだった記録が、', punch: '1冊のノートに', sub: '体重・食事・お薬・健診。書きたいものだけでいい', top: 0.062 },
  { file: 'IMG_2423.PNG', lead: '「飲んだっけ？」を、', punch: 'もう迷わない', sub: '食前・食後、週1回・月1回も。翌日も自動で引き継ぎ', top: 0.062 },
  { file: 'IMG_2430.PNG', lead: '毎朝の1行が、', punch: '1本の線になる', sub: '体重・腹囲・体脂肪率・歩数をグラフで' },
  { file: 'IMG_2485.PNG', lead: '健康の記録が、', punch: 'そのまま予定表に', sub: '通院やジムの予定を1日1行でメモ。歩数はiPhone連携' },
  // 表の下は空くが、切り詰めると表そのものが途中で切れて据わりが悪い。
  // アプリの実際の見え方でもあるので、そのまま全画面で見せる
  { file: 'IMG_2486.PNG', lead: '健診でもらった数値も、', punch: '同じノートに', sub: '血液検査9項目と血圧・血糖値(Pro・買い切り)' },
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

/**
 * 文字列のおおよその幅。全角は1文字ぶん、半角はその半分強で数える。
 * 添え書きを囲む札の幅を決めるだけなので、この精度で足りる。
 */
function textWidth(s, size) {
  let n = 0;
  for (const ch of s) n += /[\x20-\x7e]/.test(ch) ? 0.55 : 1;
  return n * size;
}

/**
 * 上の帯。目に入る順に、通し番号の丸 → 前置き → 言いたいこと → 添え書き。
 * 2行目だけを大きく朱色にして、紙の落ち着きは残したままメリハリを付ける。
 */
function caption({ lead, punch, sub }, no, W, BAND) {
  // 版面が小さいほうでは、余白も文字も同じ比で縮める
  const k = W / BASE_W;
  const r = (n) => Math.round(n * k);
  const cx = W / 2;

  // 添え書きの札。文字幅に合わせて左右に同じ余白を付ける
  const subSize = r(46);
  const padX = r(40);
  const pillW = Math.round(textWidth(sub, subSize)) + padX * 2;
  const pillH = r(98);
  const pillY = r(650) - Math.round(pillH / 2);

  return Buffer.from(
    `<svg width="${W}" height="${BAND}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${r(160)}" r="${r(120)}" fill="${ACCENT}"/>
      <text x="${cx}" y="${r(200)}" font-family="${FONT}" font-size="${r(108)}" font-weight="700"
            fill="${PAPER}" text-anchor="middle">${no}</text>
      <text x="${cx}" y="${r(400)}" font-family="${FONT}" font-size="${r(70)}" font-weight="600"
            fill="${MUTED}" text-anchor="middle">${esc(lead)}</text>
      <text x="${cx}" y="${r(530)}" font-family="${FONT}" font-size="${r(112)}" font-weight="700"
            fill="${ACCENT}" text-anchor="middle">${esc(punch)}</text>
      <rect x="${cx - pillW / 2}" y="${pillY}" width="${pillW}" height="${pillH}"
            rx="${Math.round(pillH / 2)}" ry="${Math.round(pillH / 2)}"
            fill="${CARD}" stroke="${BORDER}" stroke-width="2"/>
      <text x="${cx}" y="${pillY + Math.round(pillH / 2 + subSize * 0.36)}" font-family="${FONT}"
            font-size="${subSize}" fill="${INK}" text-anchor="middle">${esc(sub)}</text>
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

/** 今回の SHOTS から作られる出力ファイル名 */
function outNames() {
  return SHOTS.map(
    (s, i) => `${String(i + 1).padStart(2, '0')}-${s.file.replace(/\.PNG$/i, '')}.png`,
  );
}

for (const { W, H, dir } of SIZES) {
  await mkdir(dir, { recursive: true });

  // 出力名は元写真に紐づくので、撮り直すと前の組が残って枚数が増える。
  // 5枚選ぶときに古いほうを掴む事故が起きるため、SHOTSに無いものはここで消す。
  const keep = new Set(outNames());
  for (const name of await readdir(dir)) {
    if (name.endsWith('.png') && !keep.has(name)) {
      await unlink(`${dir}/${name}`);
      console.log(`removed ${dir}/${name}`);
    }
  }

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

    // 縦は帯の下の余白に対して中央。ただし空きすぎると帯と画面が離れて見えるので、
    // 帯の直下に空ける分には上限を設ける(余った紙は下にまわす)
    const top = BAND + Math.min(Math.round((area - visibleH) / 2), Math.round((80 * W) / BASE_W));

    const out = `${dir}/${String(i + 1).padStart(2, '0')}-${shot.file.replace(/\.PNG$/i, '')}.png`;
    await sharp(background(W, H))
      .composite([
        { input: caption(shot, i + 1, W, BAND), top: 0, left: 0 },
        { input: card, top, left: Math.round((W - SHOT_W) / 2) },
      ])
      .removeAlpha() // 3チャンネル(RGB)で書き出す。アルファ付きは弾かれる
      .png()
      .toFile(out);

    const check = await sharp(out).metadata();
    console.log(`${out}  ${check.width}x${check.height}  ${check.channels}ch  ${shot.lead}${shot.punch}`);
  }
}
