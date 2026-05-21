'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SectionLabel } from './ui/card';
import { MealInlineEditor } from './meal-inline-editor';
import { useToast } from './ui/toast';

export type TodayMeal = {
  id: string;
  ate_at: string;
  source: 'preset' | 'photo_ai' | 'manual';
  dish_name: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  satiety: number | null;
};

const SOURCE_LABEL: Record<TodayMeal['source'], string> = {
  preset: 'preset',
  photo_ai: 'ai',
  manual: '手動',
};

// 左滑揭示刪除按鈕的視覺常量
const SWIPE_THRESHOLD = 40;  // 釋放時 < -threshold 鎖定揭示態
const REVEAL_WIDTH = 80;      // 露出的刪除按鈕寬度
const MOVE_THRESHOLD = 10;    // 方向鎖閾值（避免和垂直滾動衝突）

/**
 * 列出今日 meals。
 * - 點某條 → inline 展開 MealInlineEditor 編輯（再點收起）
 * - 左滑某條 → 露出右側「刪除」按鈕；點刪除按鈕觸發 DELETE
 * - 同時只能有一條處於「揭示態」（swipedId）
 */
export function TodayMeals({ meals, timezone }: { meals: TodayMeal[]; timezone: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  function handleTap(id: string) {
    if (swipedId === id) {
      // 已揭示 → 點主行 = 收回
      setSwipedId(null);
      return;
    }
    setSwipedId(null);
    setExpandedId(expandedId === id ? null : id);
  }

  if (meals.length === 0) {
    return (
      <section className="mb-7">
        <SectionLabel>今日已記錄</SectionLabel>
        <div className="bg-surface border border-hairline rounded-xl px-5 py-6 text-center">
          <p className="text-[13px] text-text-3">還沒記錄</p>
          <p className="text-[11px] text-text-4 mt-1">點右上「＋」開始</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-7">
      <SectionLabel>今日已記錄 · {meals.length}</SectionLabel>
      <ul className="space-y-2">
        {meals.map((m) => (
          <MealRow
            key={m.id}
            meal={m}
            timezone={timezone}
            expanded={expandedId === m.id}
            swipedOpen={swipedId === m.id}
            onTap={() => handleTap(m.id)}
            onSwipeOpen={() => setSwipedId(m.id)}
            onSwipeClose={() => { if (swipedId === m.id) setSwipedId(null); }}
            onCollapseEditor={() => setExpandedId(null)}
          />
        ))}
      </ul>
    </section>
  );
}

function MealRow({
  meal,
  timezone,
  expanded,
  swipedOpen,
  onTap,
  onSwipeOpen,
  onSwipeClose,
  onCollapseEditor,
}: {
  meal: TodayMeal;
  timezone: string;
  expanded: boolean;
  swipedOpen: boolean;
  onTap: () => void;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onCollapseEditor: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startRef = useRef<{ x: number; y: number; phase: 'pending' | 'horiz' | 'vert' } | null>(null);

  // parent 通過 swipedOpen 控制；當其他 row 被打開時 swipedOpen 變 false → 復位
  useEffect(() => { if (!swipedOpen) setDragX(0); }, [swipedOpen]);

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    startRef.current = { x: t.clientX, y: t.clientY, phase: 'pending' };
    setDragging(false);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    const start = startRef.current;
    if (!start) return;
    const t = e.touches[0]!;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (start.phase === 'pending') {
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        if (Math.abs(dx) > Math.abs(dy)) {
          start.phase = 'horiz';
          setDragging(true);
        } else {
          start.phase = 'vert';
          return;
        }
      } else {
        return;
      }
    }

    if (start.phase === 'horiz') {
      // base = -80 已揭示開始拖；0 = 未揭示
      const base = swipedOpen ? -REVEAL_WIDTH : 0;
      const next = Math.max(-REVEAL_WIDTH, Math.min(0, base + dx));
      setDragX(next);
    }
    // vert：什麼都不做，讓瀏覽器原生滾動接管
  }

  function onTouchEnd() {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    if (start.phase === 'horiz') {
      // 釋放：根據當前 dragX 決定 snap 方向
      if (dragX < -SWIPE_THRESHOLD) {
        onSwipeOpen();   // parent 設 swipedId
        setDragX(-REVEAL_WIDTH);  // 立即定位（隨後 effect 與 prop 一致）
      } else {
        onSwipeClose();
        setDragX(0);
      }
      setDragging(false);
    } else {
      // pending / vert：沒拖動 → 普通 tap，由 button onClick 處理
      setDragging(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/meals/${meal.id}`, {
        method: 'DELETE',
        headers: { 'sec-fetch-site': 'same-origin' },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      toast.success('已刪除', meal.dish_name ?? '未命名');
      onSwipeClose();
      onCollapseEditor();
      startTransition(() => router.refresh());
    } catch (e: unknown) {
      toast.error('刪除失敗', (e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  // 圓角：未展開全圓；展開上半圓（編輯器在下面接續）
  const rowRounded = expanded ? 'rounded-t-xl border-b-0' : 'rounded-xl';

  return (
    <li className="relative">
      {/* 後景：左滑時露出的「刪除」按鈕（pointer-events 由 dragX 決定）*/}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`刪除 ${meal.dish_name ?? '未命名'}`}
        className={[
          'absolute right-0 top-0 bottom-0 bg-danger text-white text-[13px] font-medium',
          'flex items-center justify-center transition-opacity',
          rowRounded.includes('rounded-t-xl') ? 'rounded-tr-xl' : 'rounded-r-xl',
        ].join(' ')}
        style={{
          width: REVEAL_WIDTH,
          // 完全收回時禁止點擊（避免遮罩無效命中）
          pointerEvents: dragX < -2 ? 'auto' : 'none',
          opacity: dragX < -2 ? 1 : 0,
        }}
      >
        {deleting ? '...' : '刪除'}
      </button>

      {/* 前景：主行 + 內聯編輯器（兩者一起跟著 translate）*/}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
        }}
        className="relative"
      >
        <button
          type="button"
          onClick={onTap}
          className={[
            'w-full bg-surface border border-hairline px-4 py-3 flex items-center gap-3 text-left transition-colors',
            rowRounded,
            !expanded && 'hover:border-hairline-strong active:bg-surface-2',
          ].filter(Boolean).join(' ')}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[14px] text-text font-medium truncate min-w-0">
                {meal.dish_name ?? '未命名'}
              </p>
              {meal.satiety != null && <SatietyChip value={meal.satiety} />}
            </div>
            <p className="text-[11px] text-text-3 font-mono tabular mt-0.5">
              {new Date(meal.ate_at).toLocaleTimeString('zh-TW', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
              })}
              {' · '}
              {SOURCE_LABEL[meal.source]}
            </p>
          </div>
          <p className="text-[16px] font-mono text-accent tabular flex-shrink-0">
            {meal.kcal == null ? '—' : Math.round(meal.kcal)}
            <span className="text-[10px] text-text-3 ml-0.5">kcal</span>
          </p>
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-text-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        {expanded && (
          <MealInlineEditor meal={meal} onDone={onCollapseEditor} />
        )}
      </div>
    </li>
  );
}

function SatietyChip({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-mono tabular flex-shrink-0">
      飽 {value}
    </span>
  );
}
