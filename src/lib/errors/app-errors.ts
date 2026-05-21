import { supabaseAdmin } from '@/lib/supabase/admin';
import { sanitizeContext } from './sanitize';

export type AppErrorKind =
  | 'ai_call'
  | 'push_send'
  | 'cron'
  | 'auth'
  | 'provider_fallback'
  | 'oauth_token_expired'
  | 'fallback_cap_cron_skip'
  | 'meals_patch'
  | 'meals_delete'
  | 'workout_day_set'
  | 'home_snapshot'
  | 'body_snapshot'
  | 'meal_presets_create';

/**
 * 写 app_errors。**永不抛**——内部任何异常（含 DB 网络错误）都吞掉并 console.error，
 * 因为它本身是错误处理路径的最后一站，二次抛错会掩盖原始问题。
 * context 经 sanitizeContext 处理后入库（spec §7.2：敏感字段必须脱敏）。
 */
export async function writeAppError(input: {
  kind: AppErrorKind;
  correlationId?: string;
  context?: Record<string, unknown>;
  message?: string;
  stack?: string;
}): Promise<void> {
  try {
    const merged = { ...(input.context ?? {}), correlation_id: input.correlationId };
    const sanitized = sanitizeContext(merged);
    const { error } = await supabaseAdmin().schema('app_private').from('app_errors').insert({
      kind: input.kind,
      context: sanitized,
      message: input.message?.slice(0, 1000),
      stack: input.stack?.slice(0, 4000),
    });
    if (error) {
      console.error('[writeAppError] insert failed:', error.message, 'kind=', input.kind);
    }
  } catch (e) {
    console.error('[writeAppError] threw:', e instanceof Error ? e.message : e, 'kind=', input.kind);
  }
}
