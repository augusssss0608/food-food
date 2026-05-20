import type { AiProvider, CallContext, ProviderName, WithMeta } from './interface';
import type {
  NutritionEstimate, BodyMetricsExtracted, TargetSet, AdviceResult,
  ProfileInput, DailyContext, WeeklyContext, MonthlyContext,
} from '@/lib/types/ai';

export class SandboxAgentSdkProvider implements AiProvider {
  readonly providerName: ProviderName = 'claude_agent_sdk';

  constructor(_opts: { snapshotId: string; oauthToken: string }) {
    // Phase 3 POC 时实现，v1 留空
  }

  private notImpl(): never {
    throw new Error('SandboxAgentSdkProvider not implemented in Phase 1 (留待 Phase 3 POC)');
  }

  estimateMealFromImage(_input: { imageBase64: string }, _ctx: CallContext): Promise<NutritionEstimate & WithMeta> {
    return this.notImpl();
  }
  extractBodyMetrics(_input: { imageBase64: string }, _ctx: CallContext): Promise<BodyMetricsExtracted & WithMeta> {
    return this.notImpl();
  }
  computeInitialTargets(_input: ProfileInput, _ctx: CallContext): Promise<TargetSet & WithMeta> {
    return this.notImpl();
  }
  generateDailyAdvice(_input: DailyContext, _ctx: CallContext): Promise<AdviceResult & WithMeta> {
    return this.notImpl();
  }
  generateWeeklyAdvice(_input: WeeklyContext, _ctx: CallContext): Promise<AdviceResult & WithMeta> {
    return this.notImpl();
  }
  generateMonthlyAdvice(_input: MonthlyContext, _ctx: CallContext): Promise<AdviceResult & WithMeta> {
    return this.notImpl();
  }
}
