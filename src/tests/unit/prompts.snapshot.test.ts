import { describe, it, expect } from 'vitest';
import {
  buildNutritionPrompt,
  buildBodyMetricsPrompt,
  buildInitialTargetsPrompt,
  buildDailyAdvicePrompt,
  buildWeeklyAdvicePrompt,
  buildMonthlyAdvicePrompt,
  NUTRITION_PROMPT_VERSION,
  BODY_METRICS_PROMPT_VERSION,
  INITIAL_TARGETS_PROMPT_VERSION,
  DAILY_ADVICE_PROMPT_VERSION,
  WEEKLY_ADVICE_PROMPT_VERSION,
  MONTHLY_ADVICE_PROMPT_VERSION,
  SYSTEM_RULES,
} from '@/lib/ai-provider/prompts';

describe('prompt versions', () => {
  it('all 6 versions match pattern', () => {
    for (const v of [
      NUTRITION_PROMPT_VERSION, BODY_METRICS_PROMPT_VERSION, INITIAL_TARGETS_PROMPT_VERSION,
      DAILY_ADVICE_PROMPT_VERSION, WEEKLY_ADVICE_PROMPT_VERSION, MONTHLY_ADVICE_PROMPT_VERSION,
    ]) {
      expect(v).toMatch(/^[a-z][a-z0-9-]+v\d+$/);
    }
  });
});

describe('prompt snapshots', () => {
  it('SYSTEM_RULES is stable', () => {
    expect(SYSTEM_RULES).toMatchSnapshot();
  });
  it('nutrition prompt is stable', () => {
    expect(buildNutritionPrompt()).toMatchSnapshot();
  });
  it('body metrics prompt is stable', () => {
    expect(buildBodyMetricsPrompt()).toMatchSnapshot();
  });
  it('initial targets prompt is stable', () => {
    expect(buildInitialTargetsPrompt({
      height_cm: 175, current_weight_kg: 70, birth_date: '1996-05-19',
      sex: 'male', training_days_per_week: 3,
    })).toMatchSnapshot();
  });
  it('daily advice prompt is stable', () => {
    const ctx = {
      date: '2026-05-19', is_workout: true, targets: {
        kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140,
        carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28,
      },
      meals: [], body_metrics: [], prior_advice: [],
    };
    expect(buildDailyAdvicePrompt(ctx)).toMatchSnapshot();
  });
  it('weekly + monthly prompt stable', () => {
    const ctx = {
      period_start: '2026-05-18', period_end: '2026-05-24',
      targets: { kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140, carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28 },
      meals: [], body_metrics: [], workout_days: [], prior_advice: [],
    };
    expect(buildWeeklyAdvicePrompt(ctx)).toMatchSnapshot();
    expect(buildMonthlyAdvicePrompt(ctx)).toMatchSnapshot();
  });
});
