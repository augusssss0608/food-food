'use client';
import { SectionLabel } from './ui/card';

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
 * Phase 1：列出今日已記錄的 meals（read-only）。
 * 時間顯示用 profile timezone（從父層傳入），跟 server 算今日範圍同口徑。
 * kcal == null 時顯示 "—"，避免「未估算」被誤認為「真的 0」。
 *
 * Phase 2 會加 tap → 詳情 sheet（含編輯 / 刪除）。
 */
export function TodayMeals({ meals, timezone }: { meals: TodayMeal[]; timezone: string }) {
  if (meals.length === 0) {
    return (
      <section className="mb-7">
        <SectionLabel>今日已記錄</SectionLabel>
        <div className="bg-surface border border-hairline rounded-xl px-5 py-6 text-center">
          <p className="text-[13px] text-text-3">還沒記錄</p>
          <p className="text-[11px] text-text-4 mt-1">點下方 preset 或拍餐開始</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-7">
      <SectionLabel>今日已記錄 · {meals.length}</SectionLabel>
      <ul className="space-y-2">
        {meals.map((m) => (
          <li
            key={m.id}
            className="bg-surface border border-hairline rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-text font-medium truncate">
                {m.dish_name ?? '未命名'}
              </p>
              <p className="text-[11px] text-text-3 font-mono tabular mt-0.5">
                {new Date(m.ate_at).toLocaleTimeString('zh-TW', {
                  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
                })}
                {' · '}
                {SOURCE_LABEL[m.source]}
                {m.satiety != null && (
                  <span className="ml-1">· 飽 {m.satiety}</span>
                )}
              </p>
            </div>
            <p className="text-[16px] font-mono text-accent tabular flex-shrink-0">
              {m.kcal == null ? '—' : Math.round(m.kcal)}
              <span className="text-[10px] text-text-3 ml-0.5">kcal</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
