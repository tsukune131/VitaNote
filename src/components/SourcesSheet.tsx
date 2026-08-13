import { useEffect, useRef, useState } from 'react';
import { MEDICAL_SOURCES, SOURCES_CHECKED_ON, type SourceId } from '../lib/sources';

/**
 * 健康・医学に関する数値の出典を見せるシート。
 *
 * 画面のあちこちに同じ免責を書き写す代わりに、文章はすべてここに集約している。
 * 各画面からは見出しの「ⓘ 出典」とタブ末尾の1行だけで、ここに1タップで来られる
 * (App Store Reviewガイドライン1.4.1が求めているのは開示と到達可能性であって、
 *  各画面での繰り返しではない)。
 *
 * 法務文書(LegalLink)と違ってiframeではなくReactで描く。iframeの中のリンクは
 * WKWebViewではシートの中で外部サイトに飛んでしまい、戻れなくなるため。
 * 本文と同じフレームに置けば、Capacitorが外部リンクを端末のブラウザに渡してくれる。
 *
 * リンクが開けない状況(圏外など)でも出典として成立するよう、URLは文字としても見せる。
 */
export function SourcesSheet({ focus, onClose }: { focus?: SourceId[]; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('sheet-open');
    return () => document.body.classList.remove('sheet-open');
  }, []);

  // ハードウェアキーボードや支援技術から閉じられるようにする
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 「この数字の出典」から開いたときは、その項目まで送る
  useEffect(() => {
    const first = focus?.[0];
    if (!first) return;
    bodyRef.current
      ?.querySelector(`#source-${first}`)
      ?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [focus]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sources-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="sources-sheet-title">数値の出典</h2>
          <button className="ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        {/* 共通のことわりは本文の外に固定する。本文の中に置くと、項目を指定して
            開いたときにscrollIntoViewで画面の外へ流れてしまい、読まれない */}
        <p className="sheet-lede">
          このアプリが表示する数値は、下記の資料に基づく<strong>推定値・目安</strong>です。
          本アプリは医療機器ではなく、診断・治療・予防を行うものではありません。
          体調や持病、減量の進め方は、アプリの数値だけで判断せず医師などの専門家にご相談ください。
        </p>
        <div className="modal-body" ref={bodyRef}>
          {MEDICAL_SOURCES.map((s) => (
            // 見ていた数字の項目だけを開く。閉じた見出しがそのまま目次として働くので、
            // 11項目を縦に全部読ませずに済む
            <details
              className="source"
              id={`source-${s.id}`}
              key={s.id}
              open={!focus?.length || focus.includes(s.id)}
            >
              <summary>
                <h3>{s.heading}</h3>
              </summary>
              <p className="source-formula">{s.formula}</p>
              {s.note && <p className="muted note">{s.note}</p>}
              <ul className="source-refs">
                {s.refs.map((r) => (
                  <li key={r.url}>
                    <span className="source-publisher">{r.publisher}</span>
                    {r.title}
                    <br />
                    {/* target属性は付けない。Capacitorが同フレームの外部リンクを端末のブラウザに渡す */}
                    <a href={r.url} className="source-url">
                      {r.url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ))}

          <p className="muted note">
            リンク先の到達を確認した日: {SOURCES_CHECKED_ON}
            <br />
            リンクをタップすると、端末のブラウザで出典のページが開きます。
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 出典シートを開くリンク。文言を添えたい場所で使う。
 * 見出しの横に小さく置くだけでよい場所には InfoButton を使う。
 */
export function SourcesLink({
  focus,
  label = '数値の出典',
}: {
  focus?: SourceId[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="linklike" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <SourcesSheet focus={focus} onClose={() => setOpen(false)} />}
    </>
  );
}
