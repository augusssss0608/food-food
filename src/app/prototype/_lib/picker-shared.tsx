'use client';
import { useEffect, useRef, useState } from 'react';
import type { UserMealPreset } from '@/lib/home-snapshot';
import { MockPresetForm, InlineConfirmDialog } from './preset-manager';
import type { HomeDataApi } from './use-home-data';

/* ============ 横向 wheel picker hook（带 RAF release 动画 + per-tick 触觉） ============ */
export function useHWheelPicker(itemCount: number, itemWidth: number) {
  const [idx, setIdx] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startXRef = useRef<number | null>(null);
  const lastXRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const velRef = useRef<number>(0);
  const tickRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const safeIdx = itemCount === 0 ? 0 : ((idx % itemCount) + itemCount) % itemCount;

  function getOffsetIdx(rel: number): number {
    if (itemCount === 0) return 0;
    return ((safeIdx + rel) % itemCount + itemCount) % itemCount;
  }

  function fireTick(strength = 3) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(strength); } catch {}
    }
  }

  function cancelRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  useEffect(() => () => cancelRaf(), []);

  function animateTo(fromOffset: number, duration: number) {
    setIsAnimating(true);
    const startTime = performance.now();
    let lastFrameTick = Math.round(fromOffset / itemWidth);
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = fromOffset * (1 - eased);
      const frameTick = Math.round(cur / itemWidth);
      if (frameTick !== lastFrameTick) {
        lastFrameTick = frameTick;
        fireTick(2);
      }
      if (t < 1) {
        setDragOffset(cur);
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDragOffset(0);
        setIsAnimating(false);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (itemCount === 0) return;
    cancelRaf();
    setIsAnimating(false);
    setDragOffset(0);
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTRef.current = Date.now();
    velRef.current = 0;
    tickRef.current = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startXRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    setDragOffset(dx);
    const newTick = Math.round(dx / itemWidth);
    if (newTick !== tickRef.current) {
      tickRef.current = newTick;
      fireTick(3);
    }
    if (lastXRef.current != null && lastTRef.current != null) {
      const dt = Date.now() - lastTRef.current;
      if (dt > 0) velRef.current = (e.clientX - lastXRef.current) / dt;
    }
    lastXRef.current = e.clientX;
    lastTRef.current = Date.now();
  }

  function onPointerUp(_e?: React.PointerEvent) {
    if (startXRef.current == null) return;
    const dx = dragOffset;
    const vel = velRef.current;
    let stepShift = -Math.round(dx / itemWidth);
    if (Math.abs(vel) > 0.25) stepShift += -Math.round(vel * 6);
    stepShift = Math.max(-6, Math.min(6, stepShift));

    startXRef.current = null;
    lastXRef.current = null;
    lastTRef.current = null;
    velRef.current = 0;

    if (itemCount > 0 && stepShift !== 0) {
      setIdx((i) => ((i + stepShift) % itemCount + itemCount) % itemCount);
      // 视觉锚点：idx 跳完后，新 center 在 dx + stepShift*itemWidth 处，从那里平滑回 0
      const visualFrom = dx + stepShift * itemWidth;
      setDragOffset(visualFrom);
      animateTo(visualFrom, 280);
    } else {
      animateTo(dx, 200);
    }
  }

  function onPointerCancel(_e?: React.PointerEvent) {
    cancelRaf();
    setDragOffset(0);
    setIsAnimating(false);
    startXRef.current = null;
    lastXRef.current = null;
    lastTRef.current = null;
    velRef.current = 0;
  }

  return {
    idx: safeIdx,
    setIdx,
    dragOffset,
    isAnimating,
    getOffsetIdx,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}

/* ============ 通用 CRUD modal 组件 ============ */
export function FormSheet({
  title, submitLabel, initial, onSubmit, onCancel, duplicateName,
}: {
  title: string;
  submitLabel: string;
  initial?: { name: string; kcal: number };
  onSubmit: (name: string, kcal: number) => void | Promise<void>;
  onCancel: () => void;
  duplicateName?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center" style={{ animation: 'ff-fade-in 0.2s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-[420px] bg-surface-2 border-t border-accent/40 px-5 pt-5 rounded-t-xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
        <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">{title}</p>
        <MockPresetForm initial={initial} submitLabel={submitLabel} onSubmit={(n, k) => onSubmit(n, k)} onCancel={onCancel} />
        {duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名 preset，請改名</p>}
      </div>
    </div>
  );
}

export function LongPressMenu({
  preset, onEdit, onDuplicate, onDelete, onClose,
}: {
  preset: UserMealPreset;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110]" onClick={onClose} style={{ animation: 'ff-fade-in 0.14s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[30%] bg-surface-2 border border-accent/40 rounded-xl overflow-hidden min-w-[240px] shadow-2xl shadow-black/60"
        style={{ animation: 'pop-in 0.2s var(--ease-spring) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-hairline">
          <p className="text-[14px] text-text font-medium">{preset.name}</p>
          <p className="text-[11px] font-mono text-accent tabular mt-0.5">
            {Math.round(preset.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
          </p>
        </div>
        <MItem icon="✎" onClick={onEdit}>編輯</MItem>
        <MItem icon="⎘" onClick={onDuplicate}>複製</MItem>
        <MItem icon="×" tone="danger" onClick={onDelete}>刪除</MItem>
        <MItem icon="◌" onClick={onClose}>取消</MItem>
      </div>
    </div>
  );
}

function MItem({ children, onClick, icon, tone }: { children: React.ReactNode; onClick: () => void; icon: string; tone?: 'danger' }) {
  return (
    <button onClick={onClick} className="w-full px-4 py-3 text-left text-[13px] hover:bg-surface active:bg-surface border-b border-hairline last:border-b-0 flex items-center gap-3">
      <span className={`w-4 text-center ${tone === 'danger' ? 'text-danger' : 'text-text-3'}`}>{icon}</span>
      <span className={tone === 'danger' ? 'text-danger' : 'text-text'}>{children}</span>
    </button>
  );
}

/* ============ 共享 CRUD modals 集合 ============ */
export function PresetCrudModals({
  api,
  currentPreset,
  menuOpen, setMenuOpen,
  createOpen, setCreateOpen,
  editOpen, setEditOpen,
  delOpen, setDelOpen,
}: {
  api: HomeDataApi;
  currentPreset: UserMealPreset | undefined;
  menuOpen: boolean; setMenuOpen: (b: boolean) => void;
  createOpen: boolean; setCreateOpen: (b: boolean) => void;
  editOpen: boolean; setEditOpen: (b: boolean) => void;
  delOpen: boolean; setDelOpen: (b: boolean) => void;
}) {
  return (
    <>
      {menuOpen && currentPreset && (
        <LongPressMenu
          preset={currentPreset}
          onEdit={() => { setMenuOpen(false); api.clearDuplicate(); setEditOpen(true); }}
          onDuplicate={async () => { setMenuOpen(false); api.clearDuplicate(); await api.addPreset(`${currentPreset.name} (copy)`, currentPreset.kcal); }}
          onDelete={() => { setMenuOpen(false); setDelOpen(true); }}
          onClose={() => setMenuOpen(false)}
        />
      )}
      {createOpen && (
        <FormSheet title="＋ 新 preset" submitLabel="保存"
          onSubmit={async (n, k) => { const ok = await api.addPreset(n, k); if (ok) setCreateOpen(false); }}
          onCancel={() => setCreateOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      {editOpen && currentPreset && (
        <FormSheet title={`✎ 編輯 · ${currentPreset.name}`} submitLabel="保存"
          initial={{ name: currentPreset.name, kcal: currentPreset.kcal }}
          onSubmit={async (n, k) => { const ok = await api.updatePreset(currentPreset.id, n, k); if (ok) setEditOpen(false); }}
          onCancel={() => setEditOpen(false)} duplicateName={api.duplicateName}
        />
      )}
      <InlineConfirmDialog
        open={delOpen}
        title="刪除這個 preset？"
        body={currentPreset ? <span>將永久移除「<span className="text-text font-medium">{currentPreset.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDelOpen(false)}
        onConfirm={async () => { if (currentPreset) await api.deletePreset(currentPreset.id); setDelOpen(false); }}
      />
    </>
  );
}

/* ============ Mode 共享数据 ============ */
export type Mode = 'recent' | 'menu' | 'camera';
export const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: 'recent', label: '近期', sub: 'recent' },
  { key: 'menu',   label: '菜單', sub: 'menu' },
  { key: 'camera', label: '拍照', sub: 'camera' },
];

export function presetListForMode(presets: UserMealPreset[], mode: Mode): UserMealPreset[] {
  if (mode === 'recent') {
    return [...presets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
  }
  if (mode === 'menu') {
    return [...presets].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }
  return [];
}
