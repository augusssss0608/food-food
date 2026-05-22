import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VARIANTS: { slug: string; title: string; tagline: string; desc: string; group?: 'old' | 'new' }[] = [
  { slug: 'v3-fab', title: '1. FAB Quick Actions', tagline: 'Floating action button', group: 'old',
    desc: '主屏右下浮動 FAB → 扇形展開 3 個子按鈕，各自全屏。' },
  { slug: 'v5-ledger', title: '2. Today Ledger', tagline: 'Inline insert into diary', group: 'old',
    desc: '取消 + 按鈕，「今日已記錄」末尾就是輸入入口。MyFitnessPal Quick Add 心智。' },
  { slug: 'v7-dial', title: '3. Macro Dial', tagline: 'iPod click wheel', group: 'old',
    desc: '主頁 + → 拇指旋轉切餐，中心大卡顯示完整 macro，每過一項輕震。' },
  { slug: 'v14-dock', title: '4. Dock Grid', tagline: 'iOS-style 5tab + 3×3', group: 'new',
    desc: '主頁不變。屏底 5 tab（★/早/午/晚/零）+ 3×3 chip grid。tap chip 記錄，長按 chip 進入摇晃編輯。' },
  { slug: 'v15-bands', title: '5. Time Bands', tagline: '4 時段水平帶', group: 'new',
    desc: '主頁不變。屏底 4 行（早午晚零）並列，每行 3 chip 永遠暴露，當前時段那行高亮。長按 chip 輪換。' },
  { slug: 'v16-cluster', title: '6. Cluster Map', tagline: 'Spatial 4-cluster', group: 'new',
    desc: '主頁不變。屏底 4 cluster 圓形聚類（早午晚零），當前時段放大居中。tap 聚類內 chip 直接記錄。' },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">6 種新增餐入口</h1>
        <p className="text-[13px] text-text-3 mt-2">主頁結構保留，只變化新增那一刻的入口和交互。</p>
      </header>
      <p className="text-[10px] uppercase tracking-[0.24em] text-text-3 font-mono mb-2">第一輪 · 慣常模式</p>
      <ul className="space-y-2.5 mb-7">
        {VARIANTS.filter((v) => v.group !== 'new').map((v) => (
          <li key={v.slug}>
            <Link
              href={`/prototype/${v.slug}`}
              className="block bg-surface border border-hairline rounded-xl px-4 py-3.5 hover:border-hairline-strong hover:bg-surface-2 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <p className="text-[14px] font-medium text-text">{v.title}</p>
                <p className="text-[10px] font-mono text-text-3 uppercase tracking-wider">{v.tagline}</p>
              </div>
              <p className="text-[12px] text-text-3 leading-snug">{v.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-2">第二輪 · 預篩分桶（不翻牌不搜索）</p>
      <ul className="space-y-2.5">
        {VARIANTS.filter((v) => v.group === 'new').map((v) => (
          <li key={v.slug}>
            <Link
              href={`/prototype/${v.slug}`}
              className="block bg-surface border border-accent/30 rounded-xl px-4 py-3.5 hover:border-accent/60 hover:bg-surface-2 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <p className="text-[14px] font-medium text-text">{v.title}</p>
                <p className="text-[10px] font-mono text-accent/80 uppercase tracking-wider">{v.tagline}</p>
              </div>
              <p className="text-[12px] text-text-3 leading-snug">{v.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
