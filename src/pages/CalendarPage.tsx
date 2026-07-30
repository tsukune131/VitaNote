import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type NoteEntry, type Profile, type StepEntry } from '../db';
import { AutosaveNote, useAutosave } from '../components/autosave';
import {
  WEEKDAY_LABELS,
  addMonths,
  dayOfMonthOf,
  daysInMonth,
  formatDateShort,
  formatMonth,
  monthDates,
  todayStr,
  weekdayOf,
} from '../lib/date';
import { isHealthSyncEnabled } from '../lib/health';

interface DayRow {
  date: string;
  step?: StepEntry;
  note?: NoteEntry;
}

/**
 * 1か月を1日1行の表で見渡すページ。歩数の合計とメモを同じ行に並べ、
 * どちらもその場でタップして書き込める。
 * 24個ある時間帯別の歩数は、行に置くと表が読めなくなるので別のシートに追い出す。
 */
export function CalendarPage({ profile }: { profile: Profile }) {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  // 開いているシート(どちらも同時には開かない)
  const [stepsDate, setStepsDate] = useState<string | undefined>();
  const [noteDate, setNoteDate] = useState<string | undefined>();

  const data = useLiveQuery(
    async () => {
      const start = `${month}-01`;
      const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
      const range = (table: 'steps' | 'notes') =>
        db
          .table(table)
          .where('[profileId+date]')
          .between([profile.id, start], [profile.id, end], true, true)
          .toArray();
      const [steps, notes] = await Promise.all([range('steps'), range('notes')]);
      return { steps: steps as StepEntry[], notes: notes as NoteEntry[] };
    },
    [profile.id, month],
  );

  const rows: DayRow[] = useMemo(() => {
    const steps = new Map((data?.steps ?? []).map((s) => [s.date, s]));
    const notes = new Map((data?.notes ?? []).map((n) => [n.date, n]));
    return monthDates(month).map((date) => ({
      date,
      step: steps.get(date),
      note: notes.get(date),
    }));
  }, [data, month]);

  const stepDays = rows.filter((r) => (r.step?.total ?? 0) > 0);
  const stepTotal = stepDays.reduce((s, r) => s + (r.step?.total ?? 0), 0);
  const stepAverage = stepDays.length > 0 ? Math.round(stepTotal / stepDays.length) : 0;

  function moveMonth(delta: number) {
    setMonth((m) => addMonths(m, delta));
  }

  return (
    <div>
      <div className="date-nav">
        <button onClick={() => moveMonth(-1)} aria-label="前の月">
          ◀
        </button>
        <div className="title">{formatMonth(month)}</div>
        <button onClick={() => moveMonth(1)} disabled={month >= thisMonth} aria-label="次の月">
          ▶
        </button>
        <button onClick={() => setMonth(thisMonth)} disabled={month === thisMonth}>
          今月
        </button>
      </div>

      <div className="card">
        <h2>この月の歩数</h2>
        <div className="stat-grid">
          <div className="stat">
            <div className="label">合計</div>
            <div className="value">
              {stepTotal.toLocaleString()}
              <small> 歩</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">記録した日の平均</div>
            <div className="value">
              {stepAverage.toLocaleString()}
              <small> 歩 / {stepDays.length}日</small>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>日ごとの歩数とメモ</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          歩数をタップすると時間帯別(1時間ごと)を、メモをタップするとその日のメモを書けます。
        </p>
        <table className="calendar-table">
          <thead>
            <tr>
              <th className="calendar-col-day">日</th>
              <th className="calendar-col-steps">歩数</th>
              <th>メモ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <CalendarRow
                key={r.date}
                row={r}
                isToday={r.date === today}
                isFuture={r.date > today}
                onOpenSteps={() => setStepsDate(r.date)}
                onOpenNote={() => setNoteDate(r.date)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {stepsDate && (
        <StepsSheet profile={profile} date={stepsDate} onClose={() => setStepsDate(undefined)} />
      )}
      {noteDate && (
        <NoteSheet profileId={profile.id} date={noteDate} onClose={() => setNoteDate(undefined)} />
      )}
    </div>
  );
}

function CalendarRow({
  row,
  isToday,
  isFuture,
  onOpenSteps,
  onOpenNote,
}: {
  row: DayRow;
  isToday: boolean;
  isFuture: boolean;
  onOpenSteps: () => void;
  onOpenNote: () => void;
}) {
  const weekday = weekdayOf(row.date);
  const hasHourly = row.step?.hourly?.some((v) => v > 0) ?? false;
  const rowClass = ['calendar-row', weekday === 0 || weekday === 6 ? 'weekend' : '', isToday ? 'today' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={rowClass}>
      <td className="calendar-col-day">
        {dayOfMonthOf(row.date)}
        <span className="calendar-weekday">({WEEKDAY_LABELS[weekday]})</span>
      </td>
      <td className="calendar-col-steps">
        {isFuture ? (
          <span className="calendar-blank">—</span>
        ) : (
          <button
            // 時間帯別の記録がある日は点線を引いて、内訳が見られることを示す
            className={`calendar-cell calendar-cell-steps${hasHourly ? ' has-hourly' : ''}`}
            onClick={onOpenSteps}
            aria-label={`${formatDateShort(row.date)}の歩数`}
          >
            {row.step ? (
              row.step.total.toLocaleString()
            ) : (
              <span className="calendar-add">＋</span>
            )}
          </button>
        )}
      </td>
      <td>
        {isFuture ? (
          <span className="calendar-blank">—</span>
        ) : (
          <button
            className="calendar-cell calendar-cell-note"
            onClick={onOpenNote}
            aria-label={`${formatDateShort(row.date)}のメモ`}
          >
            {row.note?.text ? (
              row.note.text
            ) : (
              <span className="calendar-add">＋ メモ</span>
            )}
          </button>
        )}
      </td>
    </tr>
  );
}

/* ---------- 歩数のシート(合計+時間帯別) ---------- */

function StepsSheet({
  profile,
  date,
  onClose,
}: {
  profile: Profile;
  date: string;
  onClose: () => void;
}) {
  const profileId = profile.id;
  const entry = useLiveQuery(
    () => db.steps.where('[profileId+date]').equals([profileId, date]).first(),
    [profileId, date],
  );
  // 連携中の「今日」はアプリを開くたびヘルスケアの値で上書きされるので手入力させない。
  // 過去日は取り込みが手入力を上書きしないため、そのまま編集できる。
  // ただし取り込めていないうちは手入力を残す(ヘルスケアの許可を断った場合に
  // 空の入力欄が編集できないまま残ってしまうため)
  const managedByHealth =
    isHealthSyncEnabled(profile) && date === todayStr() && (entry?.total ?? 0) > 0;
  const [total, setTotal] = useState('');
  const [hourly, setHourly] = useState<string[]>(Array(24).fill(''));

  // ヘルスケアからの取り込みは同じ行を更新するので、idだけでなく値の変化も見て
  // 入力欄に反映する(反映しないと古い手入力値で上書きし返してしまう)
  useEffect(() => {
    if (entry) {
      setTotal(String(entry.total));
      if (entry.hourly) setHourly(entry.hourly.map((v) => (v ? String(v) : '')));
    }
  }, [entry?.id, entry?.total]);

  const hourlyNums = hourly.map((v) => Number(v) || 0);
  const hourlySum = hourlyNums.reduce((a, b) => a + b, 0);
  const hasHourly = hourlySum > 0;
  const peak = Math.max(...hourlyNums);

  const currentTotal = hasHourly ? hourlySum : Number(total) || 0;
  const dirty =
    currentTotal !== (entry?.total ?? 0) ||
    (hasHourly && JSON.stringify(hourlyNums) !== JSON.stringify(entry?.hourly ?? []));

  async function save() {
    const t = hasHourly ? hourlySum : Number(total) || 0;
    if (!(t > 0)) return; // 空(0歩)は保存しない
    const data = { total: t, hourly: hasHourly ? hourlyNums : undefined };
    if (entry) await db.steps.update(entry.id, data);
    else await db.steps.add({ profileId, date, ...data } as never);
  }

  // 連携中の今日はヘルスケアが正なので、こちらから保存し返さない
  const editable = !managedByHealth;
  useAutosave(`${total}|${hasHourly}|${hourly.join(',')}`, dirty && editable, save);

  // 自動保存は入力が止まってから走るので、待たずに閉じたぶんはここで書き込む
  async function close() {
    if (dirty && editable) await save();
    onClose();
  }

  return (
    <Sheet title={`${formatDateShort(date)} の歩数`} onClose={close}>
      <p className="muted" style={{ marginTop: 0 }}>
        {managedByHealth
          ? 'ヘルスケアから自動で取り込んでいます。アプリを開くたびに最新になります。'
          : 'iPhoneのヘルスケアアプリの歩数を転記してください。時間帯別を入力すると、その合計が1日の合計になります。'}
      </p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          1日の合計歩数{hasHourly && editable && '(時間帯別の合計)'}
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={hasHourly ? String(hourlySum) : total}
            disabled={hasHourly || managedByHealth}
            onChange={(e) => setTotal(e.target.value)}
          />
        </label>
        {editable && <AutosaveNote dirty={dirty} saved={entry != null && !dirty} />}
      </div>

      <h3>時間帯別(1時間ごと)</h3>
      {/* 内訳がまだ1つも無い日は棒を出さず、入力欄を時刻の隣に寄せて書きやすくする */}
      <div className={peak > 0 ? 'steps-hours' : 'steps-hours no-bars'}>
        {hourly.map((v, h) => (
          <div className="steps-hour" key={h}>
            <span className="steps-hour-label">{h}時</span>
            {peak > 0 && (
              <span className="steps-hour-bar" aria-hidden="true">
                <span style={{ width: `${(hourlyNums[h] / peak) * 100}%` }} />
              </span>
            )}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              aria-label={`${h}時台の歩数`}
              value={v}
              disabled={managedByHealth}
              onChange={(e) => setHourly((arr) => arr.map((x, i) => (i === h ? e.target.value : x)))}
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------- メモのシート ---------- */

function NoteSheet({
  profileId,
  date,
  onClose,
}: {
  profileId: number;
  date: string;
  onClose: () => void;
}) {
  const entry = useLiveQuery(
    () => db.notes.where('[profileId+date]').equals([profileId, date]).first(),
    [profileId, date],
  );
  const [text, setText] = useState('');

  // 読み込みが終わるまでは空欄のまま。空欄と既存メモの差はdirtyにならないので、
  // 読み込み前に閉じても空で上書きすることはない
  useEffect(() => {
    if (entry) setText(entry.text);
  }, [entry?.id]);

  const dirty = text !== (entry?.text ?? '');

  async function save() {
    const t = text.trim();
    if (entry) {
      if (t) await db.notes.update(entry.id, { text: t });
      else await db.notes.delete(entry.id); // 空にしたら消す
    } else if (t) {
      await db.notes.add({ profileId, date, text: t } as never);
    }
  }

  useAutosave(text, dirty, save);

  async function close() {
    if (dirty) await save();
    onClose();
  }

  return (
    <Sheet title={`${formatDateShort(date)} のメモ`} onClose={close} bodyClass="sheet-fill">
      <textarea
        className="note-area"
        autoFocus
        placeholder="がんばったこと、気づいたこと、明日の自分へのひとことなど"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <AutosaveNote dirty={dirty} saved={entry != null && !dirty} />
      </div>
    </Sheet>
  );
}

/* ---------- 共通のシート ---------- */

function Sheet({
  title,
  onClose,
  bodyClass,
  children,
}: {
  title: string;
  onClose: () => void;
  bodyClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={() => void onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={() => void onClose()}>
            閉じる
          </button>
        </div>
        <div className={bodyClass ? `modal-body ${bodyClass}` : 'modal-body'}>{children}</div>
      </div>
    </div>
  );
}
