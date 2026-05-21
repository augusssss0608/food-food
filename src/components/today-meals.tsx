'use client';
import { useEffect, useState } from 'react';
import { SectionLabel } from './ui/card';
import { MealInlineEditor, type MealEditorVariant } from './meal-inline-editor';

// 用戶評估期：A/B/C 三套展開樣式並存，localStorage 記住偏好。挑完後把 switcher 移除 + 刪掉沒選的 variant。
const VARIANT_KEY = 'mealEditorVariant';
const VARIANTS: MealEditorVariant[] = ['a', 'b', 'c'];
const VARIANT_LABELS: Record<MealEditorVariant, string> = {
  a: '只讀 + 編輯切換',
  b: 'Apple Health 風格',
  c: '緊湊始終可編輯',
};

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

/**
 * 列出今日 meals。點某條 → inline 展開 MealInlineEditor 改 / 刪 / 收起。
 * 不再彈半窗 sheet（用戶反饋）。
 * 飽腹感 chip 直接顯示在主行（用戶要求不破壞排版前提下提升可見度）。
 *
 * mounted gate：只在 client mount 後讀 localStorage + 顯示 switcher / editor，避免
 * SSR 渲染 'a' 之後 client hydration 跳到 'b'/'c' 的閃爍（codex round A low）。
 */
export function TodayMeals({ meals, timezone }: { meals: TodayMeal[]; timezone: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variant, setVariant] = useState<MealEditorVariant>('a');
  const [mounted, setMounted] = useState(false);

  // 掛載後讀 localStorage，再切 variant
  useEffect(() => {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(VARIANT_KEY);
    if (stored === 'a' || stored === 'b' || stored === 'c') setVariant(stored);
    setMounted(true);
  }, []);

  function pickVariant(v: MealEditorVariant) {
    setVariant(v);
    if (typeof window !== 'undefined') window.localStorage.setItem(VARIANT_KEY, v);
    setExpandedId(null); // 切 variant 自動收起，避免狀態錯亂
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
      <div className="flex items-center justify-between mb-2">
        {/* 直接 inline h2，避免 SectionLabel mb-3 與 wrapper 的 mb-2 衝突（codex round A nit） */}
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-medium">
          今日已記錄 · {meals.length}
        </h2>
        {/* TEMP：variant 切換器（評估期），決定樣式後刪掉這塊；mounted 後再顯示避免閃爍 */}
        {mounted && (
          <div className="flex items-center gap-1.5" role="group" aria-label="餐點展開樣式切換">
            <span className="text-[9px] uppercase tracking-[0.18em] text-text-3 font-mono mr-1">樣式</span>
            {VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pickVariant(v)}
                aria-pressed={variant === v}
                aria-label={`切換到樣式 ${v.toUpperCase()}：${VARIANT_LABELS[v]}`}
                className={[
                  'w-7 h-7 rounded-md text-[11px] font-mono uppercase transition-colors',
                  variant === v
                    ? 'bg-accent text-accent-ink'
                    : 'bg-surface-2 border border-hairline text-text-2 hover:border-hairline-strong',
                ].join(' ')}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {meals.map((m) => {
          const expanded = expandedId === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : m.id)}
                className={[
                  'w-full bg-surface border border-hairline px-4 py-3 flex items-center gap-3 text-left transition-colors',
                  expanded ? 'rounded-t-xl border-b-0' : 'rounded-xl hover:border-hairline-strong active:bg-surface-2',
                ].join(' ')}
              >
                <div className="flex-1 min-w-0">
                  {/* inner flex 加 min-w-0：讓 truncate 在長菜名時生效，不擠到 chip 和 kcal */}
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[14px] text-text font-medium truncate min-w-0">
                      {m.dish_name ?? '未命名'}
                    </p>
                    {m.satiety != null && <SatietyChip value={m.satiety} />}
                  </div>
                  <p className="text-[11px] text-text-3 font-mono tabular mt-0.5">
                    {new Date(m.ate_at).toLocaleTimeString('zh-TW', {
                      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
                    })}
                    {' · '}
                    {SOURCE_LABEL[m.source]}
                  </p>
                </div>
                <p className="text-[16px] font-mono text-accent tabular flex-shrink-0">
                  {m.kcal == null ? '—' : Math.round(m.kcal)}
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
              {/* mounted 後才渲染編輯器，避免 variant 還在 default 'a' 時被用戶碰到後再切閃 */}
              {expanded && mounted && (
                <MealInlineEditor meal={m} onDone={() => setExpandedId(null)} variant={variant} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SatietyChip({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-mono tabular flex-shrink-0">
      飽 {value}
    </span>
  );
}
