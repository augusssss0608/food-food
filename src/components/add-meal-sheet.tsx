'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

const DRAG_CLOSE_THRESHOLD = 100;  // 下滑超過 100px 釋放 = 關閉
const DRAG_MOVE_THRESHOLD = 8;     // 進入拖動模式的位移門檻

function SheetShell({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  // 下滑收起手勢：用戶要求拿掉視覺橫桿 + 支持向下滑動關閉
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
      // 向下滑 + 內容已滾到頂 → 進入拖動關閉模式；否則交還滾動
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
      // 只跟下滑，向上不動（避免 sheet 被往上拽）
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
        // 動畫結束後再清 dragY，否則 close translate 會跟 dragY 疊加閃一下
        setTimeout(() => setDragY(0), 300);
      } else {
        setDragY(0);
      }
    }
    setDragging(false);
  }

  // 關閉態 → 從底部滑出；打開態 → translateY(dragY)，dragging 時無 transition 跟手
  const transform = open
    ? `translateY(${dragY}px)`
    : 'translateY(100%)';
  const transition = dragging
    ? 'none'
    : 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';

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
        {/*
          標題行：拖把視覺已去掉（用戶要求）。一般用戶靠遮罩點擊 / 下滑手勢關閉。
          sr-only close button 為 VoiceOver / 鍵盤用戶提供入口（不影響視覺），補回 a11y。
        */}
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
