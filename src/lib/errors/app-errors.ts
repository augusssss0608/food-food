import { supabaseAdmin } from '@/lib/supabase/admin';

export type AppErrorKind =
  | 'ai_call'
  | 'push_send'
  | 'cron'
  | 'auth'
  | 'provider_fallback'
  | 'oauth_token_expired'
  | 'fallback_cap_cron_skip';

export async function writeAppError(input: {
  kind: AppErrorKind;
  correlationId?: string;
  context?: Record<string, unknown>;
  message?: string;
  stack?: string;
}): Promise<void> {
  await supabaseAdmin().schema('app_private').from('app_errors').insert({
    kind: input.kind,
    context: { ...(input.context ?? {}), correlation_id: input.correlationId },
    message: input.message?.slice(0, 1000),
    stack: input.stack?.slice(0, 4000),
  });
}
