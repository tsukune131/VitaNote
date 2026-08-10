/**
 * アプリが表示する健康・医学に関する数値の出典。
 *
 * App Store Reviewガイドライン1.4.1は、医学的な情報や計算を含むアプリに
 * 「利用者が見つけやすい形での出典の明示」を求めている。画面のコメントに書くだけでは
 * 利用者には見えないので、出典はここに一元管理して「出典を見る」シートから読めるようにする。
 *
 * URLは2026年8月11日時点で到達を確認済み。
 * e-ヘルスネットは www.e-healthnet.mhlw.go.jp が廃止され、
 * 「健康日本21アクション支援システム」(kennet.mhlw.go.jp)に移設されている。
 */

export type SourceId =
  | 'bmr'
  | 'tdee'
  | 'fatKcal'
  | 'mets'
  | 'bmi'
  | 'waist'
  | 'bloodTest'
  | 'intakeFloor'
  | 'rice';

export interface SourceRef {
  /** 出典の題名 */
  title: string;
  /** 発行元。書誌としての著者・団体 */
  publisher: string;
  /** リンク先。タップで端末のブラウザが開く */
  url: string;
}

export interface MedicalSource {
  id: SourceId;
  /** シートの見出し。「アプリのどの数字か」で引けるようにする */
  heading: string;
  /** その数字をどう計算しているか。式そのものを見せる */
  formula: string;
  /** 出典に照らした補足や、出典では決まらない前提 */
  note?: string;
  refs: SourceRef[];
}

export const MEDICAL_SOURCES: MedicalSource[] = [
  {
    id: 'bmr',
    heading: '基礎代謝量',
    formula:
      '10 × 体重(kg) + 6.25 × 身長(cm) − 5 × 年齢 + (男性 +5 / 女性 −161)  [Mifflin-St Jeor式]',
    note: '身長・生年月日・性別(いずれも任意入力)が揃ったときだけ計算します。',
    refs: [
      {
        title:
          'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
        publisher: 'American Journal of Clinical Nutrition',
        url: 'https://doi.org/10.1093/ajcn/51.2.241',
      },
    ],
  },
  {
    id: 'tdee',
    heading: '1日の推定消費カロリー',
    formula: '基礎代謝量 × 身体活動レベル(1.2〜1.9)',
    note:
      '「消費エネルギー = 基礎代謝量 × 身体活動レベル」という考え方は食事摂取基準によります。' +
      '本アプリが選択肢に使う1.2〜1.9の5段階の係数は、Harris-Benedict式とともに広く使われている目安であり、' +
      '食事摂取基準が定める身体活動レベルの区分(低い・ふつう・高い)とは刻みが異なります。',
    refs: [
      {
        title: '「日本人の食事摂取基準(2025年版)」策定検討会報告書',
        publisher: '厚生労働省',
        url: 'https://www.mhlw.go.jp/stf/newpage_44138.html',
      },
    ],
  },
  {
    id: 'fatKcal',
    heading: 'カロリー貯金と体重の関係(体脂肪1kg = 約7,000kcal)',
    formula:
      'カロリー貯金 = 基礎代謝量 × 1.2 + 活動の消費(歩数・運動) − 摂取カロリー / 目標までの総消費カロリー = 減らしたい体重(kg) × 7,000kcal',
    note:
      '出典に「体脂肪1kgを減らすために必要なエネルギー量は約7,000kcalである」と示されている値を使っています。' +
      'あくまで目安で、実際の体重の変化は体内の水分量や筋肉量にも左右されます。',
    refs: [
      {
        title:
          '「健康づくりのための身体活動・運動ガイド2023」情報シート:身体活動とエネルギー・栄養素(e-ヘルスネット)',
        publisher: '厚生労働省',
        url: 'https://kennet.mhlw.go.jp/information/information/exercise/s-00-012.html',
      },
    ],
  },
  {
    id: 'mets',
    heading: '歩数・運動の消費カロリー',
    formula: '消費カロリー(kcal) = メッツ × 体重(kg) × 時間(h) × 1.05',
    note:
      '運動のメッツ値はメッツ表によります。歩数からの推定では、歩幅0.7m・時速4.8km・歩行3.0メッツを前提に' +
      '距離と時間を割り出しています。歩幅と歩く速さは本アプリが置いた一律の前提で、実際には個人差があります。',
    refs: [
      {
        title: '『身体活動のメッツ(METs)表』改訂第2版(Compendium of Physical Activities 準拠)',
        publisher: '国立健康・栄養研究所(医薬基盤・健康・栄養研究所)',
        url: 'https://www.nibn.go.jp/activities/documents/2024Compendium_table_adult_ver1_1_5.pdf',
      },
      {
        title: '健康づくりのための身体活動・運動ガイド2023 / 身体活動基準2013(身体活動・運動の推進)',
        publisher: '厚生労働省',
        url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/undou/index.html',
      },
    ],
  },
  {
    id: 'bmi',
    heading: 'BMIと肥満度の判定',
    formula: 'BMI = 体重(kg) ÷ 身長(m)² / 18.5未満:低体重、25未満:普通体重、25以上:肥満(1〜4度)',
    note: '肥満1度は25以上30未満、2度は30以上35未満、3度は35以上40未満、4度は40以上です。',
    refs: [
      {
        title: 'BMI(e-ヘルスネット 用語辞典)',
        publisher: '厚生労働省',
        url: 'https://kennet.mhlw.go.jp/information/information/dictionary/metabolic/ym-002.html',
      },
      {
        title: '肥満症診療ガイドライン2022(肥満度分類)',
        publisher: '日本肥満学会',
        url: 'https://www.jasso.or.jp/',
      },
    ],
  },
  {
    id: 'waist',
    heading: '腹囲の目安(男性85cm・女性90cm)',
    formula: 'メタボリックシンドロームの診断で必須となるウエスト周囲径の基準値',
    note:
      '本アプリは腹囲を記録・表示するだけで、メタボリックシンドロームの判定は行いません。' +
      '診断は血圧・血糖・脂質の値と併せて医師が行うものです。',
    refs: [
      {
        title: 'メタボリックシンドロームとは?(e-ヘルスネット)',
        publisher: '厚生労働省',
        url: 'https://kennet.mhlw.go.jp/information/information/metabolic/m-01-003.html',
      },
    ],
  },
  {
    id: 'bloodTest',
    heading: '血液検査の基準値',
    formula: 'HbA1c 5.5以下 / LDL 60〜119 / HDL 40以上 / 中性脂肪 30〜149 / AST・ALT 30以下 / γ-GTP 50以下 / 尿酸 7.0以下 / eGFR 60以上',
    note:
      '表に併記している基準範囲の目安です。実際の基準値は検査施設・性別・年齢によって異なるため、' +
      'お手元の検査結果表の基準値をご確認ください。本アプリは判定や結果の解釈を行いません。',
    refs: [
      {
        title: '検査表の見方(判定区分表)',
        publisher: '日本人間ドック・予防医療学会',
        url: 'https://www.ningen-dock.jp/other_inspection',
      },
    ],
  },
  {
    id: 'intakeFloor',
    heading: '食事量の下限(目標をそのまま逆算しない理由)',
    formula: '1日の摂取カロリーの下限 = max(推定基礎代謝量, 1,200kcal)',
    note:
      '目標体重と達成日から必要な消費カロリーを機械的に割り算すると、食事量が極端に少ない目安に' +
      'なることがあります。本アプリは、勧める食事量が上記の下限を下回らないところで頭打ちにし、' +
      'そのときは目標に無理があることをお伝えします。基礎代謝を下回る食事量を勧めないのは、' +
      '本アプリが安静時の消費を基礎代謝×1.2として計算しているためです。' +
      '1,200kcalは、海外のガイドラインが自己管理での減量に示す下限に合わせています。' +
      'なお600kcal/日以下の超低エネルギー食は医師の管理のもとで行うものとされています。' +
      '減量の進め方は、体調や持病に応じて医師にご相談ください。',
    refs: [
      {
        title:
          '2013 AHA/ACC/TOS Guideline for the Management of Overweight and Obesity in Adults. Circulation. 2013;129(25 Suppl 2):S102-S138. (成人の減量では女性1,200〜1,500kcal/日、男性1,500〜1,800kcal/日を目安とする)',
        publisher: 'American Heart Association / American College of Cardiology / The Obesity Society',
        // 出版社のサイト(ahajournals.org)は自動アクセスを弾くため、全文が読めるPMCを指す
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5819889/',
      },
      {
        title: '肥満症診療ガイドライン2022(食事療法・超低エネルギー食の位置づけ)',
        publisher: '日本肥満学会',
        url: 'https://www.jasso.or.jp/data/magazine/pdf/medicareguide2022_09.pdf',
      },
    ],
  },
  {
    id: 'rice',
    heading: 'ご飯の量への換算(茶碗1杯 = 約240kcal)',
    formula: '「きょうの処方箋」でカロリーをご飯の杯数に言い換えるときの換算値',
    note:
      '食品成分表の「めし・精白米」は100gあたり156kcalで、茶碗1杯(中盛り・約150g)ではおよそ234kcalです。' +
      '本アプリは目安として240kcalを使っています。',
    refs: [
      {
        title: '日本食品標準成分表2020年版(八訂) 食品成分データベース',
        publisher: '文部科学省',
        url: 'https://fooddb.mext.go.jp/',
      },
    ],
  },
];

/** 出典の確認日。シートに明示して、情報の鮮度を利用者が判断できるようにする */
export const SOURCES_CHECKED_ON = '2026年8月11日';
