// Next.js convention: shown while page server component (e.g. profile check) is resolving.
// Pre-rendered as static so it 闪现的瞬间不需要任何 JS。
export default function RootLoading() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="text-center" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
        <p className="text-[11px] uppercase tracking-[0.32em] text-accent font-mono mb-3">FOOD · FOOD</p>
        <p className="display-roman text-[28px] text-text-2 anim-pulse-soft">loading.</p>
      </div>
    </main>
  );
}
