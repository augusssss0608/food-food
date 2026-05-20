import type { AiProvider, CallContext, ProviderName } from './interface';
import type { AIErrorCategory } from './errors';
import { AIError } from './errors';
import { reserveAiBudget, tryReserveFallbackMonthlyCap, settleFallbackMonthlyCap } from './budget';
import { writeAppError } from '@/lib/errors/app-errors';

const FALLBACK_ELIGIBLE = new Set<AIErrorCategory>(['transport', 'auth_oauth', 'schema_invalid']);

type AnyMethod = Exclude<keyof AiProvider, 'providerName'>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => Promise<any>;

export function withFallback(primary: AiProvider, fallback: AiProvider): AiProvider {
  const wrap = (method: AnyMethod): AnyFn => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (...args: any[]) => {
      try {
        return await (primary[method] as AnyFn)(...args);
      } catch (primaryErr) {
        if (!(primaryErr instanceof AIError) || !FALLBACK_ELIGIBLE.has(primaryErr.category)) throw primaryErr;
        const ctx = args[1] as CallContext;

        const appErrorKind = primaryErr.category === 'auth_oauth' ? 'oauth_token_expired' as const : 'provider_fallback' as const;
        await writeAppError({
          kind: appErrorKind,
          correlationId: ctx.correlationId,
          context: { primary: primary.providerName, category: primaryErr.category, message: primaryErr.message },
        });

        const ctxIsCron = ctx.trigger === 'cron';
        let monthlyUsage: string | null = null;
        if (ctxIsCron) {
          const { ok, usageMonth } = await tryReserveFallbackMonthlyCap(ctx.userId, ctx.kind);
          if (!ok) {
            await writeAppError({ kind: 'fallback_cap_cron_skip', correlationId: ctx.correlationId });
            throw new AIError('fallback_cap_cron_skip', false, 'fallback monthly $5 exhausted; cron skipped', primaryErr);
          }
          monthlyUsage = usageMonth;
        }

        let fbUsageDate: string;
        try {
          ({ usageDate: fbUsageDate } = await reserveAiBudget(ctx.userId, ctx.kind));
        } catch (dailyReserveErr) {
          if (ctxIsCron && monthlyUsage) {
            await settleFallbackMonthlyCap(ctx.userId, ctx.kind, monthlyUsage, 0);
          }
          if (dailyReserveErr instanceof AIError) dailyReserveErr.cause = primaryErr;
          throw dailyReserveErr;
        }

        const fallbackCtx: CallContext = { ...ctx, usageDate: fbUsageDate };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fallbackResult: any = null;
        let fallbackErrCaught: unknown = null;
        try {
          fallbackResult = await (fallback[method] as AnyFn)(args[0], fallbackCtx);
          if (fallbackResult?._meta) fallbackResult._meta.fallbackFrom = primary.providerName;
        } catch (fallbackErr) {
          fallbackErrCaught = fallbackErr;
          if (fallbackErr instanceof AIError) fallbackErr.cause = primaryErr;
        }

        if (ctxIsCron && monthlyUsage) {
          const actual = fallbackResult?._meta?.costCents ?? 0;
          await settleFallbackMonthlyCap(ctx.userId, ctx.kind, monthlyUsage, actual);
        }
        if (fallbackErrCaught) throw fallbackErrCaught;
        return fallbackResult;
      }
    };
  };

  return {
    providerName: fallback.providerName as ProviderName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    estimateMealFromImage: wrap('estimateMealFromImage') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractBodyMetrics: wrap('extractBodyMetrics') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    computeInitialTargets: wrap('computeInitialTargets') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateDailyAdvice: wrap('generateDailyAdvice') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateWeeklyAdvice: wrap('generateWeeklyAdvice') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateMonthlyAdvice: wrap('generateMonthlyAdvice') as any,
  };
}
