import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Prototype 索引頁：列出 8 個 add-meal 入口方案的卡片。
 * 每張卡進入獨立路由體驗該方案；都用相同 mock data。
 */
const VARIANTS: { slug: string; title: string; tagline: string; desc: string }[] = [
  { slug: 'v3-fab', title: '1. FAB Quick Actions', tagline: 'Floating action button',
    desc: '主屏右下浮動 FAB → 扇形展開 3 個子按鈕，各自全屏。' },
  { slug: 'v4-shelf', title: '2. 餐盤架 Shelf', tagline: 'Persistent bottom dock',
    desc: '主頁底部常駐一條 peek，短拉露出常用 / 長拉打開完整菜單庫。' },
  { slug: 'v5-ledger', title: '3. Today Ledger', tagline: 'Inline insert into diary',
    desc: '取消 + 按鈕，「今日已記錄」末尾就是輸入入口。MyFitnessPal Quick Add 心智。' },
  { slug: 'v7-dial', title: '4. Macro Dial', tagline: 'iPod click wheel',
    desc: '主頁 + → 拇指旋轉切餐，中心大卡顯示完整 macro，每過一項輕震。' },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">8 種新增餐入口</h1>
        <p className="text-[13px] text-text-3 mt-2">每個方案獨立路由，使用相同 mock 數據。點卡片進入體驗。</p>
      </header>
      <ul className="space-y-2.5">
        {VARIANTS.map((v) => (
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
    </div>
  );
}
