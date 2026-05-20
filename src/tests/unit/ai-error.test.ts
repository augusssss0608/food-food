import { describe, it, expect } from 'vitest';
import { AIError, type AIErrorCategory } from '@/lib/ai-provider/errors';

describe('AIError', () => {
  it('extends Error and is instanceof', () => {
    const e = new AIError('transport', false, 'boom');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(AIError);
    expect(e.name).toBe('AIError');
  });

  it('preserves category / retryable / message / cause / attempts', () => {
    const cause = new Error('inner');
    const e = new AIError('transport', true, 'boom', cause, 3);
    expect(e.category).toBe('transport');
    expect(e.retryable).toBe(true);
    expect(e.message).toBe('boom');
    expect(e.cause).toBe(cause);
    expect(e.attempts).toBe(3);
  });

  it('accepts all 7 categories', () => {
    const cats: AIErrorCategory[] = [
      'transport','auth_oauth','schema_invalid','rate_limit',
      'fallback_cap_cron_skip','cancelled','unknown',
    ];
    for (const c of cats) expect(new AIError(c, false, 'msg').category).toBe(c);
  });
});
