'use client';
import { useEffect } from 'react';

/**
 * iOS PWA standalone 模式下，左/右邊緣 touchstart 在 capture phase 直接
 * preventDefault，阻止系統觸發 swipe-back / swipe-forward navigation gesture。
 *
 * 必須限制觸發條件，否則會破壞表單 focus / 文字選取 / 橫向滾動 / 按鈕點擊：
 * - 只在 iOS standalone PWA 下啟用（navigator.standalone 或 display-mode: standalone）
 * - 只在事件可取消、單指、起點 X 落在邊緣 16px 內
 * - 排除互動元素（input/textarea/select/button/a/[contenteditable]）
 * - 排除標記 `data-horizontal-scroll` 的容器（admin/debug 表格水平滾動）
 *
 * 注意：這只是輔助防線；主防線是 app 內所有導航用 router.replace（讓系統 history
 * 沒有可回退項），見 commit 對應的 Link replace / location.replace 改動。
 */
export function NoSwipeBackGesture() {
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone = nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPhone|iPad|iPod/.test(nav.userAgent);
    if (!standalone || !isIOS) return;

    const EDGE = 16;
    const INTERACTIVE = 'input, textarea, select, button, a, [contenteditable], [role="textbox"], [data-horizontal-scroll]';

    const onTouchStart = (e: TouchEvent) => {
      if (!e.cancelable) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      const x = t.clientX;
      const w = window.innerWidth;
      if (x > EDGE && x < w - EDGE) return;
      const target = e.target as Element | null;
      if (target?.closest?.(INTERACTIVE)) return;
      e.preventDefault();
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    return () => document.removeEventListener('touchstart', onTouchStart, { capture: true } as EventListenerOptions);
  }, []);

  return null;
}
