import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VARIANTS: { slug: string; title: string; tagline: string; desc: string }[] = [
  {
    slug: 'v25-picker',
    title: '1. iOS Picker 經典時間選擇器',
    tagline: 'Vertical scroll wheel · snap · loop',
    desc: '右下小圓點按鈕（呼吸動效）→ 全屏 picker spinner。垂直滾輪首尾循環，中間高亮一行 lime 大字 + name+kcal+macro。tap 高亮 = 記錄，長按 = 編輯/刪除。',
  },
  {
    slug: 'v26-flip',
    title: '2. Split Flap 機械翻頁板',
    tagline: 'Airport board · mechanical flip',
    desc: '右下小圓點按鈕（顆粒翻動效）→ 老式機場航班翻頁板。每行 = 一張卡片，滾動時上下機械翻轉，dot matrix 字體 + 鉚釘邊框。首尾循環。',
  },
  {
    slug: 'v27-film',
    title: '3. 35mm Film Strip 膠卷',
    tagline: 'Cinema reel · perforated edges',
    desc: '右下小圓點按鈕（齒輪動效）→ 35mm 膠卷垂直滾動。每幀 = 一個 preset，兩側有膠卷齒孔同步移動，frame caption 字體。電影感首尾循環。',
  },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">3 種垂直 picker 入口</h1>
        <p className="text-[13px] text-text-3 mt-2">
          機制相同：右下角小圓點 → 垂直滾輪 picker（首尾循環）+ 中央 lime 大字。視覺三套：iOS 經典 / 機械翻頁板 / 35mm 膠卷。
        </p>
        <p className="text-[11px] text-text-4 mt-2 font-mono">
          tap 高亮行 = 記錄這一筆 · 長按高亮行 = 編輯 / 刪除 · 頂部 + 新建。
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
