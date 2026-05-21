'use client';
import { useState } from 'react';
import { SectionLabel } from './ui/card';
import { MealInlineEditor } from './meal-inline-editor';

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
 */
export function TodayMeals({ meals, timezone }: { meals: TodayMeal[]; timezone: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              {expanded && (
                <MealInlineEditor meal={m} onDone={() => setExpandedId(null)} />
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
