import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VARIANTS: { slug: string; title: string; tagline: string; desc: string; group?: 'old' | 'new' }[] = [
  { slug: 'v3-fab', title: '1. FAB Quick Actions', tagline: 'Floating action button', group: 'old',
    desc: '主屏右下浮動 FAB → 扇形展開 3 個子按鈕，各自全屏。' },
  { slug: 'v5-ledger', title: '2. Today Ledger', tagline: 'Inline insert into diary', group: 'old',
    desc: '取消 + 按鈕，「今日已記錄」末尾就是輸入入口。MyFitnessPal Quick Add 心智。' },
  { slug: 'v7-dial', title: '3. Macro Dial', tagline: 'iPod click wheel', group: 'old',
    desc: '主頁 + → 拇指旋轉切餐，中心大卡顯示完整 macro，每過一項輕震。' },
  { slug: 'v9-receipt', title: '4. Thermal Receipt', tagline: 'POS / dot matrix print', group: 'new',
    desc: '主屏 = 餐廳熱感小票，新增 = 在最末尾「繼續打印」一行。撕紙、印章戳、SUBTOTAL。' },
  { slug: 'v10-spike', title: '5. Order Spike', tagline: 'Kitchen ticket spike', group: 'new',
    desc: '中央一根鋼針，preset 票紙從底部抽屜「拋」上去，刺穿堆疊。角度錯落、紙片有皺。' },
  { slug: 'v11-plate', title: '6. Plate Composition', tagline: 'Mondrian on a dish', group: 'new',
    desc: '一日 = 一幅色塊構圖。preset 按宏量染色，飛入大圓盤、spiral packing 自動排布。' },
  { slug: 'v12-apothecary', title: '7. Apothecary Counter', tagline: 'Lab dosing station', group: 'new',
    desc: '主燒瓶顯示一日吸收，HOLD 試管 → 傾倒、液面分層上升。化學家儀式感。' },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">7 種新增餐入口</h1>
        <p className="text-[13px] text-text-3 mt-2">每個方案獨立路由，使用相同真實數據。點卡片進入體驗。</p>
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
      <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-2">第二輪 · 概念驅動</p>
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
