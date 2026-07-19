import { db } from '../db';
import { todayStr } from './date';

/**
 * iOSショートカット連携:
 * 「?steps=7842」(任意で &date=YYYY-MM-DD)付きでアプリを開くと、
 * その日の歩数として取り込む。ヘルスケアの歩数をショートカットで
 * 読み取ってこのURLを開けば、ワンタップで記録できる。
 */

export interface StepsImportRequest {
  steps: number;
  date: string;
}

export function readStepsParam(search: string, today: string = todayStr()): StepsImportRequest | undefined {
  const params = new URLSearchParams(search);
  const steps = Math.round(Number(params.get('steps')));
  if (!Number.isFinite(steps) || steps <= 0) return undefined;
  const dateParam = params.get('date');
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  return { steps, date };
}

/** 取り込み後にURLからパラメータを消す(リロードでの二重取り込み防止) */
export function clearStepsParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('steps');
  url.searchParams.delete('date');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/** その日の歩数として保存(既存があれば合計を上書き。時間帯別入力は保持) */
export async function importSteps(profileId: number, req: StepsImportRequest): Promise<void> {
  const existing = await db.steps
    .where('[profileId+date]')
    .equals([profileId, req.date])
    .first();
  if (existing) {
    await db.steps.update(existing.id, { total: req.steps });
  } else {
    await db.steps.add({ profileId, date: req.date, total: req.steps } as never);
  }
}
