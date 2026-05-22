import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VARIANTS: { slug: string; title: string; tagline: string; desc: string; group?: 'old' | 'new' }[] = [
  { slug: 'v3-fab', title: '1. FAB Quick Actions', tagline: 'Floating action button', group: 'old',
    desc: '主屏右下浮動 FAB → 扇形展開 3 個子按鈕，各自全屏。' },
  { slug: 'v5-ledger', title: '2. Today Ledger', tagline: 'Inline insert into diary', group: 'old',
    desc: '取消 + 按鈕，「今日已記錄」末尾就是輸入入口。MyFitnessPal Quick Add 心智。' },
  { slug: 'v7-dial', title: '3. Macro Dial', tagline: 'iPod click wheel', group: 'old',
    desc: '主頁 + → 拇指旋轉切餐，中心大卡顯示完整 macro，每過一項輕震。' },
  { slug: 'v9-radial', title: '4. Radial Bloom', tagline: 'Thumb-arc fan-out', group: 'new',
    desc: '主頁不變。右下小圓點長按 → 拇指可達弧上「綻放」4 個衛星按鈕，順勢滑釋放。' },
  { slug: 'v10-toss', title: '5. Magnetic Toss', tagline: 'Drag & snap to preset', group: 'new',
    desc: '主頁不變。長按右上 + 拖出幽靈卡，底部 preset rail 浮現，磁吸貼合釋放即記錄。' },
  { slug: 'v11-composer', title: '6. Bottom Composer', tagline: 'Ambient capsule', group: 'new',
    desc: '主頁不變。底部常駐細長膠囊「+ still hungry?」，點/上拉展開 preset · 拍 · 寫三 tab 面板。' },
  { slug: 'v12-deck', title: '7. Pocket Deck', tagline: 'Always-visible card stack', group: 'new',
    desc: '主頁不變。右下角 4 張 preset 卡牌錯位疊放，點頂張直接記錄，上滑頂張切下一張。' },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">7 種新增餐入口</h1>
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
      <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-2">第二輪 · 入口創意（主頁不變）</p>
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
