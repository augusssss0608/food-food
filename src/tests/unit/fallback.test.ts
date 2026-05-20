import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai-provider/budget', () => ({
  reserveAiBudget: vi.fn(),
  tryReserveFallbackMonthlyCap: vi.fn(),
  settleFallbackMonthlyCap: vi.fn(),
}));
vi.mock('@/lib/errors/app-errors', () => ({ writeAppError: vi.fn() }));

import { MockAiProvider } from '@/lib/ai-provider/mock';
import { withFallback } from '@/lib/ai-provider/fallback';
import { AIError } from '@/lib/ai-provider/errors';
import { reserveAiBudget, tryReserveFallbackMonthlyCap, settleFallbackMonthlyCap } from '@/lib/ai-provider/budget';
import { writeAppError } from '@/lib/errors/app-errors';

const ctx = (override: Partial<{ trigger: 'user' | 'cron'; kind: 'meal_photo' | 'weekly_advice' }> = {}) => ({
  userId: 'uid', trigger: (override.trigger ?? 'user') as 'user' | 'cron', correlationId: 'cid',
  kind: (override.kind ?? 'meal_photo') as 'meal_photo' | 'weekly_advice',
  usageDate: '2026-05-19',
});

beforeEach(() => vi.clearAllMocks());

describe('withFallback', () => {
  it('returns primary result when primary succeeds (no fallback path)', async () => {
    const primary = new MockAiProvider();
    const fallback = new MockAiProvider();
    const p = withFallback(primary, fallback);
    const r = await p.estimateMealFromImage({ imageBase64: 'b' }, ctx());
    expect(r._meta.provider).toBe('mock');
    expect(r._meta.fallbackFrom).toBeUndefined();
    expect(fallback.calls.estimateMealFromImage).toBe(0);
    expect(writeAppError).not.toHaveBeenCalled();
  });

  it('catches primary transport AIError, writes app_errors, reserves new daily budget, calls fallback', async () => {
    const primary = new MockAiProvider();
    primary.setNextBehavior('estimateMealFromImage', { kind: 'throw', category: 'transport' });
    const fallback = new MockAiProvider();
    (reserveAiBudget as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ usageDate: '2026-05-19' });
    const p = withFallback(primary, fallback);
    const r = await p.estimateMealFromImage({ imageBase64: 'b' }, ctx());
    expect(writeAppError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'provider_fallback' }));
    expect(reserveAiBudget).toHaveBeenCalledWith('uid', 'meal_photo');
    expect(fallback.calls.estimateMealFromImage).toBe(1);
    expect(r._meta.fallbackFrom).toBe('mock');
  });

  it('writes oauth_token_expired kind when primaryErr.category=auth_oauth', async () => {
    const primary = new MockAiProvider();
    primary.setNextBehavior('estimateMealFromImage', { kind: 'throw', category: 'auth_oauth' });
    const fallback = new MockAiProvider();
    (reserveAiBudget as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ usageDate: '2026-05-19' });
    const p = withFallback(primary, fallback);
    await p.estimateMealFromImage({ imageBase64: 'b' }, ctx());
    expect(writeAppError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'oauth_token_expired' }));
  });

  it('cron path checks monthly cap and throws fallback_cap_cron_skip if cap exhausted', async () => {
    const primary = new MockAiProvider();
    primary.setNextBehavior('generateWeeklyAdvice', { kind: 'throw', category: 'transport' });
    const fallback = new MockAiProvider();
    (tryReserveFallbackMonthlyCap as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, usageMonth: '2026-05-01' });
    const p = withFallback(primary, fallback);
    let caught: unknown;
    try {
      await p.generateWeeklyAdvice({
        period_start: '2026-05-18', period_end: '2026-05-24',
        meals: [], body_metrics: [], workout_days: [],
        targets: { kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140, carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28 },
      }, ctx({ trigger: 'cron', kind: 'weekly_advice' }));
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(AIError);
    expect((caught as AIError).category).toBe('fallback_cap_cron_skip');
    expect(fallback.calls.generateWeeklyAdvice).toBe(0);
  });

  it('daily reserve fails after monthly cap reserve success → settle monthly back + attach cause', async () => {
    const primary = new MockAiProvider();
    primary.setNextBehavior('generateWeeklyAdvice', { kind: 'throw', category: 'transport' });
    const fallback = new MockAiProvider();
    (tryReserveFallbackMonthlyCap as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, usageMonth: '2026-05-01' });
    (reserveAiBudget as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new AIError('rate_limit', false, 'budget full'));
    const p = withFallback(primary, fallback);
    let caught: AIError | undefined;
    try {
      await p.generateWeeklyAdvice({
        period_start: '2026-05-18', period_end: '2026-05-24',
        meals: [], body_metrics: [], workout_days: [],
        targets: { kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140, carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28 },
      }, ctx({ trigger: 'cron', kind: 'weekly_advice' }));
    } catch (e) { caught = e as AIError; }
    expect(caught?.category).toBe('rate_limit');
    expect(caught?.cause).toBeInstanceOf(AIError);
    expect((caught?.cause as AIError).category).toBe('transport');
    expect(settleFallbackMonthlyCap).toHaveBeenCalledWith('uid', 'weekly_advice', '2026-05-01', 0);
  });

  it('fallback also fails → throws fallback error with cause=primary, settle monthly with cost=0 (cron)', async () => {
    const primary = new MockAiProvider();
    primary.setNextBehavior('generateWeeklyAdvice', { kind: 'throw', category: 'transport' });
    const fallback = new MockAiProvider();
    fallback.setNextBehavior('generateWeeklyAdvice', { kind: 'throw', category: 'transport' });
    (tryReserveFallbackMonthlyCap as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, usageMonth: '2026-05-01' });
    (reserveAiBudget as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ usageDate: '2026-05-19' });
    const p = withFallback(primary, fallback);
    let caught: AIError | undefined;
    try {
      await p.generateWeeklyAdvice({
        period_start: '2026-05-18', period_end: '2026-05-24',
        meals: [], body_metrics: [], workout_days: [],
        targets: { kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140, carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28 },
      }, ctx({ trigger: 'cron', kind: 'weekly_advice' }));
    } catch (e) { caught = e as AIError; }
    expect(caught?.category).toBe('transport');
    expect((caught?.cause as AIError).category).toBe('transport');
    expect(settleFallbackMonthlyCap).toHaveBeenCalledWith('uid', 'weekly_advice', '2026-05-01', 0);
  });
});
