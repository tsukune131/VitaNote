import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MealSlot, type Medication, type MedicationTiming } from '../db';

const MEALS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: '朝食' },
  { key: 'lunch', label: '昼食' },
  { key: 'dinner', label: '夕食' },
  { key: 'snack', label: '間食' },
];

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
  const [timing, setTiming] = useState<MedicationTiming>('after');
  const [meals, setMeals] = useState<Set<MealSlot>>(new Set());

  function resetForm() {
    setEditingId(null);
    setName('');
    setTiming('after');
    setMeals(new Set());
  }

  function startEdit(med: Medication) {
    setEditingId(med.id);
    setName(med.name);
    setTiming(med.timing);
    setMeals(new Set(med.meals));
  }

  function toggleMeal(key: MealSlot) {
    setMeals((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!name.trim() || meals.size === 0) return;
    const data = { name: name.trim(), timing, meals: [...meals] };
    if (editingId != null) await db.medications.update(editingId, data);
    else await db.medications.add({ profileId, ...data } as never);
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
                <span className="muted">
                  {' '}
                  ({m.timing === 'before' ? '食前' : '食後'}・
                  {m.meals.map((mm) => MEALS.find((x) => x.key === mm)?.label).join('/')})
                </span>
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
        タイミング
        <div className="row" style={{ marginTop: 4 }}>
          <label className="checkbox-inline">
            <input
              type="radio"
              checked={timing === 'before'}
              onChange={() => setTiming('before')}
            />
            食前
          </label>
          <label className="checkbox-inline">
            <input type="radio" checked={timing === 'after'} onChange={() => setTiming('after')} />
            食後
          </label>
        </div>
      </div>

      <div className="field">
        対象の食事
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

      <div className="row">
        <button
          onClick={() => void save()}
          disabled={!name.trim() || meals.size === 0}
          style={{ flex: '0 0 auto' }}
        >
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
