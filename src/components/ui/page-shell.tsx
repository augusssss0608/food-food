import type { ReactNode } from 'react';

/**
 * 統一頁面外殼：
 * - `<main>` 是頁面唯一滾動容器（globals.css: height 100dvh + overflow-y auto）
 * - 內容靠頂、保留與狀態欄的安全距離（不做整頁垂直置中）
 * - 水平 `max-w-md mx-auto`（或 wide variant），px-5 / px-6 內距
 * - `safe-area-inset` 處理 iOS PWA viewport-fit:cover 下的瀏海 / home indicator
 * - 可選 `footer`：撐到 main 底部（內容用 `grow` 占滿剩餘空間時 footer 留在底）
 *
 * 短頁面：content 不超過 main 高度 → 不滾動，無 iOS rubber-band
 * 長頁面：content 超過 main 高度 → main 滾動，iOS native rubber-band 自動有
 */
export function PageShell({
  children,
  wide = false,
  footer,
  px = 'px-5',
}: {
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
  px?: 'px-5' | 'px-6';
}) {
  return (
    <main
      className={[
        'flex flex-col',
        wide ? 'max-w-5xl' : 'max-w-md',
        'mx-auto',
        px,
      ].join(' ')}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full grow">{children}</div>
      {footer && <div className="w-full shrink-0">{footer}</div>}
    </main>
  );
}
