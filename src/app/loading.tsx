// Next.js convention：server component 解析（profile / auth）期间显示。
// 视觉上故意做成 iOS PWA apple-touch-startup-image 同款 splash，
// 这样原生 splash → loading.tsx → 真页面 是连贯过渡，不会"闪一下".
export default function RootLoading() {
  return (
    <main className="fixed inset-0 flex flex-col" style={{ backgroundColor: '#0a0a0c' }}>
      <div className="absolute top-[10%] left-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-accent font-mono">FOOD</p>
      </div>

      <div className="m-auto text-center" style={{ animation: 'ff-fade-in 0.25s ease-out both' }}>
        <p className="display text-[96px] leading-none text-accent">
          ff<span className="display-roman text-[60px] align-middle">·</span>
        </p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-text-3 font-mono mt-6">
          your private fitness lab
        </p>
      </div>

      <div className="absolute bottom-10 left-8">
        <span className="block w-14 h-[2px] bg-accent/70 mb-3" />
        <p className="text-[10px] uppercase tracking-[0.24em] text-text-4 font-mono">
          v0.1 · single-user beta
        </p>
      </div>
    </main>
  );
}
