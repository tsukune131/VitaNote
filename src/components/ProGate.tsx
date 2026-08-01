import { useState, type ReactNode } from 'react';
import { usePro } from '../lib/pro';
import { isNativeApp } from '../lib/platform';
import { LegalLink } from './LegalLink';

/** Proで何が増えるか。案内文と設定タブで同じ並びを使う */
const PRO_FEATURES = [
  '血液検査(健康診断)の結果を検査日ごとに記録し、年ごとの表で振り返る',
  '血圧・血糖値の記録とグラフ',
];

/**
 * Proでないときだけ「🔒 Pro」の錠前を出す小さな見出し用ラベル。
 * カードは無料でも見えるので、何が有料なのかはここで示す
 */
export function ProBadge() {
  const { isPro } = usePro();
  if (isPro) return null;
  return <span className="pro-badge">🔒 Pro</span>;
}

/**
 * 記録の入力口をProで塞ぐ覆い。読むほうは塞がない。
 *
 * 無料の人にも過去の記録は見えるようにしてある(体調の記録を人質に取らない)。
 * 新しく書こうとしたときにだけ、ここが購入の案内に差し替わる。
 */
export function ProLock({ children }: { children: ReactNode }) {
  const { isPro } = usePro();
  const [open, setOpen] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      <div className="pro-lock">
        {/* 中身は形だけ見せる。何が書ける欄なのか分かるほうが、買うか決めやすい */}
        <div className="pro-lock-body" aria-hidden="true">
          {children}
        </div>
        <button className="pro-lock-cover" onClick={() => setOpen(true)}>
          <span className="pro-lock-icon">🔒</span>
          <span>ここに書くにはProが要ります</span>
          <span className="pro-lock-hint">タップして詳しく</span>
        </button>
      </div>
      {open && <ProSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/** 購入の案内シート。価格・買えるもの・復元・法務リンクをここに集める */
export function ProSheet({ onClose }: { onClose: () => void }) {
  const { isPro, price, busy, error, purchase, restore } = usePro();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fit" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>SelfCareNote Pro</h2>
          <button className="ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="modal-body">
          {isPro ? (
            <p className="pro-thanks">ご購入ありがとうございます。すべての記録がお使いいただけます。</p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                健診や生活習慣病の数値までこの1冊で管理するための、買い切りの追加機能です。
                一度買えば期限はありません。
              </p>
              <ul className="pro-feature-list">
                {PRO_FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              {isNativeApp() ? (
                <>
                  <button
                    className="pro-buy"
                    onClick={() => void purchase()}
                    disabled={busy || price == null}
                  >
                    {price != null ? `${price} で購入(買い切り)` : '価格を読み込み中…'}
                  </button>
                  {/* 復元はApp Storeの審査で必須。買い直しを求めない */}
                  <button className="secondary" onClick={() => void restore()} disabled={busy}>
                    購入を復元
                  </button>
                </>
              ) : (
                <p className="muted">購入はiPhoneアプリでのみ行えます。</p>
              )}

              {error && <p className="pro-error">{error}</p>}

              <p className="muted note">
                お支払いはApple IDに請求されます。同じApple IDの端末では「購入を復元」から
                引き継げます。データは今までどおり端末の中だけに保存され、購入しても外部へは
                送信されません。
              </p>
              <div className="row" style={{ gap: 12 }}>
                <LegalLink doc="terms" />
                <LegalLink doc="privacy" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
