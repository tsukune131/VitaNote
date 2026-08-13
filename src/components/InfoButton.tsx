import { useRef, useState } from 'react';
import { type SourceId } from '../lib/sources';
import { SourcesSheet } from './SourcesSheet';

/**
 * カードの見出しの右端に置く、出典への入口。
 *
 * 推定値を見せている場所には計算式と出典への導線が要る(ガイドライン1.4.1)。
 * これまでは各カードの下に45〜100字の地の文で書いていたが、同じことを何度も
 * 読ませる割に紙面を埋めてしまうので、見出しの横のボタン1つに置き換えた。
 *
 * 記号だけのアイコンにはしない。審査は日本語を読まない担当者が数分で見るため、
 * 灰色の丸は翻訳しても何も出ず、実質「表示していない」のと同じになる。
 * グリフの右に「出典」の2字を必ず添える。
 */
export function InfoButton({ about, label }: { about: SourceId[]; label: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        className="info-btn"
        ref={btnRef}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="10" cy="6" r="0.9" fill="currentColor" stroke="none" />
          <path
            d="M10 9.2v5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="info-btn-text">出典</span>
      </button>
      {open && (
        <SourcesSheet
          focus={about}
          onClose={() => {
            setOpen(false);
            // シートを閉じたら、開いたボタンに戻す(支援技術で迷子にならないように)
            btnRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
