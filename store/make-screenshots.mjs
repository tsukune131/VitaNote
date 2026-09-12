/**
 * App Store 用のスクリーンショットを組み立てる(6枚)。
 *
 *   node store/make-screenshots.mjs
 *
 * store/canvas/ のデザインキャンバスで決めた版面を、そのまま実寸で焼く。
 * キャンバスは 440x956 で組んであり、ここでは k = W/440 を全部の数値に掛けている。
 * 版面を直したいときはキャンバス側(store/canvas/*.dc.html)と両方を直すこと。
 *
 * 下絵は store/canvas/*.jpg(prep-assets.mjs が photo/ から切り出したもの)。
 * photo/ は .gitignore 対象で、実機の記録がそのまま写っているため公開しない。
 * 下絵はコミットしてあるので、photo/ が無くてもここは回せる。
 *
 * (2026-09-12: 生成りの紙に朱色の文字だけだった5枚組を差し替えた。旧版の
 *  組み立て script は削除。経緯は appstore-ja.md の「## スクリーンショット」)
 */
import sharp from 'sharp';
import { mkdir, readdir, unlink } from 'node:fs/promises';

/** 6.9インチが必須。6.5インチは任意だが両方作る */
const SIZES = [
  { W: 1320, H: 2868, dir: 'store/screenshots' },
  { W: 1284, H: 2778, dir: 'store/screenshots-65' },
];

/** キャンバスの版面。ここからの比で実寸に伸ばす */
const BASE_W = 440;

const PAPER = '#f5f5f0';
const GRID = '#e7e9e2';
const INK = '#33362f';
const MUTED = '#8b9085';
const ACCENT = '#cf4a41';
const MARKER = '#edb54a';
const CARD = '#fffefb';
const BORDER = '#e0e2da';
const ON_DARK = '#fffefb';

const FONT = 'Yu Gothic UI, Meiryo, Hiragino Sans, sans-serif';

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 文字列のおおよその幅(em単位)。全角は1、半角はその半分強で数える。
 * マーカーの下敷きや札の幅を決めるだけなので、この精度で足りる。
 */
function em(s) {
  let n = 0;
  for (const ch of s) n += /[\x20-\x7e]/.test(ch) ? 0.55 : 1;
  return n;
}

const width = (s, size) => em(s) * size;

/**
 * 文字列を実際に描いて、インクの幅を測る。
 *
 * em() の見積もりは全角=1文字で数えているが、Yu Gothic UI は括弧や
 * カタカナをプロポーショナルで詰めるので、括弧を含む行では1割以上ずれる。
 * 蛍光ペンの下敷きはこのずれがそのまま棒のはみ出しになるため、
 * 下敷きを引く行だけは描いて測る(結果は使い回す)。
 */
const _measured = new Map();
async function measure(text, size, weight = 400) {
  if (text === '') return 0;
  const key = `${weight}|${size}|${text}`;
  const hit = _measured.get(key);
  if (hit !== undefined) return hit;
  const pad = Math.ceil(size);
  const svg = Buffer.from(
    `<svg width="${Math.ceil(width(text, size)) + pad * 4}" height="${Math.ceil(size * 2.4)}"
          xmlns="http://www.w3.org/2000/svg">
       <text x="${pad}" y="${size * 1.5}" font-family="${FONT}" font-size="${size}"
             font-weight="${weight}" fill="#000">${esc(text)}</text>
     </svg>`,
  );
  const { info } = await sharp(svg).trim().toBuffer({ resolveWithObject: true });
  _measured.set(key, info.width);
  return info.width;
}

/** 幅に収まるように折る。日本語は文字単位で折れるので約物だけ避ける */
function wrap(s, size, maxW) {
  const lines = [];
  let cur = '';
  for (const ch of s) {
    const next = cur + ch;
    if (width(next, size) > maxW && cur !== '') {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

/* ------------------------------------------------------------------ */
/* 各コマの中身。位置と大きさはすべて 440x956 の版面での値               */
/* ------------------------------------------------------------------ */

/** 下段の箇条書き(点+1行)を組む */
const bullets = (top, items) => ({ kind: 'bullets', top, items });

const SHOTS = [
  {
    out: '01-note',
    band: ACCENT,
    no: '1',
    kicker: 'SELFCARENOTE',
    lead: '体重・食事・お薬・健診',
    punch: ['ぜんぶ、', '1冊に。'],
    image: { file: 'screen-today.jpg', left: 70, top: 300, w: 300 },
    badge: { left: 246, top: 250, rotate: -5, small: '記録にかかるのは', big: '1日10秒' },
  },
  {
    out: '02-medicine',
    band: INK,
    no: '2',
    kicker: 'おくすりチェック',
    lead: 'もう「飲んだっけ？」と',
    punch: ['言わなくて', 'いい。'],
    image: { file: 'med-strips.jpg', left: 24, top: 300, w: 392 },
    arrow: { left: 20, top: 500 },
    scribble: { left: 154, top: 570, rotate: -3, lines: ['のこりは', '夕食だけ'] },
    mark: { top: 690, plain: '飲んだら', marked: 'タップするだけ。' },
    body: bullets(738, [
      '食前・食後、週1回・月1回のお薬にも',
      '一度登録すれば、翌日も自動で出てきます',
      'お薬手帳と体重アプリを行き来しなくていい',
    ]),
  },
  {
    out: '03-calendar',
    band: ACCENT,
    no: '3',
    kicker: 'カレンダー',
    lead: '歩いた数も、通院の予定も',
    punch: ['1か月が', '1ページ。'],
    image: { file: 'calendar-table.jpg', left: 24, top: 300, w: 392 },
    mark: { top: 690, plain: '歩数は', marked: '書かなくても入ります。' },
    body: bullets(738, [
      'iPhoneのヘルスケアから毎日自動で',
      '数字をタップすれば1時間ごとの内訳も',
      '通院やジムの予定は、先の日付にも書けます',
    ]),
  },
  {
    out: '04-graph',
    band: INK,
    no: '4',
    kicker: 'ふりかえり',
    lead: 'きのう増えた、で凹まない',
    punch: ['見るのは', '流れだけ。'],
    image: { file: 'graph-card.jpg', left: 24, top: 300, w: 392 },
    mark: { top: 690, plain: '日々の上下に', marked: '近似直線を1本。' },
    body: bullets(738, [
      '体重と腹囲をひとつのグラフに重ねて',
      '体脂肪率・歩数・カロリー収支のグラフも',
      '計算式と出典はアプリの中で確認できます',
    ]),
  },
  {
    out: '05-pro',
    band: ACCENT,
    no: '5',
    kicker: 'SELFCARENOTE PRO',
    lead: '去年の健診結果、どこですか',
    punch: ['もう、', '探さない。'],
    image: { file: 'blood-card.jpg', left: 24, top: 300, w: 392 },
    badge: { left: 250, top: 262, rotate: 4, big: '買い切り', small: '月額料金はありません' },
    // 基準範囲の注意書きは画面写真の中に写っているので、ここには重ねない
    mark: { top: 766, plain: '血液検査', marked: '9項目を検査日ごとに。' },
    body: bullets(814, [
      '血圧・血糖値の記録とグラフも Pro に',
      '一度書いた結果は、無料に戻しても読めます',
    ]),
  },
  {
    out: '06-privacy',
    band: INK,
    no: '6',
    kicker: 'データのゆくえ',
    lead: '体のことを書くのだから',
    punch: ['ぜんぶ、', 'ゼロ。'],
    zeros: {
      left: 24,
      top: 300,
      w: 392,
      rows: [
        ['広告', '0'],
        ['アカウント登録', '0'],
        ['外部への送信', '0'],
      ],
    },
    seal: { left: 296, top: 636, lines: ['端末内', '完結'], rotate: -9 },
    mark: { top: 782, plain: '書いたものは', marked: 'この端末から出ません。' },
    note: {
      top: 828,
      lines: [
        [{ t: 'App Store のプライバシー表示は' }],
        [{ t: '「データを収集していません」', bold: true }, { t: 'です。' }],
      ],
    },
    fine: { top: 890, text: '歩数や体重のヘルスケア連携も、端末の中だけで行われます。' },
  },
];

/* ------------------------------------------------------------------ */

/** 方眼紙の下地と、上のベタ塗り。1枚のSVGでまとめて描く */
function backdrop(shot, W, H, k) {
  const step = 8 * k;
  const lines = [];
  for (let x = 0; x < W; x += step) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID}" stroke-width="1"/>`);
  }
  for (let y = 0; y < H; y += step) {
    lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
  }
  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${W}" height="${H}" fill="${PAPER}"/>
       ${lines.join('')}
       <rect x="0" y="0" width="${W}" height="${344 * k}" fill="${shot.band}"/>
     </svg>`,
  );
}

/** 手書き風の矢印(2枚目・夕食の空欄を指す) */
function arrow(k) {
  const s = (n) => n * k;
  return `<g transform="translate(${s(20)} ${s(500)}) scale(${k})">
      <path d="M 122 106 C 96 88, 56 62, 30 20" fill="none" stroke="${ACCENT}"
            stroke-width="3.4" stroke-linecap="round"/>
      <path d="M 20 44 L 28 14 L 51 30" fill="none" stroke="${ACCENT}"
            stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
}

/** 傾けて貼る札。上下2行で、大きいほうを big に置く */
function badge(b, k) {
  const s = (n) => n * k;
  const padX = s(15);
  const bigSize = s(b.big === '買い切り' ? 22 : 27);
  const smallSize = s(13);
  const w = Math.max(width(b.big, bigSize), width(b.small, smallSize)) + padX * 2;
  const padY = s(b.big === '買い切り' ? 10 : 11);
  const h = padY * 2 + bigSize * 1.15 + smallSize * 1.2 + s(1);

  // 大きいほうが上か下かは札ごとに違う(1枚目は下、5枚目は上)
  const bigOnTop = b.big === '買い切り';
  const cx = w / 2;
  const firstSize = bigOnTop ? bigSize : smallSize;
  const secondSize = bigOnTop ? smallSize : bigSize;
  const firstText = bigOnTop ? b.big : b.small;
  const secondText = bigOnTop ? b.small : b.big;
  const y1 = padY + firstSize * 0.86;
  const y2 = y1 + secondSize * 1.05 + s(2);

  return `<g transform="translate(${s(b.left)} ${s(b.top)}) rotate(${b.rotate})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${s(5)}" ry="${s(5)}" fill="${MARKER}"/>
      <text x="${cx}" y="${y1}" font-family="${FONT}" font-size="${firstSize}" font-weight="700"
            fill="${INK}" text-anchor="middle">${esc(firstText)}</text>
      <text x="${cx}" y="${y2}" font-family="${FONT}" font-size="${secondSize}" font-weight="700"
            fill="${INK}" text-anchor="middle">${esc(secondText)}</text>
    </g>`;
}

/** 朱印風の角判(6枚目) */
function seal(sl, k) {
  const s = (n) => n * k;
  const side = s(104);
  const size = s(27);
  return `<g transform="translate(${s(sl.left)} ${s(sl.top)}) rotate(${sl.rotate})">
      <rect x="0" y="0" width="${side}" height="${side}" rx="${s(7)}" ry="${s(7)}"
            fill="${PAPER}" stroke="${ACCENT}" stroke-width="${s(4)}"/>
      <text x="${side / 2}" y="${side / 2 - s(4)}" font-family="${FONT}" font-size="${size}"
            font-weight="700" fill="${ACCENT}" text-anchor="middle"
            letter-spacing="${s(1.6)}">${esc(sl.lines[0])}</text>
      <text x="${side / 2}" y="${side / 2 + s(27)}" font-family="${FONT}" font-size="${size}"
            font-weight="700" fill="${ACCENT}" text-anchor="middle"
            letter-spacing="${s(1.6)}">${esc(sl.lines[1])}</text>
    </g>`;
}

/** 広告0/登録0/送信0 のカード(6枚目) */
function zeros(z, k) {
  const s = (n) => n * k;
  const padX = s(28);
  const labelSize = s(24);
  const numSize = s(66);
  const rowContent = numSize * 0.9;
  const rowH = s(26) * 2 + rowContent;
  const cardH = s(4) + rowH * z.rows.length + s(8);
  const parts = [
    `<rect x="0" y="0" width="${s(z.w)}" height="${cardH}" rx="${s(10)}" ry="${s(10)}"
           fill="${CARD}" stroke="${BORDER}" stroke-width="${Math.max(1, s(1))}"/>`,
  ];
  z.rows.forEach(([label, n], i) => {
    const top = s(4) + rowH * i;
    parts.push(
      `<text x="${padX}" y="${top + s(26) + rowContent / 2 + labelSize * 0.36}"
             font-family="${FONT}" font-size="${labelSize}" font-weight="700"
             fill="${INK}">${esc(label)}</text>`,
      `<text x="${s(z.w) - padX}" y="${top + s(26) + rowContent / 2 + numSize * 0.36}"
             font-family="${FONT}" font-size="${numSize}" font-weight="700"
             fill="${ACCENT}" text-anchor="end">${esc(n)}</text>`,
    );
    if (i < z.rows.length - 1) {
      const y = top + rowH;
      parts.push(
        `<line x1="${padX}" y1="${y}" x2="${s(z.w) - padX}" y2="${y}" stroke="${BORDER}"
               stroke-width="${Math.max(1, s(1))}" stroke-dasharray="${s(4)} ${s(4)}"/>`,
      );
    }
  });
  return `<g transform="translate(${s(z.left)} ${s(z.top)})">${parts.join('')}</g>`;
}

/** 上の見出し・下の本文など、画像より上に載るものを1枚のSVGにまとめる */
async function overlay(shot, W, H, k) {
  const s = (n) => n * k;
  const onBand = shot.band === ACCENT ? ON_DARK : ON_DARK;
  const kickerFill = shot.band === ACCENT ? 'rgba(255,254,251,0.72)' : 'rgba(255,254,251,0.62)';
  const leadFill = shot.band === ACCENT ? 'rgba(255,254,251,0.86)' : 'rgba(255,254,251,0.82)';
  const noBg = shot.band === ACCENT ? CARD : ACCENT;
  const noFg = shot.band === ACCENT ? ACCENT : CARD;

  const p = [];

  // 通し番号と小見出し
  p.push(
    `<circle cx="${s(43)}" cy="${s(57)}" r="${s(11)}" fill="${noBg}"/>`,
    `<text x="${s(43)}" y="${s(57 + 13 * 0.36)}" font-family="${FONT}" font-size="${s(13)}"
           font-weight="700" fill="${noFg}" text-anchor="middle">${esc(shot.no)}</text>`,
    `<text x="${s(63)}" y="${s(61.5)}" font-family="${FONT}" font-size="${s(12)}" font-weight="700"
           fill="${kickerFill}" letter-spacing="${s(2.4)}">${esc(shot.kicker)}</text>`,
  );

  // 前置きと言いたいこと
  p.push(
    `<text x="${s(32)}" y="${s(125)}" font-family="${FONT}" font-size="${s(25)}" font-weight="700"
           fill="${leadFill}">${esc(shot.lead)}</text>`,
    `<text x="${s(32)}" y="${s(193)}" font-family="${FONT}" font-size="${s(58)}" font-weight="700"
           fill="${onBand}" letter-spacing="${s(-1.2)}">${esc(shot.punch[0])}</text>`,
    `<text x="${s(32)}" y="${s(257)}" font-family="${FONT}" font-size="${s(58)}" font-weight="700"
           fill="${onBand}" letter-spacing="${s(-1.2)}">${esc(shot.punch[1])}</text>`,
  );

  if (shot.zeros) p.push(zeros(shot.zeros, k));
  if (shot.arrow) p.push(arrow(k));
  if (shot.seal) p.push(seal(shot.seal, k));
  if (shot.badge) p.push(badge(shot.badge, k));

  // 赤ペンの書き込み
  if (shot.scribble) {
    const sc = shot.scribble;
    const size = s(22);
    sc.lines.forEach((line, i) => {
      p.push(
        `<text x="${s(sc.left)}" y="${s(sc.top) + size * 0.86 + i * size * 1.35}"
               font-family="${FONT}" font-size="${size}" font-weight="700" fill="${ACCENT}"
               transform="rotate(${sc.rotate} ${s(sc.left)} ${s(sc.top)})">${esc(line)}</text>`,
      );
    });
  }

  // 蛍光ペンを引いた1行。行は1本の <text> で流し、下敷きだけ実測で置く
  if (shot.mark) {
    const m = shot.mark;
    const size = s(22);
    const y = s(m.top) + size * 0.95;
    const x0 = s(32);
    const inkPlain = await measure(m.plain, size, 700);
    const inkAll = await measure(m.plain + m.marked, size, 700);
    p.push(
      `<rect x="${x0 + inkPlain}" y="${y - size * 0.58}" width="${inkAll - inkPlain + s(3)}"
             height="${size * 0.7}" fill="${MARKER}"/>`,
      `<text x="${x0}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="700"
             fill="${INK}">${esc(m.plain + m.marked)}</text>`,
    );
  }

  // 箇条書き
  if (shot.body?.kind === 'bullets') {
    const size = s(16);
    shot.body.items.forEach((t, i) => {
      const top = s(shot.body.top) + i * s(35);
      p.push(
        `<circle cx="${s(35.5)}" cy="${top + s(11.5)}" r="${s(3.5)}" fill="${ACCENT}"/>`,
        `<text x="${s(50)}" y="${top + size * 0.95}" font-family="${FONT}" font-size="${size}"
               fill="${INK}">${esc(t)}</text>`,
      );
    });
  }

  // 太字混じりの2行(6枚目)。tspan で流すので位置の計算は要らない
  if (shot.note) {
    const size = s(15);
    shot.note.lines.forEach((parts, i) => {
      const runs = parts
        .map((part) =>
          part.bold
            ? `<tspan font-weight="700">${esc(part.t)}</tspan>`
            : `<tspan>${esc(part.t)}</tspan>`,
        )
        .join('');
      p.push(
        `<text x="${s(32)}" y="${s(shot.note.top) + size * 0.95 + i * size * 1.6}"
               font-family="${FONT}" font-size="${size}" fill="${INK}">${runs}</text>`,
      );
    });
  }

  // 小さい注記
  if (shot.fine) {
    const size = s(12);
    wrap(shot.fine.text, size, s(376)).forEach((line, i) => {
      p.push(
        `<text x="${s(32)}" y="${s(shot.fine.top) + size * 0.95 + i * size * 1.6}"
               font-family="${FONT}" font-size="${size}" fill="${MUTED}">${esc(line)}</text>`,
      );
    });
  }

  return Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${p.join('')}</svg>`,
  );
}

/** 角丸に切り抜いて、縁を付ける */
async function cardify(buf, w, h, k) {
  const r = s10(k);
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/>
     </svg>`,
  );
  const edge = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
       <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" ry="${r}"
             fill="none" stroke="${BORDER}" stroke-width="${Math.max(1, k)}"/>
     </svg>`,
  );
  return sharp(buf)
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: edge, blend: 'over' },
    ])
    .png()
    .toBuffer();
}

const s10 = (k) => Math.round(14 * k);

/** ぼかした影。ベタ塗りの帯にカードが載っているので、浮きが要る */
async function shadow(w, h, k) {
  const r = s10(k);
  const pad = Math.round(30 * k);
  const svg = Buffer.from(
    `<svg width="${w + pad * 2}" height="${h + pad * 2}" xmlns="http://www.w3.org/2000/svg">
       <rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="${r}" ry="${r}"
             fill="rgba(51,54,47,0.30)"/>
     </svg>`,
  );
  return sharp(svg).blur(9 * k).png().toBuffer();
}

for (const { W, H, dir } of SIZES) {
  await mkdir(dir, { recursive: true });

  const keep = new Set(SHOTS.map((s) => `${s.out}.png`));
  for (const name of await readdir(dir)) {
    if (name.endsWith('.png') && !keep.has(name)) {
      await unlink(`${dir}/${name}`);
      console.log(`removed ${dir}/${name}`);
    }
  }

  const k = W / BASE_W;

  for (const shot of SHOTS) {
    const layers = [];

    if (shot.image) {
      const w = Math.round(shot.image.w * k);
      const resized = await sharp(`store/canvas/${shot.image.file}`).resize(w).png().toBuffer();
      const { height: h } = await sharp(resized).metadata();
      // 影はカードより一回り大きい。紙の左端をはみ出すコマがあるので、
      // 負の座標に置くのではなく、はみ出したぶんを切ってから置く
      const pad = Math.round(30 * k);
      let sh = await shadow(w, h, k);
      let sx = Math.round(shot.image.left * k) - pad;
      let sy = Math.round(shot.image.top * k) - pad + Math.round(7 * k);
      {
        const m = await sharp(sh).metadata();
        const cutL = Math.max(0, -sx);
        const cutT = Math.max(0, -sy);
        const keepW = Math.min(m.width - cutL, W - Math.max(0, sx));
        const keepH = Math.min(m.height - cutT, H - Math.max(0, sy));
        if (cutL || cutT || keepW !== m.width || keepH !== m.height) {
          sh = await sharp(sh)
            .extract({ left: cutL, top: cutT, width: keepW, height: keepH })
            .png()
            .toBuffer();
        }
        sx = Math.max(0, sx);
        sy = Math.max(0, sy);
      }
      layers.push({ input: sh, left: sx, top: sy });
      layers.push({
        input: await cardify(resized, w, h, k),
        left: Math.round(shot.image.left * k),
        top: Math.round(shot.image.top * k),
      });
    }

    layers.push({ input: await overlay(shot, W, H, k), top: 0, left: 0 });

    const out = `${dir}/${shot.out}.png`;
    await sharp(backdrop(shot, W, H, k))
      .composite(layers)
      .removeAlpha() // 3チャンネル(RGB)で書き出す。アルファ付きは弾かれる
      .png()
      .toFile(out);

    const check = await sharp(out).metadata();
    console.log(`${out}  ${check.width}x${check.height}  ${check.channels}ch`);
  }
}
