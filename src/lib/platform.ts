import { Capacitor } from '@capacitor/core';

/** Capacitorのネイティブアプリとして動いているか(WebやPWAならfalse) */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * その日の歩数をネイティブ(HealthKit)から取得する。
 * フェーズCでHealthKitプラグイン(候補: @perfood/capacitor-healthkit)を
 * 差し込むまではundefinedを返し、UIは手入力のまま動く。
 */
export async function fetchNativeSteps(_date: string): Promise<number | undefined> {
  if (!isNativeApp()) return undefined;
  // TODO(フェーズC): HealthKitから歩数を取得する
  return undefined;
}

/**
 * 毎日の記録リマインダー通知を設定する(ネイティブのみ)。
 * hour/minuteはローカル時刻。フェーズCで実機確認する。
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: 'WeightNote',
        body: 'きょうの体重を書き込みましょう',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  });
  return true;
}

/** リマインダー通知を解除する */
export async function cancelDailyReminder(): Promise<void> {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
}
