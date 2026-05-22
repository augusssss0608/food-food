import Link from 'next/link';

export const dynamic = 'force-dynamic';

const VARIANTS: { slug: string; title: string; tagline: string; desc: string }[] = [
  {
    slug: 'v31-strip',
    title: '1. Strip + Wheel 上橫下豎',
    tagline: 'Top mode strip · bottom picker',
    desc: '半彈窗。頂部 mode 橫向滑（停 1.2s 提交）+ 下方 preset 垂直 picker spinner。按鈕 = 三橫線 picker icon。',
  },
  {
    slug: 'v32-dial',
    title: '2. Split Dial 半圓刻度盤',
    tagline: 'Arc dial · vertical stack',
    desc: '左側半圓 mode dial（指針旋轉 + phosphor afterimage）+ 右側 preset 垂直 stack。按鈕 = 斷開三段弧 + 斜指針。',
  },
  {
    slug: 'v33-twin-h',
    title: '3. Twin Horizontal 雙橫向',
    tagline: 'Both horizontal · cover-flow',
    desc: '上方 mode 橫向 segmented + 下方 preset 橫向 cover-flow。按鈕 = 橫向刻度 + 居中圓點。',
  },
  {
    slug: 'v34-left-vert',
    title: '4. Left Vert + Right Carousel',
    tagline: 'Vertical mode · horizontal preset',
    desc: '左側 mode 垂直 wheel + 右側 preset 橫向 carousel（中央 lime border 卡片）。按鈕 = 豎向刻度 + 橫向箭頭。',
  },
  {
    slug: 'v35-fork',
    title: '5. Tuning Fork 音叉調諧',
    tagline: 'Two-state · tune & commit',
    desc: '左竖 mode tuning rail + 右竖 preset deck。探索態邊緣有 scanline，停 1.2s 後 deck 短促「調頻抖動」+ 切換。按鈕 = 兩根音叉竖線振動。',
  },
  {
    slug: 'v36-cross',
    title: '6. Crosshair Ledger 準星帳本',
    tagline: 'Crosshair lock · 2D ledger',
    desc: '左小 mode quadrant + 右二維 preset ledger（橫向切信息密度 compact/macro/fiber）。停 1.2s 準星四角閉合鎖定。按鈕 = 偏心準星。',
  },
];

export default function PrototypeIndexPage() {
  return (
    <div className="min-h-dvh bg-ink text-text px-5 py-8 max-w-md mx-auto">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">prototype · add meal</p>
        <h1 className="display-roman text-[30px] leading-tight">6 種半彈窗雙列 picker</h1>
        <p className="text-[13px] text-text-3 mt-2">
          全部半彈窗 + 丝滑滑動 + 停 1.2s 自動提交切換。6 種布局組合視覺各不相同。
        </p>
        <p className="text-[11px] text-text-4 mt-2 font-mono">
          v31-33 來自我自己 / v32 + v35 + v36 來自 codex（cold 模式獨立方案）。
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
