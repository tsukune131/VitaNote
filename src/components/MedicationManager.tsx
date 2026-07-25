import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  MEDICATION_SLOT_LABELS,
  MEDICATION_TIMING_LABELS,
  type MealSlot,
  type Medication,
  type MedicationFrequency,
  type MedicationTiming,
} from '../db';
import { WEEKDAY_LABELS, todayStr } from '../lib/date';

const MEALS: { key: MealSlot; label: string }[] = (
  ['breakfast', 'lunch', 'dinner', 'snack'] as const
).map((key) => ({ key, label: MEDICATION_SLOT_LABELS[key] }));

const TIMINGS: MedicationTiming[] = ['before', 'after', 'between'];

const FREQUENCIES: { key: MedicationFrequency; label: string }[] = [
  // 就寝前も選べるようになったので「食事ごと」ではなく「毎日」と呼ぶ
  { key: 'meal', label: '毎日' },
  { key: 'weekly', label: '週1回' },
  { key: 'monthly', label: '月1回' },
];

function describeMedication(m: Medication): string {
  const freq = m.frequency ?? 'meal';
  if (freq === 'weekly') {
    return `週1回・${WEEKDAY_LABELS[m.weekday ?? 0]}曜日`;
  }
  if (freq === 'monthly') {
    return `月1回・${m.dayOfMonth ?? 1}日`;
  }
  const mealLabel = (m.meals ?? []).map((mm) => MEDICATION_SLOT_LABELS[mm]).join('/');
  return `${MEDICATION_TIMING_LABELS[m.timing ?? 'after']}・${mealLabel}`;
}

/** 薬の登録・編集・削除(1行=1種類)。日を跨いで引き継がれる薬マスタを管理する */
export function MedicationManager({ profileId }: { profileId: number }) {
  const medications = useLiveQuery(
    async () => {
      const rows = await db.medications.where('profileId').equals(profileId).toArray();
      rows.sort((a, b) => a.id - b.id);
      return rows;
    },
    [profileId],
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<MedicationFrequency>('meal');
  const [timing, setTiming] = useState<MedicationTiming>('after');
  const [meals, setMeals] = useState<Set<MealSlot>>(new Set());
  const [weekday, setWeekday] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);

  function resetForm() {
    setEditingId(null);
    setName('');
    setFrequency('meal');
    setTiming('after');
    setMeals(new Set());
    setWeekday(0);
    setDayOfMonth(1);
  }

  function startEdit(med: Medication) {
    setEditingId(med.id);
    setName(med.name);
    setFrequency(med.frequency ?? 'meal');
    setTiming(med.timing ?? 'after');
    setMeals(new Set(med.meals ?? []));
    setWeekday(med.weekday ?? 0);
    setDayOfMonth(med.dayOfMonth ?? 1);
  }

  function toggleMeal(key: MealSlot) {
    setMeals((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const valid = name.trim() !== '' && (frequency !== 'meal' || meals.size > 0);

  async function save() {
    if (!valid) return;
    const base = { name: name.trim(), frequency };
    const data =
      frequency === 'meal'
        ? { ...base, timing, meals: [...meals], weekday: undefined, dayOfMonth: undefined }
        : frequency === 'weekly'
          ? { ...base, weekday, timing: undefined, meals: undefined, dayOfMonth: undefined }
          : { ...base, dayOfMonth, timing: undefined, meals: undefined, weekday: undefined };
    if (editingId != null) await db.medications.update(editingId, data);
    else await db.medications.add({ profileId, ...data, startDate: todayStr() } as never);
    resetForm();
  }

  async function remove(id: number) {
    await db.transaction('rw', [db.medications, db.medicationLogs], async () => {
      await db.medications.delete(id);
      await db.medicationLogs.where('medicationId').equals(id).delete();
    });
    if (editingId === id) resetForm();
  }

  return (
    <div className="menu-panel">
      {(medications ?? []).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {medications!.map((m) => (
            <div className="list-item" key={m.id}>
              <span>
                {m.name}
                <span className="muted"> ({describeMedication(m)})</span>
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="ghost" onClick={() => startEdit(m)}>
                  編集
                </button>
                <button className="danger" onClick={() => void remove(m.id)}>
                  削除
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <label className="field">
        薬の名前
        <input
          type="text"
          placeholder="例: 血圧の薬"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field">
        頻度
        <div className="row" style={{ marginTop: 4 }}>
          {FREQUENCIES.map((f) => (
            <label className="checkbox-inline" key={f.key}>
              <input
                type="radio"
                checked={frequency === f.key}
                onChange={() => setFrequency(f.key)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {frequency === 'meal' && (
        <>
          <div className="field">
            タイミング
            <div className="row" style={{ marginTop: 4 }}>
              {TIMINGS.map((t) => (
                <label className="checkbox-inline" key={t}>
                  <input type="radio" checked={timing === t} onChange={() => setTiming(t)} />
                  {MEDICATION_TIMING_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            対象の時間帯
            <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
              {MEALS.map((m) => (
                <label className="checkbox-inline" key={m.key}>
                  <input
                    type="checkbox"
                    checked={meals.has(m.key)}
                    onChange={() => toggleMeal(m.key)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {frequency === 'weekly' && (
        <label className="field">
          曜日
          <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label}曜日
              </option>
            ))}
          </select>
        </label>
      )}

      {frequency === 'monthly' && (
        <label className="field">
          日にち
          <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}日
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="row">
        <button onClick={() => void save()} disabled={!valid} style={{ flex: '0 0 auto' }}>
          {editingId != null ? '更新' : '追加'}
        </button>
        {editingId != null && (
          <button className="secondary" onClick={resetForm} style={{ flex: '0 0 auto' }}>
            キャンセル
          </button>
        )}
      </div>
    </div>
  );
}
