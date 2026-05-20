import { describe, it, expect } from 'vitest';
import { MockAiProvider } from '@/lib/ai-provider/mock';
import { AIError } from '@/lib/ai-provider/errors';

const ctx = {
  userId: 'uid', trigger: 'user' as const, correlationId: 'cid',
  kind: 'meal_photo' as const, usageDate: '2026-05-19',
};

describe('MockAiProvider', () => {
  it('returns fixture with _meta provider=mock by default', async () => {
    const p = new MockAiProvider();
    const r = await p.estimateMealFromImage({ imageBase64: 'b' }, ctx);
    expect(r._meta.provider).toBe('mock');
    expect(r._meta.attempts).toBe(1);
    expect(p.calls.estimateMealFromImage).toBe(1);
  });

  it('setNextBehavior(method, throw) causes AIError on next call to that method only', async () => {
    const p = new MockAiProvider();
    p.setNextBehavior('estimateMealFromImage', { kind: 'throw', category: 'transport' });
    await expect(p.estimateMealFromImage({ imageBase64: 'b' }, ctx)).rejects.toThrow(AIError);
    const r = await p.extractBodyMetrics({ imageBase64: 'b' }, ctx);
    expect(r._meta.provider).toBe('mock');
  });

  it('does not write ai_calls by default (no startAiCall/finishAiCall calls)', () => {
    const p = new MockAiProvider();
    expect(p.calls.estimateMealFromImage).toBe(0);
  });
});
