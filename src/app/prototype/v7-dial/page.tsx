'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, PlusButton, MockToast, useMockTodayLog } from '../_lib/mock-home';
import { MOCK_PRESETS } from '../_lib/mock-presets';

const STEP_DEG = 28;

/**
 * Macro Dial：主頁右上 + → 全屏 dial overlay。
 * 拇指在輪盤上旋轉切餐，中央按鈕記錄。提供「← 返回主頁」入口。
 */
export default function DialPage() {
  const { log, addEntry } = useMockTodayLog();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
    setOpen(false);
  }

  return (
    <PrototypeShell title="6. Macro Dial">
      <div className="h-full relative">
        <MockHome log={log} rightAction={<PlusButton onClick={() => setOpen(true)} />} />
        {open && <DialOverlay onClose={() => setOpen(false)} onRecord={record} />}
        <MockToast text={toast} />
      </div>
    </PrototypeShell>
  );
}

function DialOverlay({ onClose, onRecord }: { onClose: () => void; onRecord: (n: string, k: number) => void }) {
  const dialRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);
  const [idx, setIdx] = useState(0);
  const item = MOCK_PRESETS[idx]!;

  function angleFromCenter(clientX: number, clientY: number): number {
    const el = dialRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    lastAngleRef.current = angleFromCenter(e.touches[0]!.clientX, e.touches[0]!.clientY);
    accumRef.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (lastAngleRef.current == null) return;
    const a = angleFromCenter(e.touches[0]!.clientX, e.touches[0]!.clientY);
    let diff = a - lastAngleRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    lastAngleRef.current = a;
    accumRef.current += diff;
    while (Math.abs(accumRef.current) >= STEP_DEG) {
      const step = accumRef.current > 0 ? 1 : -1;
      accumRef.current -= step * STEP_DEG;
      setIdx((prev) => (prev + step + MOCK_PRESETS.length) % MOCK_PRESETS.length);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
    }
  }
  function onTouchEnd() { lastAngleRef.current = null; accumRef.current = 0; }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + MOCK_PRESETS.length) % MOCK_PRESETS.length);
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % MOCK_PRESETS.length);
      if (e.key === 'Enter') onRecord(item.name, item.kcal);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose, onRecord]);

  return (
    <div className="absolute inset-0 bg-ink z-30 flex flex-col" style={{ animation: 'ff-fade-in 0.25s ease-out both' }}>
      <header className="flex-shrink-0 px-4 h-12 flex items-center justify-between relative" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(env(safe-area-inset-top) + 3rem)' }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-accent hover:text-accent-press active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[12px] font-mono uppercase tracking-wider">返回主頁</span>
        </button>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-3 absolute left-1/2 -translate-x-1/2" style={{ top: 'calc(env(safe-area-inset-top) + 0.95rem)' }}>選餐</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-between px-5 pb-6">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-3">
            {idx + 1} / {MOCK_PRESETS.length}
          </p>
          <h2 className="text-[26px] font-medium text-text leading-tight mb-3 text-center">{item.name}</h2>
          <p className="text-[44px] font-mono text-accent tabular leading-none mb-5">
            {item.kcal}<span className="text-[14px] text-text-3 ml-1.5">kcal</span>
          </p>
          <div className="flex gap-5 text-[12px] font-mono text-text-2 tabular">
            <span>P {item.protein_g}</span>
            <span>C {item.carb_g}</span>
            <span>F {item.fat_g}</span>
          </div>
        </div>

        <div className="flex gap-1 mb-4">
          {MOCK_PRESETS.map((_, i) => (
            <span key={i} className="rounded-full transition-all" style={{
              width: i === idx ? 18 : 5, height: 5,
              background: i === idx ? 'var(--color-accent)' : 'var(--color-hairline)',
            }} />
          ))}
        </div>

        <div className="flex-shrink-0 relative">
          <div
            ref={dialRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            className="relative w-56 h-56 rounded-full bg-surface border border-hairline select-none"
            style={{ touchAction: 'none', background: 'radial-gradient(circle at center, var(--color-surface-2) 0%, var(--color-surface) 70%)' }}
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * 360;
              return (
                <span key={i} className="absolute left-1/2 top-1/2 origin-bottom" style={{
                  transform: `translate(-50%, -100%) rotate(${a}deg) translateY(-78px)`,
                  width: 2, height: 8, background: 'var(--color-hairline-strong)',
                }} />
              );
            })}
            <span className="absolute left-1/2 top-3 -translate-x-1/2 text-[9px] font-mono text-text-3">↻ 旋轉切餐</span>
            <button
              type="button"
              onClick={() => onRecord(item.name, item.kcal)}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-accent text-accent-ink flex items-center justify-center active:scale-90 transition-transform shadow-lg"
            >
              <span className="text-[12px] font-mono uppercase tracking-widest">記錄</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
