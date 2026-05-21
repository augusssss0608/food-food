'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, PlusButton, MockToast, useMockTodayLog, useMockPresets } from '../_lib/mock-home';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { UserMealPreset } from '@/lib/home-snapshot';

const STEP_DEG = 28;

/**
 * Macro Dial：主頁右上 + → 全屏 dial overlay。
 * 拇指在輪盤上旋轉切餐，中央按鈕記錄。提供「← 返回主頁」入口。
 */
export default function DialPage() {
  const { log, addEntry } = useMockTodayLog();
  const { presets, addPreset, updatePreset, deletePreset } = useMockPresets();
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
        {open && (
          <DialOverlay
            presets={presets}
            onClose={() => setOpen(false)}
            onRecord={record}
            onAdd={addPreset}
            onUpdate={updatePreset}
            onDelete={deletePreset}
          />
        )}
        <MockToast text={toast} />
      </div>
    </PrototypeShell>
  );
}

type FormState = 'closed' | 'add' | { kind: 'edit'; id: string };

function DialOverlay({
  presets,
  onClose,
  onRecord,
  onAdd,
  onUpdate,
  onDelete,
}: {
  presets: UserMealPreset[];
  onClose: () => void;
  onRecord: (n: string, k: number) => void;
  onAdd: (n: string, k: number) => void;
  onUpdate: (id: string, n: string, k: number) => void;
  onDelete: (id: string) => void;
}) {
  const dialRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const accumRef = useRef<number>(0);
  const [idx, setIdx] = useState(0);
  const [formState, setFormState] = useState<FormState>('closed');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const item = presets[Math.min(idx, presets.length - 1)] ?? { id: '', name: '無菜單', kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0, created_at: '' };
  const editingPreset = typeof formState === 'object' && formState.kind === 'edit' ? presets.find((p) => p.id === formState.id) : undefined;

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
      if (presets.length > 0) {
        setIdx((prev) => (prev + step + presets.length) % presets.length);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
      }
    }
  }
  function onTouchEnd() { lastAngleRef.current = null; accumRef.current = 0; }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (presets.length > 0) {
        if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + presets.length) % presets.length);
        if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % presets.length);
        if (e.key === 'Enter') onRecord(item.name, item.kcal);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose, onRecord, presets.length]);

  return (
    <div className="fixed inset-0 bg-ink z-[100] flex flex-col" style={{ animation: 'ff-fade-in 0.25s ease-out both', height: '100dvh' }}>
      <header className="flex-shrink-0 px-4 h-12 flex items-center justify-between relative" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(env(safe-area-inset-top) + 3rem)' }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-accent hover:text-accent-press active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[12px] font-mono uppercase tracking-wider">返回主頁</span>
        </button>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-3 absolute left-1/2 -translate-x-1/2" style={{ top: 'calc(env(safe-area-inset-top) + 0.95rem)' }}>選餐</p>
        <button
          onClick={() => setFormState('add')}
          aria-label="新增菜單"
          className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-hairline text-text-2 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </header>

      {formState !== 'closed' && (
        <div className="absolute inset-0 z-10 bg-ink/95 backdrop-blur-md flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 3rem)' }}>
          <div className="px-5 py-5 max-w-md mx-auto w-full">
            <h2 className="text-[16px] text-text font-medium mb-4">{formState === 'add' ? '新增菜單' : '編輯菜單'}</h2>
            <MockPresetForm
              initial={editingPreset ? { name: editingPreset.name, kcal: editingPreset.kcal } : undefined}
              submitLabel={formState === 'add' ? '新增' : '保存'}
              onSubmit={(name, kcal) => {
                if (formState === 'add') onAdd(name, kcal);
                else if (typeof formState === 'object') onUpdate(formState.id, name, kcal);
                setFormState('closed');
              }}
              onCancel={() => setFormState('closed')}
            />
          </div>
        </div>
      )}

      <InlineConfirmDialog
        open={confirmDeleteId != null}
        title="刪除這個菜單？"
        body={confirmDeleteId ? <span>將永久移除「<span className="text-text font-medium">{presets.find((p) => p.id === confirmDeleteId)?.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) { onDelete(confirmDeleteId); if (idx >= presets.length - 1) setIdx(0); }
          setConfirmDeleteId(null);
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-between px-5 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {presets.length === 0 ? (
            <div className="text-center">
              <p className="text-[14px] text-text-3 mb-3">沒有菜單</p>
              <button onClick={() => setFormState('add')} className="text-[12px] text-accent font-mono uppercase tracking-wider active:scale-95">
                + 新增第一個
              </button>
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-3">
                {idx + 1} / {presets.length}
              </p>
              <h2 className="text-[26px] font-medium text-text leading-tight mb-3 text-center">{item.name}</h2>
              <p className="text-[44px] font-mono text-accent tabular leading-none mb-5">
                {Math.round(item.kcal)}<span className="text-[14px] text-text-3 ml-1.5">kcal</span>
              </p>
              <div className="flex gap-5 text-[12px] font-mono text-text-2 tabular mb-4">
                <span>P {item.protein_g}</span>
                <span>C {item.carb_g}</span>
                <span>F {item.fat_g}</span>
              </div>
              {/* 当前 dial 选中的菜单：编辑 / 删除 inline 入口 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFormState({ kind: 'edit', id: item.id })}
                  className="px-3 py-1.5 rounded-full bg-surface border border-hairline text-[11px] text-text-2 font-mono uppercase tracking-wider active:scale-95"
                >
                  ✏️ 編輯
                </button>
                <button
                  onClick={() => setConfirmDeleteId(item.id)}
                  className="px-3 py-1.5 rounded-full bg-surface border border-danger/30 text-[11px] text-danger font-mono uppercase tracking-wider active:scale-95"
                >
                  🗑 刪除
                </button>
              </div>
            </>
          )}
        </div>

        {presets.length > 0 && (
          <div className="flex gap-1 mb-4 max-w-full overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {presets.map((_, i) => (
              <span key={i} className="rounded-full transition-all flex-shrink-0" style={{
                width: i === idx ? 18 : 5, height: 5,
                background: i === idx ? 'var(--color-accent)' : 'var(--color-hairline)',
              }} />
            ))}
          </div>
        )}

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
