'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 延遲 router.refresh()，配合導航當下手動取消，解「mutation 後 0-3s 內點 drawer 跳轉卡」問題。
 *
 * 根因（codex 3 輪定位）：
 * - Next 15 router.refresh() 內部已 startTransition，外層再包冗餘
 * - refresh 完成時會清空整個 prefetchCache（refresh-reducer.js:71-77）→ 下一次點 drawer 變 cold navigation
 * - App Router action queue 中 navigation 會優先 + discard pending refresh（app-router-instance.js:97-112）
 *
 * 策略：mutation 後不立即 refresh，延遲 2500ms 給用戶導航時間窗。
 * 用戶在這段時間內導航 → drawer item click 觸發 cancelDeferredRefresh() 把 timer 殺掉，
 * 進新頁前不會清 prefetch cache。
 *
 * 為什麼是 module-level singleton 而不是 component ref：
 * - 多個 mutation 來源（meal / workout / body）共用一個 timer，避免並發排程
 * - drawer Link onClick 在另一棵組件樹，要能跨組件 cancel，只能用 module 全域
 *
 * 為什麼**不**做 useEffect pathname cleanup（codex round D blocker 反饋）：
 * - meal save / delete 流程是「呼叫 deferredRefresh() → 立刻 onDone() 收起 inline editor」
 * - inline editor unmount 會觸發 caller 的 cleanup → cancel 自己剛排的 timer → refresh 永遠不跑
 * - 真正的 cancel 點在 navigation intent 當下（drawer item click），不應該掛在 transient caller 上
 * - pathname 變了 timer 仍跑的副作用：在新 pathname 上多一次 RSC refresh，非 bug
 */
let refreshTimer: number | null = null;

export function cancelDeferredRefresh() {
  if (refreshTimer != null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export function useDeferredRefresh() {
  const router = useRouter();

  return useCallback((delayMs = 2500) => {
    cancelDeferredRefresh();
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      router.refresh();
    }, delayMs);
  }, [router]);
}
