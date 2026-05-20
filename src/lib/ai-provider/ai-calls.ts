import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AiCallKind, ProviderName, CallTrigger } from './interface';
import type { AnthropicUsage } from './retry';

export async function startAiCall(input: {
  userId: string;
  correlationId: string;
  provider: ProviderName;
  kind: AiCallKind;
  trigger: CallTrigger;
  model: string;
  promptVersion: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .schema('app_private')
    .from('ai_calls')
    .insert({
      user_id: input.userId,
      correlation_id: input.correlationId,
      provider: input.provider,
      kind: input.kind,
      trigger: input.trigger,
      model: input.model,
      prompt_version: input.promptVersion,
      status: 'started',
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function finishAiCall(callId: string, input: {
  status: 'succeeded' | 'failed';
  attempt?: number;
  usage?: AnthropicUsage;
  estimatedCostUsd?: number;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  await supabaseAdmin().schema('app_private').from('ai_calls').update({
    status: input.status,
    attempt: input.attempt ?? null,
    input_tokens: input.usage?.input_tokens ?? null,
    output_tokens: input.usage?.output_tokens ?? null,
    cache_creation_input_tokens: input.usage?.cache_creation_input_tokens ?? null,
    cache_read_input_tokens: input.usage?.cache_read_input_tokens ?? null,
    estimated_cost_usd: input.estimatedCostUsd ?? null,
    latency_ms: input.latencyMs ?? null,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    finished_at: new Date().toISOString(),
  }).eq('id', callId);
}
