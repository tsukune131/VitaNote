import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from './platform';

/**
 * 記録リマインダーの通知。
 *
 * 体重通知の仕様:
 * - 1件目も含め、すべて「その時刻までに体重が未入力なら届く」条件付き
 *
 * OSの繰り返し通知に条件判定は無いので、繰り返しは使わず「その日ぶんの単発通知」を
 * 日付ごとに積む。体重を保存したら、その日の残りぶんをまとめて取り消す。
 *
 * 単発だけだと丸一日アプリを開かなかった日に何も届かなくなるので、
 * 先の数日ぶんまで前もって積んでおき、アプリを開くたびに窓を先へずらす。
 * 積んだ先の日ぶんは、その日に体重を書けば(=アプリを開けば)取り消される。
 */

/** 体重通知のID = BASE + 日オフセット*TIMES_PER_DAY + 時刻の番号 */
const WEIGHT_ID_BASE = 100;
/** 1日に積める時刻の数。設定できる時刻の上限にもなる */
const WEIGHT_TIMES_PER_DAY = 10;
/** 何日先ぶんまで前もって積むか(アプリを開かない日を埋めるため) */
const WEIGHT_DAYS_AHEAD = 7;
const WAIST_ID = 200;

const weightId = (dayOffset: number, timeIndex: number) =>
  WEIGHT_ID_BASE + dayOffset * WEIGHT_TIMES_PER_DAY + timeIndex;
const weightIdsForDay = (dayOffset: number) =>
  Array.from({ length: WEIGHT_TIMES_PER_DAY }, (_, i) => weightId(dayOffset, i));
const ALL_WEIGHT_IDS = Array.from({ length: WEIGHT_DAYS_AHEAD }, (_, d) => weightIdsForDay(d)).flat();

const ids = (list: number[]) => list.map((id) => ({ id }));
const ALL_IDS = ids([...ALL_WEIGHT_IDS, WAIST_ID]);

export type PermissionState = 'granted' | 'denied' | 'unsupported';

export interface ReminderSettings {
  weightEnabled: boolean;
  weightTimes: string[];
  waistEnabled: boolean;
  waistWeekday: number;
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
 * 設定に合わせて通知をすべて貼り直す。
 * recordedToday(その日の体重を記録済みか)がtrueなら、当日ぶんは積まない。
 */
export async function syncReminders(
  settings: ReminderSettings,
  recordedToday: boolean,
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

    const notifications = [];

    if (settings.weightEnabled && settings.weightTimes.length > 0) {
      const now = new Date();
      const times = settings.weightTimes.slice(0, WEIGHT_TIMES_PER_DAY);
      // iOSは予約できる通知が64件まで。溢れると切り捨てられるので、時刻を多く
      // 設定した人には先の日ぶんを諦めて、近い日から確実に積む
      const days = Math.max(1, Math.min(WEIGHT_DAYS_AHEAD, Math.floor(60 / times.length)));
      for (let day = 0; day < days; day++) {
        // 今日ぶんは、すでに体重が書かれていれば1件目から積まない
        if (day === 0 && recordedToday) continue;
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

    if (settings.waistEnabled) {
      notifications.push({
        id: WAIST_ID,
        title: 'VitaNote',
        body: '腹囲を記録しましょう',
        // Capacitor/iOSのweekdayは1(日)〜7(土)。アプリ側の0(日)〜6(土)に+1する
        schedule: { on: { weekday: settings.waistWeekday + 1, hour: 9, minute: 0 }, allowWhileIdle: true },
      });
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

/** その日の体重を保存したときに呼ぶ。当日ぶんの体重通知を取り消す */
export async function cancelTodaysWeightReminders(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancel({ notifications: ids(weightIdsForDay(0)) });
  } catch {
    // 同上
  }
}

/** 設定できる体重通知の時刻の上限 */
export const MAX_WEIGHT_NOTIFY_TIMES = WEIGHT_TIMES_PER_DAY;
