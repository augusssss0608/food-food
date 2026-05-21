'use client';
import { type ReactNode } from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/page-header';
import { WorkoutDayToggle } from '@/components/workout-day-toggle';
import { TodaySummary } from '@/components/today-summary';
import { TodayMeals } from '@/components/today-meals';
import { Button } from '@/components/ui/button';
import type { HomeDataApi } from './use-home-data';

/**
 * 接近真實主頁的 shell — 用真實組件 PageHeader / WorkoutDayToggle / TodaySummary /
 * TodayMeals / AI 按鈕，從 useHomeData hook 接全部 state + mutation。
 *
 * 每個 prototype variant 用法：
 * - 傳 homeApi（從 useHomeData 拿）
 * - 傳 rightAction：替換 PageHeader 右上「+」按鈕（v3/v4 設 undefined 用 entry 替代）
 * - 可選 todayMealsExtraSlot：插入到 today meals 末尾（v5 Ledger 用）
 */
export function RealHomeShell({
  api,
  rightAction,
  todayMealsExtraSlot,
}: {
  api: HomeDataApi;
  rightAction?: ReactNode;
  todayMealsExtraSlot?: ReactNode;
}) {
  const today = new Date().toLocaleDateString('zh-TW', {
    month: 'long', day: 'numeric', weekday: 'long', timeZone: api.timezone,
  });

  return (
    <PageShell>
      <PageHeader rightAction={rightAction}>
        <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-1">{today}</p>
        <h1 className="display-roman text-[34px] leading-none">
          food <span className="display">·</span> food
        </h1>
      </PageHeader>

      <WorkoutDayToggle
        workoutMarked={api.workoutMarked}
        onSetWorkoutDay={api.setWorkoutDay}
        busy={api.workoutBusy}
      />

      <TodaySummary
        consumed={api.consumed}
        targets={api.targets}
        workoutMarked={api.workoutMarked}
        isWorkoutDay={api.isWorkoutDay}
        onSetWorkoutDay={api.setWorkoutDay}
        busy={api.workoutBusy}
      />

      <TodayMeals
        meals={api.meals}
        timezone={api.timezone}
        onMealDeleted={api.onMealDeleted}
        onMealUpdated={api.onMealUpdated}
      />

      {todayMealsExtraSlot}

      <section>
        <Button onClick={api.triggerDailyAdvice} loading={api.adviceBusy} size="lg" className="w-full">
          {api.adviceBusy ? 'AI 思考中…' : '今天怎麼樣？'}
        </Button>
        <p className="text-center text-[11px] text-text-4 mt-2 font-mono uppercase tracking-wide">
          AI generates a daily summary
        </p>
      </section>
    </PageShell>
  );
}
