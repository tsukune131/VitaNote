/**
 * 日本の国民の祝日。カレンダーで日曜と同じように紙の色を残すために使う。
 *
 * 内閣府の暦は毎年2月に翌年ぶんが確定するので、外部データではなく祝日法の規則から
 * 計算する。ハッピーマンデーが始まった2000年以降を対象とし、それ以前の月を開いても
 * 落ちないように同じ規則で近似する。
 */

/** 指定月のn番目の月曜(1始まり)の日にち */
function nthMonday(year: number, month: number, nth: number): number {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  // 月曜(1)までの日数。日曜始まりなので (1 - firstWeekday + 7) % 7
  return 1 + ((8 - firstWeekday) % 7) + (nth - 1) * 7;
}

/** 春分の日(1900〜2099年で使える近似式) */
function shunbun(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** 秋分の日(同上) */
function shubun(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

interface Holiday {
  m: number;
  d: number;
  name: string;
}

function baseHolidays(year: number): Holiday[] {
  const list: Holiday[] = [
    { m: 1, d: 1, name: '元日' },
    { m: 1, d: nthMonday(year, 1, 2), name: '成人の日' },
    { m: 2, d: 11, name: '建国記念の日' },
    { m: 3, d: shunbun(year), name: '春分の日' },
    { m: 4, d: 29, name: '昭和の日' },
    { m: 5, d: 3, name: '憲法記念日' },
    { m: 5, d: 4, name: 'みどりの日' },
    { m: 5, d: 5, name: 'こどもの日' },
    { m: 9, d: nthMonday(year, 9, 3), name: '敬老の日' },
    { m: 9, d: shubun(year), name: '秋分の日' },
    { m: 11, d: 3, name: '文化の日' },
    { m: 11, d: 23, name: '勤労感謝の日' },
  ];

  // 天皇誕生日は代替わりで動く。2019年は改元の年で祝日が無い
  if (year >= 2020) list.push({ m: 2, d: 23, name: '天皇誕生日' });
  else if (year <= 2018) list.push({ m: 12, d: 23, name: '天皇誕生日' });

  // 2020・2021年は東京五輪に合わせて夏の3つが動いた
  if (year === 2020) {
    list.push(
      { m: 7, d: 23, name: '海の日' },
      { m: 7, d: 24, name: 'スポーツの日' },
      { m: 8, d: 10, name: '山の日' },
    );
  } else if (year === 2021) {
    list.push(
      { m: 7, d: 22, name: '海の日' },
      { m: 7, d: 23, name: 'スポーツの日' },
      { m: 8, d: 8, name: '山の日' },
    );
  } else {
    list.push({ m: 7, d: nthMonday(year, 7, 3), name: '海の日' });
    if (year >= 2016) list.push({ m: 8, d: 11, name: '山の日' });
    list.push({
      m: 10,
      d: nthMonday(year, 10, 2),
      name: year >= 2020 ? 'スポーツの日' : '体育の日',
    });
  }

  return list;
}

function key(year: number, m: number, d: number): string {
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function addDay(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return key(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function weekday(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

function buildYear(year: number): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of baseHolidays(year)) map.set(key(year, h.m, h.d), h.name);

  // 振替休日: 日曜と重なった祝日は、その後の最初の平日に振り替える
  for (const date of [...map.keys()]) {
    if (weekday(date) !== 0) continue;
    let next = addDay(date, 1);
    while (map.has(next)) next = addDay(next, 1);
    map.set(next, '振替休日');
  }

  // 国民の休日: 祝日に挟まれた平日(9月のシルバーウィークなど)
  for (const date of [...map.keys()]) {
    const gap = addDay(date, 1);
    if (map.has(gap) || weekday(gap) === 0) continue;
    if (map.has(addDay(gap, 1))) map.set(gap, '国民の休日');
  }

  return map;
}

const cache = new Map<number, Map<string, string>>();

function yearMap(year: number): Map<string, string> {
  let m = cache.get(year);
  if (!m) {
    m = buildYear(year);
    cache.set(year, m);
  }
  return m;
}

/** YYYY-MM-DDが祝日ならその名前、そうでなければundefined */
export function holidayName(dateStr: string): string | undefined {
  return yearMap(Number(dateStr.slice(0, 4))).get(dateStr);
}

/** YYYY-MM-DDが祝日かどうか */
export function isHoliday(dateStr: string): boolean {
  return holidayName(dateStr) !== undefined;
}
