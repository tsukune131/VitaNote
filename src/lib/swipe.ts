import { useRef, type TouchEvent } from 'react';

/** これ以上の横移動で「払った」と見なす(px) */
const MIN_DISTANCE = 60;
/** 縦にこれ以上ぶれていたら、ページのスクロールと見なして無視する */
const MAX_OFF_AXIS_RATIO = 0.6;

/**
 * 左右に払う操作を拾うだけの小さな仕掛け。
 * 返り値をそのまま要素に展開して使う: <div {...useSwipe(fn)}>
 *
 * 左へ払うと+1(次)、右へ払うと-1(前)。◀▶ボタンと同じ向きに合わせている。
 */
export function useSwipe(onSwipe: (delta: 1 | -1) => void, enabled = true) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart(e: TouchEvent<HTMLElement>) {
      // 2本指(拡大縮小)や、横スクロールできる部品の上から始まった指は相手にしない
      if (
        !enabled ||
        e.touches.length !== 1 ||
        startedInHorizontalScroller(e.target as Element | null, e.currentTarget)
      ) {
        start.current = null;
        return;
      }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchMove(e: TouchEvent<HTMLElement>) {
      if (e.touches.length > 1) start.current = null;
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dy) > Math.abs(dx) * MAX_OFF_AXIS_RATIO) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

/**
 * 指を置いた場所が横スクロールする部品(タブの帯、はみ出す表)の中かどうか。
 * はみ出しているだけの要素(グラフのSVGなど)と区別するため、
 * overflow-xがスクロールする指定になっているものだけを数える。
 */
function startedInHorizontalScroller(target: Element | null, root: Element) {
  for (let n = target; n && n !== root; n = n.parentElement) {
    if (n.scrollWidth <= n.clientWidth + 4) continue;
    const overflowX = getComputedStyle(n).overflowX;
    if (overflowX === 'auto' || overflowX === 'scroll') return true;
  }
  return false;
}
