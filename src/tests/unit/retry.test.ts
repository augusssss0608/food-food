import { describe, it, expect, vi } from 'vitest';
import { callWithRetry, classifyAnthropicError, parseRetryAfter } from '@/lib/ai-provider/retry';
import { AIError } from '@/lib/ai-provider/errors';
import { z } from 'zod';

const Schema = z.object({ ok: z.boolean() });

describe('callWithRetry', () => {
  it('returns parsed data on first success', async () => {
    const fn = vi.fn().mockResolvedValue({ raw: { ok: true }, usage: { input_tokens: 10, output_tokens: 5 } });
    const r = await callWithRetry(fn, Schema, { maxTransportAttempts: 3, maxSchemaRetries: 1 });
    expect(r.data).toEqual({ ok: true });
    expect(r.attempts).toBe(1);
  });

  it('retries transport errors up to maxTransportAttempts then throws transport AIError with attempts', async () => {
    const err = Object.assign(new Error('500'), { status: 500 });
    const fn = vi.fn().mockRejectedValue(err);
    try {
      await callWithRetry(fn, Schema, { maxTransportAttempts: 3, maxSchemaRetries: 1 });
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(AIError);
      expect((e as AIError).category).toBe('transport');
      expect((e as AIError).attempts).toBe(3);
    }
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('classifies 429 as rate_limit (not transport) even after attempts exhausted', async () => {
    const err = Object.assign(new Error('429'), { status: 429 });
    const fn = vi.fn().mockRejectedValue(err);
    try {
      await callWithRetry(fn, Schema, { maxTransportAttempts: 2, maxSchemaRetries: 1 });
    } catch (e: unknown) {
      expect((e as AIError).category).toBe('rate_limit');
    }
  });

  it('schema retry once then throws schema_invalid', async () => {
    const fn = vi.fn().mockResolvedValue({ raw: { ok: 'not_a_bool' }, usage: undefined });
    try {
      await callWithRetry(fn, Schema, { maxTransportAttempts: 3, maxSchemaRetries: 1 });
    } catch (e: unknown) {
      expect((e as AIError).category).toBe('schema_invalid');
    }
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('classifyAnthropicError', () => {
  it('429 → rate_limit', () => {
    expect(classifyAnthropicError({ status: 429, message: 'rl' }).category).toBe('rate_limit');
  });
  it('500 → transport', () => {
    expect(classifyAnthropicError({ status: 500, message: 'srv' }).category).toBe('transport');
  });
  it('401 → auth_oauth', () => {
    expect(classifyAnthropicError({ status: 401, message: 'auth' }).category).toBe('auth_oauth');
  });
  it('unknown → unknown', () => {
    expect(classifyAnthropicError({ message: '?' }).category).toBe('unknown');
  });
});

describe('parseRetryAfter', () => {
  it('returns ms capped at 15s', () => {
    expect(parseRetryAfter('30')).toBe(15000);
    expect(parseRetryAfter('5')).toBe(5000);
  });
  it('returns null for missing / invalid', () => {
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter('abc')).toBeNull();
    expect(parseRetryAfter('-1')).toBeNull();
  });
});
