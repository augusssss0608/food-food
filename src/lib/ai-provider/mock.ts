import type { AiProvider, CallContext, ProviderName, AiMeta, WithMeta } from './interface';
import type { AIErrorCategory } from './errors';
import { AIError } from './errors';
import type {
  NutritionEstimate, BodyMetricsExtracted, TargetSet, AdviceResult,
  ProfileInput, DailyContext, WeeklyContext, MonthlyContext,
} from '@/lib/types/ai';

export type MockBehavior =
  | { kind: 'success' }
  | { kind: 'throw'; category: AIErrorCategory; message?: string };

const FIXED_MEAL: NutritionEstimate = {
  dish_name: '牛肉糙米饭', kcal: 480, protein_g: 38, carb_g: 52, fat_g: 12, fiber_g: 6, confidence: 'medium',
};
const FIXED_BODY: BodyMetricsExtracted = { weight_kg: 70, body_fat_pct: 18, confidence: 'high' };
const FIXED_TARGETS: TargetSet = {
  kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140,
  carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28,
};
const FIXED_DAILY_ADVICE: AdviceResult = { content_md: '## 今日总评\n...' };
const FIXED_WEEKLY_ADVICE: AdviceResult = { content_md: '## 本周总评\n...' };
const FIXED_MONTHLY_ADVICE: AdviceResult = { content_md: '## 本月总评\n...' };

type CallsRecord = {
  estimateMealFromImage: number;
  extractBodyMetrics: number;
  computeInitialTargets: number;
  generateDailyAdvice: number;
  generateWeeklyAdvice: number;
  generateMonthlyAdvice: number;
};

export class MockAiProvider implements AiProvider {
  readonly providerName: ProviderName = 'mock';

  calls: CallsRecord = {
    estimateMealFromImage: 0,
    extractBodyMetrics: 0,
    computeInitialTargets: 0,
    generateDailyAdvice: 0,
    generateWeeklyAdvice: 0,
    generateMonthlyAdvice: 0,
  };

  private behaviors: Partial<Record<keyof CallsRecord, MockBehavior[]>> = {};

  setNextBehavior(method: keyof CallsRecord, b: MockBehavior): void {
    (this.behaviors[method] ??= []).push(b);
  }

  private async invoke<T extends object>(
    method: keyof CallsRecord, fixture: T, _ctx: CallContext,
  ): Promise<T & WithMeta> {
    this.calls[method]++;
    const b = this.behaviors[method]?.shift() ?? { kind: 'success' as const };
    if (b.kind === 'throw') throw new AIError(b.category, false, b.message ?? `mock-${b.category}`);
    const meta: AiMeta = { provider: 'mock', durationMs: 1, attempts: 1 };
    return { ...fixture, _meta: meta };
  }

  estimateMealFromImage(_i: { imageBase64: string }, ctx: CallContext) {
    return this.invoke('estimateMealFromImage', FIXED_MEAL, ctx);
  }
  extractBodyMetrics(_i: { imageBase64: string }, ctx: CallContext) {
    return this.invoke('extractBodyMetrics', FIXED_BODY, ctx);
  }
  computeInitialTargets(_i: ProfileInput, ctx: CallContext) {
    return this.invoke('computeInitialTargets', FIXED_TARGETS, ctx);
  }
  generateDailyAdvice(_i: DailyContext, ctx: CallContext) {
    return this.invoke('generateDailyAdvice', FIXED_DAILY_ADVICE, ctx);
  }
  generateWeeklyAdvice(_i: WeeklyContext, ctx: CallContext) {
    return this.invoke('generateWeeklyAdvice', FIXED_WEEKLY_ADVICE, ctx);
  }
  generateMonthlyAdvice(_i: MonthlyContext, ctx: CallContext) {
    return this.invoke('generateMonthlyAdvice', FIXED_MONTHLY_ADVICE, ctx);
  }
}
