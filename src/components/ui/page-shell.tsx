import type { ReactNode } from 'react';

/**
 * 統一頁面外殼：
 * - 內容靠頂、保留與 top bar / 狀態欄的安全距離（不做整頁垂直置中）
 * - `max-w-md mx-auto`（或 wide variant）：水平置中 + 內容寬度上限
 * - `safe-area-inset` 處理：iOS PWA viewport-fit:cover 下，避免內容被狀態欄 / home indicator 遮擋
 * - 可選 `footer`：常駐底部
 *
 * 想統一修改 padding / 寬度，只動這裡。
 */
export function PageShell({
  children,
  wide = false,
  footer,
  px = 'px-5',
}: {
  children: ReactNode;
  /** admin/debug 那類大寬版面 */
  wide?: boolean;
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
        // 內容靠頂，但與狀態欄保留呼吸距離；safe-area-inset-top 處理瀏海 / Dynamic Island
        paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full">{children}</div>
      {footer}
    </main>
  );
}
