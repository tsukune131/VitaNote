import { useEffect, useRef } from 'react';

/**
 * 入力が変わったら少し待って(デバウンス)自動保存する。保存ボタンを不要にする。
 * signature が変わるたびにタイマーをリセットするので、入力が止まってから保存される。
 */
export function useAutosave(signature: string, dirty: boolean, save: () => Promise<void>) {
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void saveRef.current(), 600);
    return () => clearTimeout(t);
  }, [signature, dirty]);
}

/** 自動保存の状態表示(保存ボタンの代わり) */
export function AutosaveNote({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  return (
    <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
      {dirty ? '自動保存します…' : saved ? '保存済み ✓' : ''}
    </span>
  );
}
