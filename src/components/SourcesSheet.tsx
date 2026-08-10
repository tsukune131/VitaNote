import { useEffect, useRef, useState } from 'react';
import { MEDICAL_SOURCES, SOURCES_CHECKED_ON, type SourceId } from '../lib/sources';

/**
 * 健康・医学に関する数値の出典を見せるシート。
 *
 * 法務文書(LegalLink)と違ってiframeではなくReactで描く。iframeの中のリンクは
 * WKWebViewではシートの中で外部サイトに飛んでしまい、戻れなくなるため。
 * 本文と同じフレームに置けば、Capacitorが外部リンクを端末のブラウザに渡してくれる。
 *
 * リンクが開けない状況(圏外など)でも出典として成立するよう、URLは文字としても見せる。
 */
export function SourcesSheet({ focus, onClose }: { focus?: SourceId; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('sheet-open');
    return () => document.body.classList.remove('sheet-open');
  }, []);

  // 「この数字の出典」から開いたときは、その項目まで送る
  useEffect(() => {
    if (!focus) return;
    bodyRef.current
      ?.querySelector(`#source-${focus}`)
      ?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [focus]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>数値の出典</h2>
          <button className="ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="modal-body" ref={bodyRef}>
          <p className="muted" style={{ marginTop: 0 }}>
            本アプリが表示する健康に関する数値は、下記の資料に基づく<strong>推定値・目安</strong>です。
            本アプリは医療機器ではなく、診断・治療・予防を目的とするものではありません。
            体調や持病に関する判断は医師などの専門家にご相談ください。
          </p>

          {MEDICAL_SOURCES.map((s) => (
            <section className="source" id={`source-${s.id}`} key={s.id}>
              <h3>{s.heading}</h3>
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
            </section>
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
 * 出典シートを開くリンク。計算結果を見せている場所のすぐ近くに置く。
 * focusを渡すと、その数字の項目まで送った状態で開く。
 */
export function SourcesLink({
  focus,
  label = '数値の出典',
}: {
  focus?: SourceId;
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
