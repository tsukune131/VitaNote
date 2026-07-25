import { db } from '../db';
import { addDays, toDateStr, todayStr } from './date';
import { isNativeApp } from './platform';

/**
 * ヘルスケア(HealthKit)連携。
 * 歩数は読み取り、体重・体脂肪率は書き戻す。iOSのネイティブアプリのときだけ動き、
 * PWA/Webでは何もしない(呼び出し側は連携なしの状態としてそのまま動く)。
 *
 * プラグインはネイティブでしか使わないので、Webのバンドルに載らないよう動的に読み込む。
 */

/** 読み取る種別 */
const READ_TYPES = ['steps'] as const;
/** 書き戻す種別 */
const WRITE_TYPES = ['weight', 'bodyFat'] as const;

/** 起動時にさかのぼって取り込む日数(前日以前は手入力を上書きしない) */
const IMPORT_DAYS = 7;

async function plugin() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

export interface HealthAvailability {
  available: boolean;
  /** 使えないときの理由。実機でしか起きない失敗を画面から追えるようにするため表示する */
  reason?: string;
}

/**
 * この端末でヘルスケアが使えるか。
 * ネイティブ呼び出しが応答を返さないケースでも画面が「判定中」のまま
 * 固まらないよう、5秒で打ち切る。
 */
export async function checkHealthAvailability(): Promise<HealthAvailability> {
  if (!isNativeApp()) return { available: false, reason: 'アプリ版ではありません' };
  try {
    const timeout = new Promise<HealthAvailability>((resolve) =>
      setTimeout(() => resolve({ available: false, reason: 'ヘルスケアの応答がありません' }), 5000),
    );
    const check = (async (): Promise<HealthAvailability> => {
      const { available, reason } = await (await plugin()).isAvailable();
      return { available, reason };
    })();
    return await Promise.race([check, timeout]);
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * ヘルスケアへのアクセスを要求する(OSの許可シートが出る)。
 * iOSは「読み取りを許可したか」をアプリに教えない仕様のため、シートを出せたらtrueを返す。
 * 実際に読めたかどうかは importStepsFromHealth() の戻り値で判断する。
 */
export async function requestHealthAccess(): Promise<boolean> {
  if (!(await checkHealthAvailability()).available) return false;
  try {
    await (await plugin()).requestAuthorization({
      read: [...READ_TYPES],
      write: [...WRITE_TYPES],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 直近IMPORT_DAYS日分の歩数をヘルスケアから取り込む。
 * 今日は毎回上書きする(ヘルスケアの値を正とする)が、前日以前は
 * 記録が無い日だけ埋める(手入力した過去の値を消さないため)。
 * 戻り値は書き込んだ日数。
 */
export async function importStepsFromHealth(profileId: number): Promise<number> {
  if (!isNativeApp()) return 0;

  const today = todayStr();
  const start = addDays(today, -(IMPORT_DAYS - 1));

  let samples;
  try {
    const result = await (await plugin()).queryAggregated({
      dataType: 'steps',
      startDate: new Date(`${start}T00:00:00`).toISOString(),
      endDate: new Date(`${addDays(today, 1)}T00:00:00`).toISOString(),
      bucket: 'hour',
      aggregation: 'sum',
    });
    samples = result.samples;
  } catch {
    // 未許可・ヘルスケア無効など。連携なしの状態として黙って諦める
    return 0;
  }

  // 1時間ごとのバケットを、ローカルタイムの日付ごとの24要素配列にまとめる
  const byDate = new Map<string, number[]>();
  for (const s of samples) {
    const at = new Date(s.startDate);
    const date = toDateStr(at);
    const hourly = byDate.get(date) ?? Array(24).fill(0);
    hourly[at.getHours()] += Math.round(s.value);
    byDate.set(date, hourly);
  }

  let written = 0;
  for (const [date, hourly] of byDate) {
    const total = hourly.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;

    const existing = await db.steps.where('[profileId+date]').equals([profileId, date]).first();
    if (existing) {
      if (date !== today) continue; // 過去日の手入力は尊重する
      if (existing.total === total) continue;
      await db.steps.update(existing.id, { total, hourly });
    } else {
      await db.steps.add({ profileId, date, total, hourly } as never);
    }
    written++;
  }
  return written;
}

/**
 * 記録した体重・体脂肪率をヘルスケアへ書き戻す。
 * 保存の主役はあくまでアプリ内のDBなので、失敗しても呼び出し側は気にしない。
 */
export async function writeBodyMetricsToHealth(
  date: string,
  kg: number,
  bodyFatPct?: number,
): Promise<void> {
  if (!isNativeApp()) return;

  // 今日ぶんは今の時刻、過去日を編集したときはその日の正午として記録する
  const at = date === todayStr() ? new Date() : new Date(`${date}T12:00:00`);
  const startDate = at.toISOString();

  try {
    const Health = await plugin();
    await Health.saveSample({ dataType: 'weight', value: kg, startDate });
    if (bodyFatPct != null && bodyFatPct > 0) {
      // HealthKitのpercentは0〜1の割合。22.5%は0.225として渡す
      await Health.saveSample({ dataType: 'bodyFat', value: bodyFatPct / 100, startDate });
    }
  } catch {
    // 未許可など。アプリ内の記録は済んでいるので何もしない
  }
}
