import type { ReactNode } from 'react';

/**
 * 統一頁面外殼：
 * - `min-h-dvh flex flex-col` + 內層 `m-auto`：iPhone 屏幕高度內容自動垂直置中
 * - `max-w-md mx-auto`（或 wide variant）：水平置中 + 內容寬度上限
 * - `safe-area-inset` 處理：iOS PWA viewport-fit:cover 下，避免內容被狀態欄 / home indicator 遮擋
 * - 可選 `footer`：常駐底部，不參與置中
 *
 * 想統一修改 padding / 寬度 / 置中行為，只動這裡。
 */
export function PageShell({
  children,
  wide = false,
  topAlign = false,
  footer,
  px = 'px-5',
}: {
  children: ReactNode;
  /** admin/debug 那類大寬版面 */
  wide?: boolean;
  /** 不做垂直置中（內容靠頂順序流，如有滾動列表） */
  topAlign?: boolean;
  /** 常駐底部的內容（如 login 頁的 version footer） */
  footer?: ReactNode;
  /** 水平 padding，默認 px-5 */
  px?: 'px-5' | 'px-6';
}) {
  return (
    <main
      className={[
        'min-h-dvh flex flex-col',
        wide ? 'max-w-5xl' : 'max-w-md',
        'mx-auto',
        px,
      ].join(' ')}
      style={{
        // safe-area + 視覺氣息空間；用 max() 保證至少 1.5rem，不會在沒 notch 的瀏覽器塌成 0
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      {topAlign ? (
        <div className="w-full">{children}</div>
      ) : (
        <div className="m-auto w-full">{children}</div>
      )}
      {footer}
    </main>
  );
}
