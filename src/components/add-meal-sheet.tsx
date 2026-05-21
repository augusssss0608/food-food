'use client';
import { useEffect, type ReactNode } from 'react';
import { FITNESS_MEAL_PRESETS } from '@/lib/fitness-meals';
import { PhotoInput } from '@/components/photo-input';
import { MealPreviewCard, type MealPreview } from '@/components/meal-preview-card';
import { Card, SectionLabel } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

/**
 * 主頁右上「+」按鈕觸發的「新增餐」面板（slide up from bottom）。
 * 包 preset 網格 + 拍餐 input + AI 識別預覽。
 * 業務邏輯（fetch / 草稿 / refresh）由父層 home-content 管，這裡只渲染 UI + 委派事件。
 *
 * 飽腹感不在這裡填：吃飽才知道，新增時不該強迫選。要打分到主頁餐點 inline editor 補。
 */
export function AddMealSheet({
  open,
  onClose,
  presetBusy,
  onPickPreset,
  mealExtractBusy,
  onUploadMealPhoto,
  mealPreview,
  onConfirmMeal,
  onCancelMealPreview,
  confirmMealBusy,
}: {
  open: boolean;
  onClose: () => void;
  presetBusy: string | null;
  onPickPreset: (key: string, name: string) => void | Promise<void>;
  mealExtractBusy: boolean;
  onUploadMealPhoto: (b64: string) => void | Promise<void>;
  mealPreview: MealPreview | null;
  onConfirmMeal: (p: MealPreview, satiety: number | undefined) => void | Promise<void>;
  onCancelMealPreview: () => void;
  confirmMealBusy: boolean;
}) {
  // ESC 關 + body 鎖滾
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <SheetShell open={open} onClose={onClose} title="新增餐">
      <section className="mb-6">
        <SectionLabel>選健身餐</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(FITNESS_MEAL_PRESETS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => onPickPreset(k, v.name)}
              disabled={presetBusy !== null}
              className={[
                'group relative bg-surface border border-hairline rounded-xl p-4 text-left transition-colors',
                'hover:border-hairline-strong hover:bg-surface-2',
                'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              <p className="text-[14px] text-text font-medium leading-tight">{v.name}</p>
              <p className="text-[18px] font-mono text-accent tabular mt-2 leading-none">
                {v.kcal}<span className="text-[10px] text-text-3 ml-1">kcal</span>
              </p>
              {presetBusy === k && (
                <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Spinner size={18} className="text-accent" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

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
    </SheetShell>
  );
}

function SheetShell({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
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
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 71,
          background: 'var(--color-surface-2)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--color-hairline)',
          maxHeight: 'calc(100dvh - 4rem)',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 頂部拖把區既是視覺 handle，也是真正的 close button（用戶要求去 ✕，但保留可訪問
          的關閉入口）。命中區 44px 高（iOS 觸碰目標推薦），focus-visible 顯亮邊 */}
        <button
          type="button"
          onClick={() => {
            // iOS standalone：先 blur 任何 input，避免關閉動畫期間鍵盤殘留
            (document.activeElement as HTMLElement | null)?.blur?.();
            onClose();
          }}
          aria-label="關閉新增餐面板"
          className="flex-shrink-0 flex justify-center items-end h-11 pb-2 outline-none focus-visible:bg-surface-3 active:bg-surface-3 transition-colors"
        >
          <span
            style={{
              width: 36, height: 4,
              background: 'var(--color-hairline-strong)',
              borderRadius: 2,
            }}
          />
        </button>
        <div className="flex items-center justify-center px-5 h-11 border-b border-hairline flex-shrink-0">
          <span className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-medium">{title}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">{children}</div>
      </aside>
    </>
  );
}
