import { useState } from 'react';
import { db, setActiveProfileId } from '../db';
import { LegalLink } from './LegalLink';
import { ProfileForm } from './ProfileForm';
import { UsageGuide } from './UsageGuide';

type Step = 'welcome' | 'profile' | 'goal' | 'guide';

const STEPS: Step[] = ['welcome', 'profile', 'goal', 'guide'];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [profileId, setProfileId] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetFat, setTargetFat] = useState('');
  const [targetDate, setTargetDate] = useState('');

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
        <h1>VitaNote</h1>
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
          <h2>あなたについて教えてください</h2>
          <p className="muted">
            身長・生年月日・性別・活動レベルから、1日の推定消費カロリーを計算します。
            この計算をもとに「きょうの処方箋」が、目標までに必要な歩数やご飯の量を教えてくれます。
          </p>
          <ProfileForm
            onSaved={async (id) => {
              await setActiveProfileId(id);
              setProfileId(id);
              setStep('goal');
            }}
          />
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
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </label>
          </div>
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
          <p className="muted">この説明は「設定」タブからいつでも読み返せます。</p>
          <button onClick={onComplete}>はじめる</button>
        </div>
      )}
    </div>
  );
}
