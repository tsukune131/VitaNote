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
  | 'vitals'
  | 'food'
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
      {
        // DOIの解決先は出版社の購読者向けページなので、誰でも読める抄録も併記する
        title: '同論文の抄録(PubMed)',
        publisher: 'National Library of Medicine',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
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
      'あくまで目安で、実際の体重の変化は体内の水分量や筋肉量にも左右されます。' +
      'なお、メッツによる歩数・運動の消費カロリーは安静時の消費を含んだ総量です。' +
      '本アプリは簡便さを優先してこれを基礎代謝×1.2に加算しているため、' +
      '体を動かしていた時間の安静時分がわずかに重複して計上され、貯金はその分だけ大きめに出ます。' +
      '(1万歩でおよそ100kcal程度)。カロリー貯金はあくまで目安としてご覧ください。',
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
      '運動のメッツ値はメッツ表によります。歩数からの推定では、歩幅0.7m・時速4.0km・普通歩行3.0メッツを' +
      '前提に距離と時間を割り出しています。3.0メッツはメッツ表の「普通歩行(平地、67m/分)」の行にあたり、' +
      '時速4.0kmはその67m/分を時速に直したものです。歩幅0.7mは本アプリが置いた一律の前提で、' +
      '歩幅も歩く速さも実際には個人差があります。' +
      'また「歩けば取り返せます」という言い換えは1日10,000歩までにとどめ、それを超える量は歩数で示しません。' +
      'この10,000歩は本アプリが表示上置いた歯止めで、公的な推奨値ではありません。' +
      '参考までに、身体活動・運動ガイド2023が成人に推奨する1日の身体活動量は' +
      '歩行等を1日60分以上(約8,000歩以上に相当)です。' +
      '実際にどれだけ体を動かせるかは体調や持病によりますので、医師にご相談ください。',
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
      {
        title:
          '「健康づくりのための身体活動・運動ガイド2023」推奨シート:成人版(歩行等を1日60分以上、1日約8,000歩以上に相当)',
        publisher: '厚生労働省',
        url: 'https://kennet.mhlw.go.jp/information/information/exercise/s-00-002.html',
      },
    ],
  },
  {
    id: 'bmi',
    heading: 'BMIと肥満度の区分',
    formula: 'BMI = 体重(kg) ÷ 身長(m)² / 18.5未満:低体重、25未満:普通体重、25以上:肥満(1〜4度)',
    note:
      // 「判定は行いません」と全体で言っている以上、BMIの区分表示が診断ではないことを
      // ここで明示しておく。区分を出すこと自体は健診で一般的で、問題になるのは書き方のほう
      'BMIの区分は身長と体重だけで決まる計算上の分類で、肥満症(治療の対象となる疾患)の' +
      '診断ではありません。診断は医師が他の検査と併せて行います。' +
      '肥満1度は25以上30未満、2度は30以上35未満、3度は35以上40未満、4度は40以上です。' +
      'この1〜4度の区分は日本肥満学会の肥満度分類によります(下記1件目の第2章)。' +
      '厚生労働省 e-ヘルスネットは、18.5未満を低体重・25以上を肥満とする定義を示しています。',
    refs: [
      {
        // 画面に出している「肥満(1〜4度)」の根拠はこちら。第2章が肥満度分類の章
        title: '肥満症診療ガイドライン2022 第2章「肥満の判定と肥満症の診断基準」(肥満度分類)',
        publisher: '日本肥満学会',
        url: 'https://www.jasso.or.jp/data/magazine/pdf/medicareguide2022_06.pdf',
      },
      {
        title: 'BMI(e-ヘルスネット 用語辞典)',
        publisher: '厚生労働省',
        url: 'https://kennet.mhlw.go.jp/information/information/dictionary/metabolic/ym-002.html',
      },
    ],
  },
  {
    id: 'waist',
    heading: '腹囲の目安(男性85cm・女性90cm)',
    formula: '本アプリは腹囲を記録・表示するだけで、判定や診断は行いません。',
    note:
      '男性85cm・女性90cmは、メタボリックシンドロームの診断でウエスト周囲径に用いられる値です。' +
      '参考として挙げているだけで、本アプリがこの値と比べて判定することはありません。' +
      '診断は腹囲だけで決まるものではなく、血圧・血糖・脂質の値と併せて医師が行うものです。',
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
    // 画面の列見出しと同じ語にする。シートを開いた人が自分の見ていた表から引けるように
    heading: '血液検査の基準範囲',
    formula: 'HbA1c 5.5以下 / LDL 60〜119 / HDL 40以上 / 中性脂肪 30〜149 / AST・ALT 30以下 / γ-GTP 50以下 / 尿酸 2.1〜7.0 / eGFR 60.0以上',
    note:
      '表に併記している目安で、出典が示す「基準範囲」をそのまま転記しています。' +
      '実際の基準範囲は検査施設・性別・年齢によって異なるため、' +
      'お手元の検査結果表の値をご確認ください。本アプリは判定や結果の解釈を行いません。' +
      // 出典に判定区分のPDFを挙げている以上、それを使っていないことまで書かないと
      // 「判定は行いません」という宣言と食い違って見える
      '同学会は「判定区分」も公表していますが、本アプリはA〜Eの判定区分を表示しておらず、' +
      '判定にも用いていません。',
    refs: [
      {
        // 項目ごとの基準範囲がHTMLで読める。端末で開いてそのまま確認できるのでこちらを先に置く
        title: '血液検査(検査項目ごとの基準範囲)',
        publisher: '日本人間ドック・予防医療学会',
        url: 'https://www.ningen-dock.jp/inspection_blood/',
      },
      {
        // 一覧ページには年度違いの判定区分表が並ぶので、現行版のPDFを直接指す
        title: '判定区分(2026年4月1日改定)',
        publisher: '日本人間ドック・予防医療学会',
        url: 'https://www.ningen-dock.jp/ningendock/wp-content/uploads/2026/02/2026hanteikijun.pdf',
      },
    ],
  },
  {
    // 計算していない数値にも項目を立てる。「ふりかえり」でこのグラフを見ている人が
    // 出典シートを開いたとき、自分が見ている数字の話が1行も無いのを避けるため
    id: 'vitals',
    heading: '血圧・血糖値の記録',
    formula: '計算は行いません。利用者が入力した値をそのまま表示・グラフ化します。',
    note:
      'ご家庭の血圧計・血糖測定器などで測った値を書き写して記録するものです。' +
      '本アプリおよび端末のセンサーがこれらを測定することはありません。' +
      '本アプリは基準範囲に照らした判定や結果の解釈も行いません。' +
      '数値の意味や治療の判断は医師にご相談ください。',
    refs: [
      {
        title: '高血圧(e-ヘルスネット)',
        publisher: '厚生労働省',
        url: 'https://kennet.mhlw.go.jp/information/information/metabolic/m-05-003.html',
      },
      {
        title: '血糖値(e-ヘルスネット 用語辞典)',
        publisher: '厚生労働省',
        url: 'https://kennet.mhlw.go.jp/information/information/dictionary/metabolic/ym-085.html',
      },
    ],
  },
  {
    // 1,000件を超える食事プリセットも「アプリが出しているカロリー」なので出所を書く
    id: 'food',
    heading: '食事のカロリー(検索候補の目安)',
    formula: '1皿・1杯・1個あたりの一般的なエネルギー量。分量のボタンで比例させています。',
    note:
      '日本食品標準成分表の成分値と、一般的な1人前の分量をもとに本アプリが整理した目安です。' +
      '外食・惣菜のメニューは公表値や一般的なレシピからの概算で、実測値ではありません。' +
      '店やレシピ、盛り付けによって実際のカロリーは大きく変わります。' +
      '正確な値が必要なときは、召し上がるものの表示をご確認ください。',
    refs: [
      {
        title: '日本食品標準成分表(八訂)増補2023年 食品成分データベース',
        publisher: '文部科学省',
        url: 'https://fooddb.mext.go.jp/',
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
    heading: 'ご飯の量への換算(茶碗1杯 = 約235kcal)',
    formula: '「きょうの目安」でカロリーをご飯の杯数に言い換えるときの換算値',
    note:
      '食品成分表の「めし・精白米」は100gあたり156kcalで、茶碗1杯(中盛り・約150g)ではおよそ234kcalです。' +
      '本アプリは目安として235kcalを使っています(食事の検索候補に出る「ご飯 茶碗1杯」と同じ値です)。' +
      '出典のデータベースで食品番号01088「こめ [水稲めし] 精白米 うるち米」を検索すると確認できます。',
    refs: [
      {
        title: '日本食品標準成分表(八訂)増補2023年 食品成分データベース',
        publisher: '文部科学省',
        url: 'https://fooddb.mext.go.jp/',
      },
    ],
  },
];

/** 出典の確認日。シートに明示して、情報の鮮度を利用者が判断できるようにする */
export const SOURCES_CHECKED_ON = '2026年8月11日';
