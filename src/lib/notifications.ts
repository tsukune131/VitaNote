import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { toDateStr } from './date';
import { isNativeApp } from './platform';

/**
 * 記録リマインダーの通知。
 *
 * 体重も腹囲も「その時刻までに記録が無ければ届く」条件付き。
 * 体重はその日、腹囲は直前の1週間を見る。
 *
 * OSの繰り返し通知に条件判定は無いので、繰り返しは使わず単発通知を積む。
 * 記録を保存したら、その回ぶんを取り消す。
 *
 * 単発だけだとアプリを開かなかった日に何も届かなくなるので、先のぶんまで
 * 前もって積んでおき、アプリを開くたびに窓を先へずらす。
 * 積んだ先のぶんは、記録すれば(=アプリを開けば)取り消される。
 *
 * iOSは予約できる通知が64件までなので、積む総数はBUDGETに収める。
 */

/** 体重通知のID = BASE + 日オフセット*TIMES_PER_DAY + 時刻の番号 */
const WEIGHT_ID_BASE = 100;
/** 1日に積める時刻の数。設定できる時刻の上限にもなる */
const WEIGHT_TIMES_PER_DAY = 10;
/** 何日先ぶんまで前もって積むか(アプリを開かない日を埋めるため) */
const WEIGHT_DAYS_AHEAD = 7;
/** 腹囲通知のID = BASE + 週オフセット */
const WAIST_ID_BASE = 200;
/** 何週先ぶんまで前もって積むか */
const WAIST_WEEKS_AHEAD = 8;
/** 腹囲通知の時刻(9:00) */
const WAIST_HOUR = 9;
/** 一度に予約する通知の上限(iOSの64件に余裕を持たせた数) */
const SCHEDULE_BUDGET = 60;

const weightId = (dayOffset: number, timeIndex: number) =>
  WEIGHT_ID_BASE + dayOffset * WEIGHT_TIMES_PER_DAY + timeIndex;
const weightIdsForDay = (dayOffset: number) =>
  Array.from({ length: WEIGHT_TIMES_PER_DAY }, (_, i) => weightId(dayOffset, i));
const ALL_WEIGHT_IDS = Array.from({ length: WEIGHT_DAYS_AHEAD }, (_, d) => weightIdsForDay(d)).flat();
const ALL_WAIST_IDS = Array.from({ length: WAIST_WEEKS_AHEAD }, (_, w) => WAIST_ID_BASE + w);

const ids = (list: number[]) => list.map((id) => ({ id }));
const ALL_IDS = ids([...ALL_WEIGHT_IDS, ...ALL_WAIST_IDS]);

export type PermissionState = 'granted' | 'denied' | 'unsupported';

export interface ReminderSettings {
  weightEnabled: boolean;
  weightTimes: string[];
  waistEnabled: boolean;
  waistWeekday: number;
}

/** 通知を積むときに参照する記録の状況 */
export interface RecordStatus {
  /** きょうの体重を記録済みか */
  weightRecordedToday: boolean;
  /** 腹囲を最後に記録した日(YYYY-MM-DD)。一度も無ければundefined */
  lastWaistDate?: string;
}

/** 通知の許可を確かめ、まだ尋ねていなければ尋ねる */
export async function ensureNotificationPermission(): Promise<PermissionState> {
  if (!isNativeApp()) return 'unsupported';
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return 'granted';
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** dayOffset日後のHH:mmをDateにする */
function dateAt(time: string, dayOffset: number): Date {
  const [hour, minute] = time.split(':').map(Number);
  const at = new Date();
  at.setDate(at.getDate() + dayOffset);
  at.setHours(hour, minute, 0, 0);
  return at;
}

/**
 * 腹囲通知を積む日時を、近い順にweeks件ぶん求める。
 *
 * 直近の1回は「その日時までの1週間に腹囲の記録があれば積まない」。
 * 2回目以降はその週になってみないと判定できないので、いったん積んでおき、
 * 記録されたとき・次にアプリを開いたときに取り消す/積み直す。
 */
export function waistReminderDates(
  weekday: number,
  weeks: number,
  now: Date,
  lastWaistDate?: string,
): Date[] {
  const first = new Date(now);
  first.setHours(WAIST_HOUR, 0, 0, 0);
  // 指定曜日で、いまより後の最初の日時まで進める
  while (first <= now || first.getDay() !== weekday) first.setDate(first.getDate() + 1);

  const weekBefore = new Date(first);
  weekBefore.setDate(weekBefore.getDate() - 7);
  const recorded = lastWaistDate != null && lastWaistDate > toDateStr(weekBefore);

  const dates: Date[] = [];
  for (let week = recorded ? 1 : 0; week < weeks; week++) {
    const at = new Date(first);
    at.setDate(at.getDate() + week * 7);
    dates.push(at);
  }
  return dates;
}

/** 設定と記録の状況に合わせて通知をすべて貼り直す */
export async function syncReminders(
  settings: ReminderSettings,
  status: RecordStatus,
): Promise<PermissionState> {
  if (!isNativeApp()) return 'unsupported';

  const wanted = settings.weightEnabled || settings.waistEnabled;
  if (!wanted) {
    await cancelAllReminders();
    return 'granted';
  }

  const permission = await ensureNotificationPermission();
  if (permission !== 'granted') return permission;

  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS });

    const now = new Date();
    const notifications: LocalNotificationSchema[] = [];

    if (settings.waistEnabled) {
      waistReminderDates(settings.waistWeekday, WAIST_WEEKS_AHEAD, now, status.lastWaistDate).forEach(
        (at, week) => {
          notifications.push({
            id: WAIST_ID_BASE + week,
            title: 'VitaNote',
            body: '今週の腹囲を記録しましょう',
            schedule: { at, allowWhileIdle: true },
          });
        },
      );
    }

    if (settings.weightEnabled && settings.weightTimes.length > 0) {
      const times = settings.weightTimes.slice(0, WEIGHT_TIMES_PER_DAY);
      // 溢れると切り捨てられるので、時刻を多く設定した人には先の日ぶんを諦めて、
      // 近い日から確実に積む
      const budget = SCHEDULE_BUDGET - notifications.length;
      const days = Math.max(1, Math.min(WEIGHT_DAYS_AHEAD, Math.floor(budget / times.length)));
      for (let day = 0; day < days; day++) {
        // 今日ぶんは、すでに体重が書かれていれば1件目から積まない
        if (day === 0 && status.weightRecordedToday) continue;
        times.forEach((time, i) => {
          const at = dateAt(time, day);
          if (at <= now) return; // 過ぎた時刻には積めない
          notifications.push({
            id: weightId(day, i),
            title: 'VitaNote',
            body: i === 0 ? 'きょうの体重を書き込みましょう' : 'きょうの体重がまだ書かれていません',
            schedule: { at, allowWhileIdle: true },
          });
        });
      }
    }

    if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
    return 'granted';
  } catch {
    return 'denied';
  }
}

/** 通知をすべて解除する */
export async function cancelAllReminders(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS });
  } catch {
    // 未許可などで消せなくても、そもそも積まれていないので放置してよい
  }
}

/** 設定できる体重通知の時刻の上限 */
export const MAX_WEIGHT_NOTIFY_TIMES = WEIGHT_TIMES_PER_DAY;
