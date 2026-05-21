'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PhotoInput } from '@/components/photo-input';
import { MealPreviewCard, type MealPreview } from '@/components/meal-preview-card';
import { MealPresetForm, type MealPresetFormInput, type MealPresetFormPrefill } from '@/components/meal-preset-form';
import { Card, SectionLabel } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Dialog } from '@/components/ui/dialog';
import type { UserMealPreset, RecentPhotoMeal } from '@/lib/home-snapshot';

/**
 * 主頁右上「+」按鈕觸發的「新增餐」面板（slide up from bottom）。
 *
 * 三個 section + 一個 wizard 表單：
 * 1. 自定义菜单：用户自己加的 preset list，header 右側「+」進入空表單
 * 2. 近期新增：拍照入庫過的餐（30 天內），點擊 → 確認 dialog → 預填表單轉 preset
 * 3. 拍餐 · 其他：photo upload → AI 識別 → preview confirm
 *
 * wizard 不嵌 Dialog，在 sheet 內切 view（list ↔ form）。
 */
export function AddMealSheet({
  open,
  onClose,
  customPresets,
  recentPhotoMeals,
  presetBusy,
  onPickCustomPreset,
  createPresetBusy,
  duplicatePresetName,
  onClearDuplicatePresetName,
  onCreatePreset,
  mealExtractBusy,
  onUploadMealPhoto,
  mealPreview,
  onConfirmMeal,
  onCancelMealPreview,
  confirmMealBusy,
}: {
  open: boolean;
  onClose: () => void;
  customPresets: UserMealPreset[];
  recentPhotoMeals: RecentPhotoMeal[];
  presetBusy: string | null;
  onPickCustomPreset: (preset: UserMealPreset) => void | Promise<void>;
  createPresetBusy: boolean;
  duplicatePresetName: boolean;
  onClearDuplicatePresetName: () => void;
  onCreatePreset: (input: MealPresetFormInput) => Promise<boolean>;
  mealExtractBusy: boolean;
  onUploadMealPhoto: (b64: string) => void | Promise<void>;
  mealPreview: MealPreview | null;
  onConfirmMeal: (p: MealPreview, satiety: number | undefined) => void | Promise<void>;
  onCancelMealPreview: () => void;
  confirmMealBusy: boolean;
}) {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [formPrefill, setFormPrefill] = useState<MealPresetFormPrefill | undefined>(undefined);
  const [confirmingMeal, setConfirmingMeal] = useState<RecentPhotoMeal | null>(null);

  // sheet 關閉 → 回 list view，清狀態，避免下次打開停在 form
  useEffect(() => {
    if (!open) {
      setView('list');
      setFormPrefill(undefined);
      setConfirmingMeal(null);
    }
  }, [open]);

  // ESC 關 + body 鎖滾。但 dialog 開 / view='form' 時 Escape 不該關 sheet（讓 dialog 自己取消 / form 取消）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmingMeal != null) return; // Dialog 開：交給 dialog onCancel
      if (view === 'form') {               // form view：Escape 切回 list 而非關 sheet（並清 duplicate）
        setView('list');
        onClearDuplicatePresetName();
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, confirmingMeal, view]);

  function openNewPresetForm() {
    setFormPrefill(undefined);
    setView('form');
  }

  function openConvertPresetForm(meal: RecentPhotoMeal) {
    setFormPrefill({
      name: meal.dish_name,
      kcal: meal.kcal,
      protein_g: meal.protein_g,
      carb_g: meal.carb_g,
      fat_g: meal.fat_g,
      fiber_g: meal.fiber_g,
      source_meal_id: meal.meal_id,
    });
    setView('form');
    setConfirmingMeal(null);
  }

  async function handleSubmitForm(input: MealPresetFormInput): Promise<void> {
    const ok = await onCreatePreset(input);
    if (ok) setView('list');
  }

  const title = view === 'form' ? '新菜單' : '新增餐';

  return (
    <>
      <SheetShell open={open} onClose={onClose} title={title}>
        {view === 'form' ? (
          <MealPresetForm
            prefill={formPrefill}
            onCancel={() => { setView('list'); onClearDuplicatePresetName(); }}
            onSubmit={handleSubmitForm}
            busy={createPresetBusy}
            duplicateError={duplicatePresetName}
            onClearDuplicate={onClearDuplicatePresetName}
          />
        ) : (
          <>
            <section className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <SectionLabel className="m-0">自定義菜單</SectionLabel>
                <button
                  type="button"
                  onClick={openNewPresetForm}
                  aria-label="新增自定義菜單"
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-hairline hover:border-accent/60 hover:text-accent transition-colors text-text-2 active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
              {customPresets.length === 0 ? (
                <Card className="px-5 py-6 text-center">
                  <p className="text-[13px] text-text-3">還沒有自定義菜單</p>
                  <p className="text-[11px] text-text-4 mt-1">點右上 + 建立第一個</p>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {customPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPickCustomPreset(p)}
                      disabled={presetBusy !== null}
                      className={[
                        'group relative bg-surface border border-hairline rounded-xl p-4 text-left transition-colors',
                        'hover:border-hairline-strong hover:bg-surface-2',
                        'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
                      ].join(' ')}
                    >
                      <p className="text-[14px] text-text font-medium leading-tight truncate">{p.name}</p>
                      <p className="text-[18px] font-mono text-accent tabular mt-2 leading-none">
                        {Math.round(p.kcal)}<span className="text-[10px] text-text-3 ml-1">kcal</span>
                      </p>
                      {presetBusy === p.id && (
                        <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                          <Spinner size={18} className="text-accent" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {recentPhotoMeals.length > 0 && (
              <section className="mb-6">
                <SectionLabel>近期新增（拍照）</SectionLabel>
                <p className="text-[11px] text-text-3 mb-2">點擊加入自定義菜單</p>
                <div className="space-y-1.5">
                  {recentPhotoMeals.map((m) => (
                    <button
                      key={m.meal_id}
                      type="button"
                      onClick={() => setConfirmingMeal(m)}
                      className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:border-hairline-strong hover:bg-surface-2 transition-colors active:scale-[0.98]"
                    >
                      <span className="text-[13px] text-text font-medium truncate flex-1 min-w-0">{m.dish_name}</span>
                      <span className="text-[12px] font-mono text-accent tabular flex-shrink-0">
                        {Math.round(m.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="mb-2">
              <SectionLabel>拍餐 · 其他</SectionLabel>
              {!mealPreview && !mealExtractBusy && (
                <PhotoInput onPicked={onUploadMealPhoto} label="拍照 / 選圖識別" />
              )}
              {mealExtractBusy && (
                <Card className="h-28 flex items-center justify-center gap-3">
                  <Spinner size={18} className="text-accent" />
                  <span className="text-[13px] text-text-2">AI 識別中…</span>
                </Card>
              )}
              {mealPreview && (
                <MealPreviewCard
                  initial={mealPreview}
                  onConfirm={onConfirmMeal}
                  onCancel={onCancelMealPreview}
                  busy={confirmMealBusy}
                />
              )}
            </section>
          </>
        )}
      </SheetShell>

      <Dialog
        open={confirmingMeal != null}
        title="加入自定義菜單？"
        body={
          confirmingMeal ? (
            <span>
              「<span className="text-text font-medium">{confirmingMeal.dish_name}</span>」會被加入自定義菜單，下次可一鍵紀錄。
            </span>
          ) : null
        }
        confirmText="加入"
        onCancel={() => setConfirmingMeal(null)}
        onConfirm={() => confirmingMeal && openConvertPresetForm(confirmingMeal)}
      />
    </>
  );
}

const DRAG_CLOSE_THRESHOLD = 100;
const DRAG_MOVE_THRESHOLD = 8;

function SheetShell({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ y: number; phase: 'pending' | 'drag' | 'scroll' } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    startRef.current = { y: t.clientY, phase: 'pending' };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 1 || !startRef.current) return;
    const t = e.touches[0]!;
    const dy = t.clientY - startRef.current.y;
    if (startRef.current.phase === 'pending') {
      if (Math.abs(dy) <= DRAG_MOVE_THRESHOLD) return;
      const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
      if (dy > 0 && atTop) {
        startRef.current.phase = 'drag';
        setDragging(true);
      } else {
        startRef.current.phase = 'scroll';
        return;
      }
    }
    if (startRef.current.phase === 'drag') {
      setDragY(Math.max(0, dy));
    }
  }
  function onTouchEnd() {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    if (start.phase === 'drag') {
      if (dragY > DRAG_CLOSE_THRESHOLD) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        onClose();
        setTimeout(() => setDragY(0), 300);
      } else {
        setDragY(0);
      }
    }
    setDragging(false);
  }

  const transform = open ? `translateY(${dragY}px)` : 'translateY(100%)';
  const transition = dragging ? 'none' : 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 70,
          background: 'rgba(10,10,12,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease-out',
        }}
      />
      <aside
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 71,
          background: 'var(--color-surface-2)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--color-hairline)',
          maxHeight: 'calc(100dvh - 4rem)',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
          transform,
          transition,
        }}
      >
        <div className="relative flex items-center justify-center px-5 h-12 border-b border-hairline flex-shrink-0">
          <span className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-medium">{title}</span>
          <button
            type="button"
            onClick={() => {
              (document.activeElement as HTMLElement | null)?.blur?.();
              onClose();
            }}
            aria-label="關閉新增餐面板"
            className="sr-only"
          >
            關閉
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-4 pb-2">{children}</div>
      </aside>
    </>
  );
}
