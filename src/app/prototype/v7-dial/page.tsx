'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MOCK_PRESETS } from '../_lib/mock-presets';

/**
 * iPod click wheel：以 dial 中心為原點，計算手指 angle（atan2），
 * 連續累計弧度差換成「滑動 N 個 item」。每過一個 item haptic 短震。
 */
const STEP_DEG = 28; // 每旋轉 28 度切一個 item

export default function DialPage() {
  const dialRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);
  const [idx, setIdx] = useState(0);
  const [recordedName, setRecordedName] = useState<string | null>(null);

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
    // 跨 -180 / 180 邊界正規化
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    lastAngleRef.current = a;
    accumRef.current += diff;

    while (Math.abs(accumRef.current) >= STEP_DEG) {
      const step = accumRef.current > 0 ? 1 : -1;
      accumRef.current -= step * STEP_DEG;
      setIdx((prev) => {
        const next = prev + step;
        if (next < 0) return MOCK_PRESETS.length - 1;
        if (next >= MOCK_PRESETS.length) return 0;
        return next;
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
    }
  }
  function onTouchEnd() {
    lastAngleRef.current = null;
    accumRef.current = 0;
  }

  function record() {
    setRecordedName(item.name);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([20, 30, 20]);
    setTimeout(() => setRecordedName(null), 1500);
  }

  // 鍵盤左右輔助（桌面 demo）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + MOCK_PRESETS.length) % MOCK_PRESETS.length);
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % MOCK_PRESETS.length);
      if (e.key === 'Enter') record();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx]);

  return (
    <PrototypeShell title="7. Macro Dial" subtitle="iPod click wheel">
      <div className="h-full flex flex-col items-center justify-between py-6 px-5">
        {/* 中心大卡 */}
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

        {/* 提示點：當前在第幾個 */}
        <div className="flex gap-1 mb-4">
          {MOCK_PRESETS.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 18 : 5,
                height: 5,
                background: i === idx ? 'var(--color-accent)' : 'var(--color-hairline)',
              }}
            />
          ))}
        </div>

        {/* dial wheel */}
        <div className="flex-shrink-0 relative">
          <div
            ref={dialRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            className="relative w-56 h-56 rounded-full bg-surface border border-hairline select-none touch-none"
            style={{ touchAction: 'none', background: 'radial-gradient(circle at center, var(--color-surface-2) 0%, var(--color-surface) 70%)' }}
          >
            {/* 旋轉刻度 */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * 360;
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 origin-bottom"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${a}deg) translateY(-78px)`,
                    width: 2, height: 8, background: 'var(--color-hairline-strong)',
                  }}
                />
              );
            })}
            {/* 旋轉方向指示 */}
            <span className="absolute left-1/2 top-3 -translate-x-1/2 text-[9px] font-mono text-text-3">↻</span>
            {/* 中央按鈕 */}
            <button
              type="button"
              onClick={record}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-accent text-accent-ink flex items-center justify-center active:scale-90 transition-transform shadow-lg"
            >
              <span className="text-[12px] font-mono uppercase tracking-widest">記錄</span>
            </button>
          </div>
        </div>

        {recordedName && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg z-10">
            已記錄「{recordedName}」
          </div>
        )}
      </div>
    </PrototypeShell>
  );
}
