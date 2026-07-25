import { useState } from 'react';

export type LegalDoc = 'privacy' | 'terms';

const TITLES: Record<LegalDoc, string> = {
  privacy: 'プライバシーポリシー',
  terms: '利用規約',
};

/**
 * 法務文書へのリンク。アプリ内のシートで開く。
 *
 * 以前は target="_blank" の普通のリンクだったが、Capacitorのアプリでは
 * WKWebViewが新しいウィンドウを作れないため、タップしても何も起きなかった。
 * 文書はアプリに同梱しているHTMLをiframeで表示するので、通信は発生しない。
 */
export function LegalLink({ doc }: { doc: LegalDoc }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="linklike" onClick={() => setOpen(true)}>
        {TITLES[doc]}
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{TITLES[doc]}</h2>
              <button className="ghost" onClick={() => setOpen(false)}>
                閉じる
              </button>
            </div>
            <iframe
              className="modal-frame"
              src={`${import.meta.env.BASE_URL}legal/${doc}.html`}
              title={TITLES[doc]}
            />
          </div>
        </div>
      )}
    </>
  );
}
