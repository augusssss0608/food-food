import type {
  NutritionEstimate,
  BodyMetricsExtracted,
  TargetSet,
  AdviceResult,
  ProfileInput,
  DailyContext,
  WeeklyContext,
  MonthlyContext,
} from '@/lib/types/ai';

export type ProviderName = 'anthropic_api' | 'claude_agent_sdk' | 'mock';

export type AiCallKind =
  | 'meal_photo'
  | 'body_ocr'
  | 'initial_targets'
  | 'daily_advice'
  | 'weekly_advice'
  | 'monthly_advice';

export type CallTrigger = 'user' | 'cron' | 'admin';

export interface CallContext {
  userId: string;
  trigger: CallTrigger;
  correlationId: string;
  kind: AiCallKind;
  usageDate: string;  // YYYY-MM-DD（来自 reserveAiBudget RPC OUT）
}

export type AiMeta = {
  provider: ProviderName;
  fallbackFrom?: ProviderName;
  durationMs: number;
  attempts: number;
  costCents?: number;
};

export type WithMeta = { _meta: AiMeta };

export interface AiProvider {
  readonly providerName: ProviderName;

  estimateMealFromImage(input: { imageBase64: string }, ctx: CallContext): Promise<NutritionEstimate & WithMeta>;
  extractBodyMetrics(input: { imageBase64: string }, ctx: CallContext): Promise<BodyMetricsExtracted & WithMeta>;
  computeInitialTargets(input: ProfileInput, ctx: CallContext): Promise<TargetSet & WithMeta>;
  generateDailyAdvice(input: DailyContext, ctx: CallContext): Promise<AdviceResult & WithMeta>;
  generateWeeklyAdvice(input: WeeklyContext, ctx: CallContext): Promise<AdviceResult & WithMeta>;
  generateMonthlyAdvice(input: MonthlyContext, ctx: CallContext): Promise<AdviceResult & WithMeta>;
}
