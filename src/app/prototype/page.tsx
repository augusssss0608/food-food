import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VARIANTS: { slug: string; title: string; tagline: string; desc: string }[] = [
  {
    slug: 'v22-safe-dial',
    title: '1. Safe Dial 保險櫃密碼盤',
    tagline: 'Outer coarse · inner fine',
    desc: '右下旋鈕長按展開保險櫃拨盤。外圈拨到 name 前綴段（Recent / A-D / SAL...），內圈精選 8-12 個 preset 中央大卡顯示完整 name+kcal+macro。兩手勢到任意 preset。',
  },
  {
    slug: 'v23-slot-reel',
    title: '2. Slot Reel 老虎機滾筒',
    tagline: '3 reels · parallel filter',
    desc: '右下機械窗口長按展開老虎機。3 滾筒並行篩選（頻率 × name 片段 × kcal 段），中央命中 preset 立即顯示。100+ preset 壓到 1-5 個候選。',
  },
  {
    slug: 'v24-compass',
    title: '3. Compass Lens 航海羅盤',
    tagline: 'Intent direction · velocity-layered',
    desc: '右下羅盤指針常駐。長按展開大盤，拇指畫圓選方向（Recent/Rare/Light/Dense/Low/High kcal），同一畫圓手勢快推跳片段、慢推單步。',
  },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">3 種轉盤式入口</h1>
        <p className="text-[13px] text-text-3 mt-2">
          右下常駐按鈕（有動效）→ 點擊進完整 CRUD · 轉盤心智 · 解決 100+ preset 不滑列表 / 不搜索 / 不分類。
        </p>
        <p className="text-[11px] text-text-4 mt-2 font-mono">
          收斂自和 codex 兩輪討論：共識 = 拆「粗定位 + 精定位」兩個手勢。
        </p>
      </header>
      <ul className="space-y-2.5">
        {VARIANTS.map((v) => (
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
