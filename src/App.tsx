import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setActiveProfileId, type Profile } from './db';
import { ProfileForm } from './components/ProfileForm';
import { YouPage } from './pages/YouPage';
import { RecordPage } from './pages/RecordPage';
import { TrendsPage } from './pages/TrendsPage';

type Tab = 'you' | 'record' | 'trends';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'you', icon: '👤', label: 'あなた' },
  { key: 'record', icon: '✏️', label: '記録' },
  { key: 'trends', icon: '📈', label: '推移' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('record');

  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const activeIdSetting = useLiveQuery(() => db.settings.get('activeProfileId'), []);

  if (profiles === undefined) return null; // 読み込み中

  if (profiles.length === 0) {
    return (
      <div>
        <div className="app-header">
          <h1>体重管理</h1>
        </div>
        <div className="card">
          <h2>ようこそ!まずプロフィールを作成してください</h2>
          <ProfileForm
            onSaved={async (id) => {
              await setActiveProfileId(id);
            }}
          />
        </div>
      </div>
    );
  }

  const activeId = activeIdSetting ? Number(activeIdSetting.value) : undefined;
  const profile: Profile = profiles.find((p) => p.id === activeId) ?? profiles[0];

  return (
    <div>
      <div className="app-header">
        <h1>体重管理</h1>
        <select
          style={{ width: 'auto', marginTop: 0 }}
          value={profile.id}
          onChange={(e) => void setActiveProfileId(Number(e.target.value))}
          aria-label="プロフィール切替"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {tab === 'you' && <YouPage profile={profile} />}
      {tab === 'record' && <RecordPage profile={profile} />}
      {tab === 'trends' && <TrendsPage profile={profile} />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
