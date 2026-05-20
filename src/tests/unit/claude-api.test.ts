import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create };
    constructor(_opts: { apiKey: string }) {}
  },
}));

vi.mock('@/lib/ai-provider/ai-calls', () => ({
  startAiCall: vi.fn().mockResolvedValue('call-1'),
  finishAiCall: vi.fn(),
}));

vi.mock('@/lib/ai-provider/budget', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai-provider/budget')>('@/lib/ai-provider/budget');
  return {
    ...actual,
    settleAiBudget: vi.fn(),
  };
});

import { ClaudeApiProvider } from '@/lib/ai-provider/claude-api';
import { settleAiBudget } from '@/lib/ai-provider/budget';
import { AIError } from '@/lib/ai-provider/errors';

const ctx = {
  userId: 'uid', trigger: 'user' as const, correlationId: 'cid',
  kind: 'meal_photo' as const, usageDate: '2026-05-19',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ClaudeApiProvider.estimateMealFromImage', () => {
  it('returns parsed result with _meta on success', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        dish_name: '牛肉饭', kcal: 500, protein_g: 30, carb_g: 60, fat_g: 15, fiber_g: 5, confidence: 'medium',
      }) }],
      usage: { input_tokens: 1000, output_tokens: 200 },
    });
    const p = new ClaudeApiProvider({ apiKey: 'test' });
    const r = await p.estimateMealFromImage({ imageBase64: 'base64data' }, ctx);
    expect(r.dish_name).toBe('牛肉饭');
    expect(r._meta.provider).toBe('anthropic_api');
    expect(r._meta.attempts).toBe(1);
    expect(r._meta.costCents).toBeGreaterThan(0);
    expect(settleAiBudget).toHaveBeenCalledWith('uid', 'meal_photo', '2026-05-19', expect.any(Number));
  });

  it('throws schema_invalid when JSON malformed (after retry)', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '{ invalid json' }],
      usage: { input_tokens: 100, output_tokens: 10 },
    });
    const p = new ClaudeApiProvider({ apiKey: 'test' });
    let caught: unknown;
    try {
      await p.estimateMealFromImage({ imageBase64: 'b' }, ctx);
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(AIError);
    expect((caught as AIError).category).toBe('schema_invalid');
    expect(settleAiBudget).toHaveBeenCalledWith('uid', 'meal_photo', '2026-05-19', 0);
  });

  it('throws sanity violation as schema_invalid', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        dish_name: '巨型套餐', kcal: 99999, protein_g: 30, carb_g: 60, fat_g: 15, fiber_g: 5, confidence: 'high',
      }) }],
      usage: { input_tokens: 100, output_tokens: 10 },
    });
    const p = new ClaudeApiProvider({ apiKey: 'test' });
    let caught: unknown;
    try {
      await p.estimateMealFromImage({ imageBase64: 'b' }, ctx);
    } catch (e) { caught = e; }
    expect((caught as AIError).category).toBe('schema_invalid');
  });
});

describe('ClaudeApiProvider.providerName', () => {
  it('is anthropic_api', () => {
    expect(new ClaudeApiProvider({ apiKey: 'k' }).providerName).toBe('anthropic_api');
  });
});

describe('ClaudeApiProvider.generateDailyAdvice', () => {
  const advCtx = { ...ctx, kind: 'daily_advice' as const };

  it('returns content_md with attempts on success', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '总评：今日训练日…\n建议：…' }],
      usage: { input_tokens: 500, output_tokens: 200 },
    });
    const p = new ClaudeApiProvider({ apiKey: 'test' });
    const r = await p.generateDailyAdvice({
      date: '2026-05-19', is_workout: true,
      targets: { kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140, carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28 },
      meals: [], body_metrics: [], prior_advice: [],
    }, advCtx);
    expect(r.content_md).toContain('总评');
    expect(r._meta.attempts).toBe(1);
    expect(r._meta.provider).toBe('anthropic_api');
  });

  it('treats empty markdown as schema_invalid (z.string().min(1) catches)', async () => {
    create.mockResolvedValue({
      content: [{ type: 'text', text: '' }],
      usage: { input_tokens: 100, output_tokens: 0 },
    });
    const p = new ClaudeApiProvider({ apiKey: 'test' });
    let caught: unknown;
    try {
      await p.generateDailyAdvice({
        date: '2026-05-19', is_workout: false,
        targets: { kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140, carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28 },
        meals: [], body_metrics: [], prior_advice: [],
      }, advCtx);
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(AIError);
    expect((caught as AIError).category).toBe('schema_invalid');
  });
});
