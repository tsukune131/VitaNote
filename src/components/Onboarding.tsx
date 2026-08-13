import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setActiveProfileId, type Profile } from '../db';
import { bmi } from '../lib/calc';
import { todayStr } from '../lib/date';
import { LegalLink } from './LegalLink';
import { ProfileForm } from './ProfileForm';
import { SourcesLink } from './SourcesSheet';
import { UsageGuide } from './UsageGuide';

type Step = 'welcome' | 'profile' | 'goal' | 'guide';

const STEPS: Step[] = ['welcome', 'profile', 'goal', 'guide'];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [profileId, setProfileId] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetFat, setTargetFat] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // 低体重の警告を出すのに身長が要る。入力せずに進んだ人は身長が無いので判定しない
  const created = useLiveQuery(
    () => (profileId != null ? db.profiles.get(profileId) : undefined),
    [profileId],
  );
  const targetKg = Number(targetWeight);
  const targetBmi =
    targetKg > 0 && created?.heightCm != null ? bmi(targetKg, created.heightCm) : undefined;
  const targetUnderweight = targetBmi != null && targetBmi < 18.5;

  async function continueWithProfile(id: number) {
    await setActiveProfileId(id);
    setProfileId(id);
    setStep('goal');
  }

  /** 何も入力しない人のために、活動レベルだけの空のプロフィールを作って進む */
  async function skipProfile() {
    const id = await db.profiles.add({ activityLevel: 1.375 } as Profile);
    await continueWithProfile(id);
  }

  async function saveGoalAndContinue() {
    const w = Number(targetWeight);
    const f = Number(targetFat);
    if (profileId != null && (w > 0 || f > 0 || targetDate)) {
      await db.profiles.update(profileId, {
        targetWeightKg: w > 0 ? w : undefined,
        targetFatPct: f > 0 ? f : undefined,
        targetDate: targetDate || undefined,
      });
    }
    setStep('guide');
  }

  return (
    <div>
      <div className="app-header">
        <h1>SelfCareNote</h1>
      </div>

      <div className="onboarding-dots">
        {STEPS.map((s) => (
          <span key={s} className={`dot ${step === s ? 'active' : ''}`} />
        ))}
      </div>

      {step === 'welcome' && (
        <div className="card">
          <h2>ようこそ 👋</h2>
          <p className="muted">
            体重とお薬を1冊にまとめる、手帳のような記録アプリです。
            記録は端末の中だけに保存されます。アカウント登録も広告もなく、
            データが外部に送信されることはありません。
          </p>
          <ul className="onboarding-list">
            <li>体重・体脂肪率・腹囲を記録</li>
            <li>食事のカロリーと時刻、飲水を記録</li>
            <li>歩数・運動の消費カロリーを記録</li>
            <li>お薬の飲み忘れをチェック</li>
            <li>血圧・血糖値、健康診断の血液検査も記録</li>
            <li>推移をグラフでふりかえり</li>
          </ul>
          {/* 1.4.1が求める「医師に相談するよう促すこと」。規約の中だけでなく、
              最初に必ず通る画面に置く */}
          <p className="muted note">
            本アプリは記録のための道具で、医療機器ではありません。表示される数値は推定値です。
            <strong>体調や減量の進め方は医師にご相談ください。</strong>
          </p>
          <button onClick={() => setStep('profile')}>はじめる</button>
          <p className="muted" style={{ marginBottom: 0 }}>
            はじめると
            <LegalLink doc="terms" />と<LegalLink doc="privacy" />
            に同意したものとみなされます。
          </p>
        </div>
      )}

      {step === 'profile' && (
        <div className="card">
          <h2>あなたについて(すべて任意)</h2>
          <p className="muted">
            入力しなくても、体重・食事・お薬などの記録はすべてお使いいただけます。
            身長・生年月日・性別・活動レベルを入れると、1日の推定消費カロリーを計算でき、
            「きょうの目安」が目標までに必要な歩数やご飯の量を教えてくれます。
            あとから「あなた」タブでいつでも入力・削除できます。
          </p>
          <ProfileForm onSaved={(id) => void continueWithProfile(id)} />
          <button className="secondary" onClick={() => void skipProfile()}>
            入力せずにつづける
          </button>
        </div>
      )}

      {step === 'goal' && (
        <div className="card">
          <h2>目標を設定しましょう</h2>
          <p className="muted">
            あとから「あなた」タブでいつでも変更できます。目標腹囲もそちらで設定できます。
          </p>
          <div className="row">
            <label className="field">
              目標体重(kg)
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
              />
            </label>
            <label className="field">
              目標体脂肪率(%)
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                max="80"
                value={targetFat}
                onChange={(e) => setTargetFat(e.target.value)}
              />
            </label>
            <label className="field field-fixed-date">
              目標達成日
              {/* 過去の日付は「残り0日」となり逆算が破綻する。「あなた」タブと同じ制限をかける */}
              <input
                type="date"
                min={todayStr()}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </label>
          </div>
          {/* 無理な目標を黙って受け取らない。「あなた」タブと同じ警告をこの画面にも出す */}
          {targetUnderweight && (
            <p className="goal-warning">
              この目標体重はBMI{targetBmi?.toFixed(1)}で、低体重(18.5未満)にあたります。
              設定はできますが、健康を損なうおそれがあります。医師にご相談ください。
            </p>
          )}
          <div className="row">
            <button onClick={() => void saveGoalAndContinue()}>設定してつづける</button>
            <button className="secondary" onClick={() => setStep('guide')}>
              あとで設定する
            </button>
          </div>
        </div>
      )}

      {step === 'guide' && (
        <div className="card">
          <h2>使い方</h2>
          <UsageGuide onboarding />
          <p className="muted">
            この説明は「設定」タブからいつでも読み返せます。
            数値の計算式と出典は<SourcesLink label="こちら" />。
          </p>
          <button onClick={onComplete}>はじめる</button>
        </div>
      )}
    </div>
  );
}
