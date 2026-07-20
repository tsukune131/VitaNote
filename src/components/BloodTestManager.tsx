import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BLOOD_TEST_FIELDS, type BloodTestEntry } from '../db';
import { formatDateShort, todayStr } from '../lib/date';

/**
 * 健康診断・血液検査の結果を登録・編集・削除する(1回=1行)。
 * 日々の記録とは別に、検査を受けた都度「あなた」タブから追加する。
 */
export function BloodTestManager({ profileId }: { profileId: number }) {
  const tests = useLiveQuery(
    async () => {
      const rows = await db.bloodTests.where('profileId').equals(profileId).toArray();
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return rows;
    },
    [profileId],
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [date, setDate] = useState(todayStr());
  const [values, setValues] = useState<Record<string, string>>({});

  function resetForm() {
    setEditingId(null);
    setDate(todayStr());
    setValues({});
  }

  function startEdit(t: BloodTestEntry) {
    setEditingId(t.id);
    setDate(t.date);
    const v: Record<string, string> = {};
    for (const f of BLOOD_TEST_FIELDS) {
      const raw = t[f.key];
      if (typeof raw === 'number') v[f.key] = String(raw);
    }
    setValues(v);
  }

  async function save() {
    if (!date) return;
    const data: Record<string, unknown> = { date };
    for (const f of BLOOD_TEST_FIELDS) {
      const n = Number(values[f.key]);
      data[f.key] = n > 0 ? n : undefined;
    }
    if (editingId != null) await db.bloodTests.update(editingId, data);
    else await db.bloodTests.add({ profileId, ...data } as never);
    resetForm();
  }

  async function remove(id: number) {
    await db.bloodTests.delete(id);
    if (editingId === id) resetForm();
  }

  return (
    <div className="card">
      <h2>血液検査</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        健康診断や数か月に一度の血液検査の結果を記録します。「ふりかえり」タブで年ごとの表として振り返れます。
      </p>

      {(tests ?? []).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {tests!.map((t) => (
            <div className="list-item" key={t.id}>
              <span>{formatDateShort(t.date)}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="ghost" onClick={() => startEdit(t)}>
                  編集
                </button>
                <button className="danger" onClick={() => void remove(t.id)}>
                  削除
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <label className="field">
        検査日
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div className="metric-grid">
        {BLOOD_TEST_FIELDS.map((f) => (
          <label className="field" key={f.key}>
            {f.label}
            {f.unit && `(${f.unit})`}
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      <div className="row">
        <button onClick={() => void save()} disabled={!date} style={{ flex: '0 0 auto' }}>
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
