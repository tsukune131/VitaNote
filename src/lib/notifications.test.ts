import { describe, expect, it } from 'vitest';
import { waistReminderDates } from './notifications';

/** 2026-07-29は水曜。腹囲通知は毎週その曜日の9:00 */
const WEDNESDAY = 3;
const wed9 = (date: string) => new Date(`${date}T09:00:00`);

describe('waistReminderDates', () => {
  it('指定曜日の9:00を週ごとに積む', () => {
    const now = new Date('2026-07-27T12:00:00'); // 月曜
    expect(waistReminderDates(WEDNESDAY, 3, now)).toEqual([
      wed9('2026-07-29'),
      wed9('2026-08-05'),
      wed9('2026-08-12'),
    ]);
  });

  it('当日の9:00を過ぎていれば翌週から積む', () => {
    const now = new Date('2026-07-29T10:00:00');
    expect(waistReminderDates(WEDNESDAY, 2, now)).toEqual([wed9('2026-08-05'), wed9('2026-08-12')]);
  });

  it('直近1週間に腹囲の記録があれば、次の1回は積まない', () => {
    const now = new Date('2026-07-27T12:00:00');
    expect(waistReminderDates(WEDNESDAY, 3, now, '2026-07-27')).toEqual([
      wed9('2026-08-05'),
      wed9('2026-08-12'),
    ]);
  });

  it('前回の通知日ちょうどの記録は「先週ぶん」なので次の1回を止めない', () => {
    const now = new Date('2026-07-27T12:00:00');
    const dates = waistReminderDates(WEDNESDAY, 2, now, '2026-07-22');
    expect(dates[0]).toEqual(wed9('2026-07-29'));
  });

  it('1週間より前の記録は次の1回を止めない', () => {
    const now = new Date('2026-07-27T12:00:00');
    const dates = waistReminderDates(WEDNESDAY, 2, now, '2026-07-10');
    expect(dates[0]).toEqual(wed9('2026-07-29'));
  });
});
