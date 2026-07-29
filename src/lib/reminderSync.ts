import { db, DEFAULT_WAIST_NOTIFY_WEEKDAY, DEFAULT_WEIGHT_NOTIFY_TIMES, type Profile } from '../db';
import { todayStr } from './date';
import { cancelAllReminders, syncReminders } from './notifications';
import { isNativeApp } from './platform';

/** 腹囲を最後に記録した日(YYYY-MM-DD)。一度も無ければundefined */
async function lastWaistDate(profileId: number): Promise<string | undefined> {
  const last = await db.healthMetrics
    .where('[profileId+date]')
    .between([profileId, ''], [profileId, '￿'])
    .reverse()
    .filter((e) => e.waist != null)
    .first();
  return last?.date;
}

/**
 * 通知の設定と記録の状況をDBから読み、通知を貼り直す。
 *
 * 体重・腹囲の通知は「記録済みなら鳴らさない」条件付きなので、
 * 設定を変えたとき・アプリを開いたときだけでなく、記録を保存したあとにも呼ぶ。
 */
export async function refreshReminders(profile: Profile): Promise<void> {
  if (!isNativeApp()) return;

  const weightEnabled = profile.notifyWeight ?? false;
  const waistEnabled = profile.notifyWaist ?? false;
  if (!weightEnabled && !waistEnabled) {
    await cancelAllReminders();
    return;
  }

  const weighed = await db.weights
    .where('[profileId+date]')
    .equals([profile.id, todayStr()])
    .first();

  await syncReminders(
    {
      weightEnabled,
      weightTimes: profile.notifyWeightTimes ?? DEFAULT_WEIGHT_NOTIFY_TIMES,
      waistEnabled,
      waistWeekday: profile.notifyWaistWeekday ?? DEFAULT_WAIST_NOTIFY_WEEKDAY,
    },
    {
      weightRecordedToday: weighed != null,
      lastWaistDate: waistEnabled ? await lastWaistDate(profile.id) : undefined,
    },
  );
}
