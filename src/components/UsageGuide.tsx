import { isNativeApp } from '../lib/platform';

/**
 * タブごとの使い方の説明。
 * オンボーディングの最後と「設定」タブの両方から使う。
 * 機能を足したときに説明が食い違わないよう、文言はここ1箇所にまとめる。
 */
export function UsageGuide({ onboarding = false }: { onboarding?: boolean }) {
  // ヘルスケア連携はiOSのアプリ版だけの機能なので、Web/PWAでは案内しない
  const native = isNativeApp();

  return (
    <>
      <div className="onboarding-guide-item">
        <span className="tab-name">あなた</span>
        <div>
          <p className="muted">
            プロフィールと目標、必要な1日消費カロリーを確認します。
            健康診断の血液検査もここに記録します。
          </p>
        </div>
      </div>
      <div className="onboarding-guide-item">
        <span className="tab-name">きょう</span>
        <div>
          <p className="muted">
            毎日ここに書き込みます。体重・体脂肪率・腹囲、食事、飲水、運動、
            お薬のチェックが1ページにまとまっています。
          </p>
        </div>
      </div>
      <div className="onboarding-guide-item">
        <span className="tab-name">カレンダー</span>
        <div>
          <p className="muted">
            1か月を1日1行で見渡します。歩数とメモはここに書き込みます。
            歩数をタップすると時間帯別(1時間ごと)の内訳が開きます。
          </p>
        </div>
      </div>
      <div className="onboarding-guide-item">
        <span className="tab-name">ふりかえり</span>
        <div>
          <p className="muted">グラフで体重やカロリー貯金の推移を確認します。</p>
        </div>
      </div>
      <div className="onboarding-guide-item">
        <span className="tab-name">設定</span>
        <div>
          <p className="muted">
            お薬や血圧・血糖値の記録を使うかどうか、リマインダー通知
            {native && '、ヘルスケア連携'}をここで切り替えます。
          </p>
        </div>
      </div>

      {native && (
        <>
          <h3>ヘルスケア連携について</h3>
          <ul className="onboarding-list">
            {onboarding && <li>このあと、ヘルスケアへのアクセスを確認する画面が出ます</li>}
            <li>歩数は自動で取り込まれるので、書き写す必要はありません</li>
            <li>記録した体重・体脂肪率はヘルスケアにも書き戻されます</li>
            <li>連携中、その日の歩数は手入力できません(ヘルスケアの値を使います)</li>
            <li>連携が不要なら「設定」タブでオフにできます</li>
          </ul>
        </>
      )}

      <h3>記録の保存について</h3>
      <p className="muted">
        記録はこの端末の中だけに保存されます。安全な代わりに、
        <strong>アプリを削除すると記録も消えます</strong>。
        機種変更のときもデータは引き継がれませんのでご注意ください。
      </p>
    </>
  );
}
