import { useState, type FormEvent } from 'react';
import { db, type Profile, type Sex } from '../db';
import { ACTIVITY_LEVELS } from '../lib/calc';

interface Props {
  profile?: Profile; // 省略時は新規作成
  onSaved?: (id: number) => void;
}

export function ProfileForm({ profile, onSaved }: Props) {
  const [name, setName] = useState(profile?.name ?? '');
  const [heightCm, setHeightCm] = useState(profile ? String(profile.heightCm) : '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male');
  const [activityLevel, setActivityLevel] = useState(profile?.activityLevel ?? 1.375);

  const valid = name.trim() !== '' && Number(heightCm) > 0 && birthDate !== '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const data = {
      name: name.trim(),
      heightCm: Number(heightCm),
      birthDate,
      sex,
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
        名前
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="row">
        <label className="field">
          身長(cm)
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
          生年月日
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="field">
          性別(計算用)
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
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
      <button type="submit" disabled={!valid}>
        保存
      </button>
    </form>
  );
}
