'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import { PresetDialSheet, pickAIRecommended } from '../_lib/preset-dial-sheet';
import type { HomeSnapshot } from '@/lib/home-snapshot';

/**
 * Bottom Composer v2 — 主页结构保留。
 * 入口：屏底 ambient capsule，文案随时间 + 剩余 kcal 动态。
 *
 * 关键改良 vs v1：
 * - 拉起后不再是 grid + 3 tab，改成 PresetDialSheet（翻牌 + 搜索 + AI chip）
 *   解决「自定義越來越多滑不到」的问题
 * - capsule 上拉手势 + 单击都进 dial sheet
 */
export function ComposerContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [dialOpen, setDialOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  const subtotal = Math.round(api.consumed.kcal);
  const target = Math.round(api.targets.kcal);
  const remain = Math.max(0, target - subtotal);

  const placeholder = useMemo(() => {
    const hour = new Date().getHours();
    const hasMorning = api.meals.some((m) => new Date(m.ate_at).getHours() < 11);
    const hasLunch = api.meals.some((m) => {
      const h = new Date(m.ate_at).getHours();
      return h >= 11 && h < 15;
    });
    const hasDinner = api.meals.some((m) => new Date(m.ate_at).getHours() >= 17);
    if (hour < 11 && !hasMorning) return '記下早餐';
    if (hour < 15 && !hasLunch) return '記下午餐';
    if (hour < 22 && !hasDinner) return '記下晚餐';
    if (remain > 200) return `還差 ${remain} kcal · 加一筆`;
    return '吃了點什麼？';
  }, [api.meals, remain]);

  const recommended = useMemo(() => pickAIRecommended(api.presets), [api.presets]);

  function onCapsulePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragStartRef.current = e.clientY;
  }
  function onCapsulePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartRef.current == null) return;
    const dy = dragStartRef.current - e.clientY;
    if (dy > 0) setDragY(Math.min(dy, 120));
  }
  function onCapsulePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartRef.current == null) return;
    const dy = dragStartRef.current - e.clientY;
    dragStartRef.current = null;
    setDragY(0);
    if (dy > 60) {
      setDialOpen(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    } else if (Math.abs(dy) < 8) {
      setDialOpen(true);
    }
  }

  return (
    <PrototypeShell title="5. Bottom Composer v2">
      <RealHomeShell api={api} rightAction={null} />

      {/* ambient capsule */}
      <div
        className="fixed left-0 right-0 z-[70] px-4 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <button
          type="button"
          onPointerDown={onCapsulePointerDown}
          onPointerMove={onCapsulePointerMove}
          onPointerUp={onCapsulePointerUp}
          onPointerCancel={onCapsulePointerUp}
          aria-label="open dial"
          className="capsule pointer-events-auto"
          style={{
            transform: `translateY(${-dragY * 0.6}px)`,
            opacity: dialOpen ? 0 : 1,
            pointerEvents: dialOpen ? 'none' : 'auto',
            transition: dragStartRef.current ? 'none' : 'transform 0.25s var(--ease-spring), opacity 0.18s ease',
          }}
        >
          <span className="capsule-handle" aria-hidden />
          <span className="capsule-glyph">＋</span>
          <span className="capsule-text">{placeholder}</span>
          <span className="capsule-meta tabular">
            {subtotal}
            <span className="opacity-50 mx-0.5">/</span>
            {target}
          </span>
          <span className="capsule-arrow" aria-hidden>↑</span>
        </button>
      </div>

      {dialOpen && (
        <PresetDialSheet
          presets={api.presets}
          recordingId={api.recordingId}
          aiRecommended={recommended}
          headerTagline="flip 左右 · 搜尋 · 記錄"
          onPick={async (p) => {
            await api.recordCustomPreset(p);
            setDialOpen(false);
          }}
          onCreate={() => { api.clearDuplicate(); setDialOpen(false); setCreateOpen(true); }}
          onClose={() => setDialOpen(false)}
        />
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center"
          style={{ animation: 'ff-fade-in 0.2s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div
            className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">＋ 新菜單</p>
            <MockPresetForm
              submitLabel="保存"
              onSubmit={async (name, kcal) => {
                const ok = await api.addPreset(name, kcal);
                if (ok) setCreateOpen(false);
              }}
              onCancel={() => setCreateOpen(false)}
            />
            {api.duplicateName && (
              <p className="text-[11px] text-danger mt-2 text-center">已存在同名菜單，請改名</p>
            )}
          </div>
        </div>
      )}

      <style>{styles}</style>
    </PrototypeShell>
  );
}

const styles = `
.capsule {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  gap: 10px;
  align-items: center;
  background: rgba(28, 28, 34, 0.85);
  border: 1px solid var(--color-hairline-strong);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-radius: 999px;
  padding: 10px 16px 10px 12px;
  cursor: pointer;
  position: relative;
  box-shadow:
    0 12px 32px -8px rgba(0,0,0,0.6),
    0 1px 0 rgba(255,255,255,0.04) inset;
}
.capsule:hover { border-color: rgba(200,255,0,0.4); }
.capsule:active { transform: scale(0.99); }
.capsule-handle {
  position: absolute;
  left: 50%; top: -4px;
  transform: translateX(-50%);
  width: 28px; height: 3px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  opacity: 0.6;
}
.capsule-glyph {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; line-height: 1;
}
.capsule-text {
  font-size: 13px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.capsule-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
}
.capsule-arrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-accent);
  opacity: 0.7;
  animation: arrow-bob 1.8s ease-in-out infinite;
}
@keyframes arrow-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
`;
