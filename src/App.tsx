import { lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Profile } from './db';
import { Onboarding } from './components/Onboarding';
import {
  importStepsFromHealth,
  isHealthSyncEnabled,
  isHealthSyncUnset,
  requestHealthAccess,
} from './lib/health';
import { YouPage } from './pages/YouPage';
import { RecordPage } from './pages/RecordPage';
import { SettingsPage } from './pages/SettingsPage';

// Rechartsを使う推移画面はバンドルの大部分を占めるため、選んだ時だけ読み込む
const TrendsPage = lazy(() => import('./pages/TrendsPage').then((m) => ({ default: m.TrendsPage })));

type Tab = 'you' | 'record' | 'trends' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'you', label: 'あなた' },
  { key: 'record', label: 'きょう' },
  { key: 'trends', label: 'ふりかえり' },
  { key: 'settings', label: '設定' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('record');
  // プロフィール作成の途中でprofiles.length が 0→1 に変わっても
  // オンボーディングの残りのステップ(目標設定・使い方)が飛ばされないよう、
  // 一度決めたら明示的にonComplete()が呼ばれるまで維持する
  const [onboarding, setOnboarding] = useState<boolean | undefined>(undefined);

  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const activeIdSetting = useLiveQuery(() => db.settings.get('activeProfileId'), []);

  useEffect(() => {
    if (profiles === undefined) return;
    if (profiles.length === 0) {
      // プロフィールが無ければ常にオンボーディングへ(削除して0件に戻った場合も含む)
      setOnboarding(true);
    } else if (onboarding === undefined) {
      // 既存ユーザーの起動時のみ、初回判定としてスキップする
      setOnboarding(false);
    }
  }, [profiles, onboarding]);

  const activeId = activeIdSetting ? Number(activeIdSetting.value) : undefined;
  const profile: Profile | undefined = profiles?.find((p) => p.id === activeId) ?? profiles?.[0];

  // ヘルスケア連携は既定でオン。起動時と前面復帰のたびに歩数を取り込む。
  // まだ一度も設定していなければ、ここで許可を求めてからオンとして確定する
  // (オンボーディング中は邪魔になるので、終わってから求める)
  const syncHealth = profile ? isHealthSyncEnabled(profile) : false;
  const askAccess = profile ? isHealthSyncUnset(profile) : false;
  const profileId = profile?.id;
  useEffect(() => {
    if (!syncHealth || profileId === undefined || onboarding !== false) return;

    let stopped = false;
    const sync = async () => {
      if (stopped) return;
      await importStepsFromHealth(profileId);
    };

    void (async () => {
      if (askAccess) {
        // 要求が失敗したときは未設定のままにして、次の起動でまた求める。
        // ここでtrueを保存してしまうと、一度失敗しただけで二度と要求しなくなる
        const asked = await requestHealthAccess();
        if (stopped) return;
        if (asked) await db.profiles.update(profileId, { syncHealth: true });
      }
      await sync();
    })();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [syncHealth, askAccess, profileId, onboarding]);

  if (profiles === undefined || onboarding === undefined) return null; // 読み込み中

  if (onboarding) {
    return <Onboarding onComplete={() => setOnboarding(false)} />;
  }

  if (profile === undefined) return null;

  return (
    <div>
      <div className="app-header">
        <h1>VitaNote</h1>
      </div>

      {tab === 'you' && <YouPage profile={profile} />}
      {tab === 'record' && <RecordPage profile={profile} />}
      {tab === 'trends' && (
        <Suspense fallback={<div className="empty-note">読み込み中…</div>}>
          <TrendsPage profile={profile} />
        </Suspense>
      )}
      {tab === 'settings' && <SettingsPage profile={profile} />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
