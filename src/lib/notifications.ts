import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from './platform';

/**
 * 記録リマインダーの通知。
 *
 * 体重通知の仕様:
 * - 1件目は毎日必ず届く(OSの繰り返し通知)
 * - 2件目以降は「その日の体重が未入力なら届く」条件付き
 *
 * OSの繰り返し通知に条件判定は無いので、2件目以降は繰り返しにはせず、
 * 「当日ぶんの単発通知」をアプリを開くたびに貼り直すことで実現する。
 * 体重を保存したらその日ぶんを取り消す。
 *
 * この方式では、丸一日アプリを開かなかった日は2件目以降が積まれない。
 * その日は1件目(必ず届く繰り返し通知)だけが届く。1件目で開いてもらえれば
 * その時点で当日ぶんが積まれるので、実用上はこれで足りると判断した。
 */

/** 1件目(必ず届く)の固定ID */
const WEIGHT_MANDATORY_ID = 100;
/** 2件目以降(条件付き)に予約したID。設定できる時刻の上限にもなる */
const WEIGHT_CONDITIONAL_IDS = Array.from({ length: 9 }, (_, i) => 101 + i);
const WAIST_ID = 200;

const ids = (list: number[]) => list.map((id) => ({ id }));
const ALL_IDS = ids([WEIGHT_MANDATORY_ID, ...WEIGHT_CONDITIONAL_IDS, WAIST_ID]);

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

/** 今日のHH:mmをDateにする */
function todayAt(time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const at = new Date();
  at.setHours(hour, minute, 0, 0);
  return at;
}

/**
 * 設定に合わせて通知をすべて貼り直す。
 * recordedToday(その日の体重を記録済みか)がtrueなら、当日の条件付きは積まない。
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
      const [first, ...rest] = settings.weightTimes;
      const [hour, minute] = first.split(':').map(Number);
      notifications.push({
        id: WEIGHT_MANDATORY_ID,
        title: 'VitaNote',
        body: 'きょうの体重を書き込みましょう',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      });

      if (!recordedToday) {
        const now = new Date();
        rest.forEach((time, i) => {
          const at = todayAt(time);
          // 過ぎた時刻には積めない。積めるIDの数(=時刻の数)にも上限がある
          if (at <= now || i >= WEIGHT_CONDITIONAL_IDS.length) return;
          notifications.push({
            id: WEIGHT_CONDITIONAL_IDS[i],
            title: 'VitaNote',
            body: 'きょうの体重がまだ書かれていません',
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

/** その日の体重を保存したときに呼ぶ。当日ぶんの条件付き通知を取り消す */
export async function cancelTodaysConditionalWeightReminders(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancel({ notifications: ids(WEIGHT_CONDITIONAL_IDS) });
  } catch {
    // 同上
  }
}

/** 設定できる体重通知の時刻の上限(1件目+条件付きの枠) */
export const MAX_WEIGHT_NOTIFY_TIMES = WEIGHT_CONDITIONAL_IDS.length + 1;
