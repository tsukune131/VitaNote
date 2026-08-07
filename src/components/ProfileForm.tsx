import { useState, type FormEvent } from 'react';
import { db, type Profile, type Sex } from '../db';
import { ACTIVITY_LEVELS } from '../lib/calc';

interface Props {
  profile?: Profile; // 省略時は新規作成
  onSaved?: (id: number) => void;
}

export function ProfileForm({ profile, onSaved }: Props) {
  const [name, setName] = useState(profile?.name ?? '');
  const [heightCm, setHeightCm] = useState(profile?.heightCm != null ? String(profile.heightCm) : '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [sex, setSex] = useState<Sex | ''>(profile?.sex ?? '');
  const [activityLevel, setActivityLevel] = useState(profile?.activityLevel ?? 1.375);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // すべて任意入力。空欄のまま保存でき、入力があった項目だけ推定計算に使う
    const data = {
      name: name.trim() || undefined,
      heightCm: Number(heightCm) > 0 ? Number(heightCm) : undefined,
      birthDate: birthDate || undefined,
      sex: sex || undefined,
      activityLevel,
    };
    let id: number;
    if (profile) {
      await db.profiles.update(profile.id, data);
      id = profile.id;
    } else {
      id = await db.profiles.add(data as Profile);
    }
    onSaved?.(id);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="field">
        ニックネーム(任意)
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="row">
        <label className="field">
          身長(cm・任意)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="50"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </label>
        <label className="field field-fixed-date">
          生年月日(任意)
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="field">
          性別(任意)
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
            <option value="">未回答</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        <label className="field">
          活動レベル
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(Number(e.target.value))}
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit">保存</button>
    </form>
  );
}
