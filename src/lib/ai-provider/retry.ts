import type { z } from 'zod';
import { AIError } from './errors';

export type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export type AIAttempt = { attempt: number; schemaRetry: boolean };

export type CallWithRetryOpts = {
  maxTransportAttempts: number;
  maxSchemaRetries: number;
};

export type CallWithRetryResult<T> = {
  data: T;
  attempts: number;
  usage?: AnthropicUsage;
};

type AnthropicLikeError = {
  status?: number;
  message?: string;
  headers?: Record<string, string>;
};

export async function callWithRetry<T>(
  fn: (ctx: AIAttempt) => Promise<{ raw: unknown; usage?: AnthropicUsage }>,
  schema: z.Schema<T>,
  opts: CallWithRetryOpts = { maxTransportAttempts: 4, maxSchemaRetries: 1 },
): Promise<CallWithRetryResult<T>> {
  let schemaRetries = 0;
  let lastTransportErr: unknown = null;

  for (let attempt = 0; attempt < opts.maxTransportAttempts; attempt++) {
    try {
      const { raw, usage } = await fn({ attempt, schemaRetry: schemaRetries > 0 });
      const parsed = schema.safeParse(raw);
      if (parsed.success) {
        return { data: parsed.data, attempts: attempt + 1, usage };
      }
      if (schemaRetries < opts.maxSchemaRetries) {
        schemaRetries++;
        continue;
      }
      throw new AIError('schema_invalid', false, 'AI returned invalid JSON', parsed.error, attempt + 1);
    } catch (e: unknown) {
      if (e instanceof AIError) throw e;
      lastTransportErr = e;
      const errObj = e as AnthropicLikeError;
      const retryAfterMs = parseRetryAfter(errObj?.headers?.['retry-after']);
      if (isRetriableAnthropicError(errObj) && attempt < opts.maxTransportAttempts - 1) {
        await sleep(retryAfterMs ?? jitteredBackoffMs(attempt));
        continue;
      }
      const classified = classifyAnthropicError(errObj);
      classified.attempts = attempt + 1;
      throw classified;
    }
  }
  throw classifyAnthropicError(lastTransportErr as AnthropicLikeError);
}

export function isRetriableAnthropicError(e: AnthropicLikeError | null | undefined): boolean {
  if (!e) return false;
  return (e.status !== undefined && [408, 409, 429].includes(e.status))
    || (typeof e.status === 'number' && e.status >= 500);
}

export function jitteredBackoffMs(n: number): number {
  return Math.floor(Math.min(1000 * 2 ** n, 10_000) * (0.5 + Math.random()));
}

export function parseRetryAfter(h?: string): number | null {
  if (!h) return null;
  const sec = Number(h);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return Math.min(sec * 1000, 15_000);
}

export function classifyAnthropicError(e: AnthropicLikeError | null | undefined): AIError {
  if (e?.status === 429) return new AIError('rate_limit', false, e?.message ?? 'rate limited', e);
  if (typeof e?.status === 'number' && (e.status >= 500 || [408, 409].includes(e.status))) {
    return new AIError('transport', false, e?.message ?? 'transport failure', e);
  }
  if (e?.status === 401 || e?.status === 403) {
    return new AIError('auth_oauth', false, e?.message ?? 'auth failed', e);
  }
  return new AIError('unknown', false, e?.message ?? 'unclassified', e);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
