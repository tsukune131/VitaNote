/** DateをローカルタイムのYYYY-MM-DD文字列に変換 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** 現在時刻のHH:mm */
export function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** YYYY-MM-DDにdays日を加算 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** YYYY-MM形式の月キー */
export function toMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM月にmonthsか月を加算 */
export function addMonths(monthStr: string, months: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return toMonthStr(d);
}

/** YYYY-MM月の日数 */
export function daysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** YYYY-MM月の全日付(YYYY-MM-DD)の配列 */
export function monthDates(monthStr: string): string[] {
  const n = daysInMonth(monthStr);
  return Array.from({ length: n }, (_, i) => `${monthStr}-${String(i + 1).padStart(2, '0')}`);
}

/** 「2026年7月」表示用 */
export function formatMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  return `${y}年${m}月`;
}

/** 「7/19(日)」表示用 */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w})`;
}
