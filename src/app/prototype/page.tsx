import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VARIANTS: { slug: string; title: string; tagline: string; desc: string }[] = [
  {
    slug: 'v28-twin',
    title: '1. Editorial Twin Picker',
    tagline: 'Refined · iOS UIDatePicker',
    desc: '右下圓鈕呼吸動效 → 雙列 picker：左列模式（近期 / 菜單 / 拍照）上下滑，右列跟著切換內容。Apple Watch face 編輯感。',
  },
  {
    slug: 'v29-console',
    title: '2. Industrial Twin LCD',
    tagline: 'Brutalist · brushed metal',
    desc: '右下方形按鈕 → 雙 LCD 螢幕：左 LCD 模式輪轉，右 LCD 顯示 preset。7-segment 字體 + 鉚釘 brushed metal + 警示 LED。',
  },
  {
    slug: 'v30-codex',
    title: '3. Folding Codex',
    tagline: 'Antique · Fraunces serif',
    desc: '右下書本側按鈕 → 古籍展開：左書脊章節書籤上下滑，右書頁顯示內容。Fraunces 衍線斜體 + 米色紙張噪點 + 燙金邊。',
  },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">3 種雙列 picker 入口</h1>
        <p className="text-[13px] text-text-3 mt-2">
          機制相同：右下按鈕 → 全屏雙列 picker。左列模式（近期 / 菜單 / 拍照）上下滑切換，右列跟著變。視覺三套完全不同的美學。
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
