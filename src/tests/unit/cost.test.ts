import { describe, it, expect } from 'vitest';
import { estimateCostCents } from '@/lib/ai-provider/cost';

describe('estimateCostCents', () => {
  it('Sonnet 4.6: 1000 input + 500 output ≈ 1 cent', () => {
    const c = estimateCostCents('claude-sonnet-4-6', { input_tokens: 1000, output_tokens: 500 });
    expect(c).toBe(1);
  });

  it('Opus 4.7: 10000 input + 2000 output', () => {
    const c = estimateCostCents('claude-opus-4-7', { input_tokens: 10000, output_tokens: 2000 });
    expect(c).toBe(30);
  });

  it('unknown model defaults to Sonnet pricing', () => {
    const c = estimateCostCents('unknown-model', { input_tokens: 1000, output_tokens: 500 });
    expect(c).toBeGreaterThan(0);
  });

  it('missing usage returns 0', () => {
    expect(estimateCostCents('claude-sonnet-4-6', undefined)).toBe(0);
  });
});
