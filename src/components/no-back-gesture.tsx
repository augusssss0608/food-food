'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 屏蔽 iOS PWA standalone 模式下從屏幕左側右滑觸發的 history.back 手勢。
 *
 * 實現：
 * - 每次 route 切換時往 history 壓一個同 URL 的 dummy state
 * - popstate 觸發時（用戶滑了 / 瀏覽器返回了）再 push 一個 dummy state
 *
 * 結果：用戶怎麼滑都回不去，URL 始終停留在當前頁。app 內 Link / router.push
 * 不受影響（它們走 pushState，不觸發 popstate）。
 */
export function NoBackGesture() {
  const pathname = usePathname();

  // 路由變化時壓一個 dummy state（消費掉本來會回上一頁的那一步）
  useEffect(() => {
    history.pushState(null, '', location.href);
  }, [pathname]);

  // 全域 popstate handler，只裝一次；任何返回手勢觸發都立即再 push 一個同 URL
  useEffect(() => {
    const onPop = () => {
      history.pushState(null, '', location.href);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return null;
}
