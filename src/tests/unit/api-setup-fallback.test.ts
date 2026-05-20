import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/auth/csrf', () => ({
  assertSameOrigin: vi.fn(),
  CsrfError: class CsrfError extends Error {},
}));
vi.mock('@/lib/auth/require-allowed-user', () => ({
  requireAllowedUser: vi.fn().mockResolvedValue({ userId: 'uid-test' }),
  AuthError: class AuthError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {},
}));
vi.mock('@/lib/ai-provider/budget', () => ({
  reserveAiBudget: vi.fn().mockResolvedValue({ usageDate: '2026-05-19' }),
  settleAiBudget: vi.fn(),
}));
const upsertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({ from: () => ({ upsert: upsertMock }) }),
}));
vi.mock('@/lib/errors/app-errors', () => ({
  writeAppError: vi.fn(),
}));

const providerMock = { computeInitialTargets: vi.fn() };
vi.mock('@/lib/ai-provider', () => ({
  getAiProvider: () => providerMock,
  AIError: class AIError extends Error {
    category: string;
    constructor(category: string, _retryable: boolean, msg: string) { super(msg); this.category = category; this.name = 'AIError'; }
  },
}));

vi.mock('@/lib/ai-provider/fallback-tdee', () => ({
  fallbackTdee: vi.fn().mockReturnValue({
    kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140,
    carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28,
  }),
}));

import { POST } from '@/app/api/setup/route';
import { fallbackTdee } from '@/lib/ai-provider/fallback-tdee';
import { AIError } from '@/lib/ai-provider';

function buildReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  height_cm: 175, current_weight_kg: 70, birth_date: '1996-05-19',
  sex: 'male', training_days_per_week: 3, preferred_timezone: 'Asia/Tokyo',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/setup AI fallback', () => {
  it('uses AI provider when it returns valid targets', async () => {
    providerMock.computeInitialTargets.mockResolvedValueOnce({
      kcal_workout_day: 2500, kcal_rest_day: 2050, protein_g: 145,
      carb_workout_day: 290, carb_rest_day: 210, fat_g: 65, fiber_g: 30,
      _meta: { provider: 'anthropic_api', durationMs: 100, attempts: 1, costCents: 5 },
    });
    const r = await POST(buildReq(validBody));
    expect(r.status).toBe(200);
    expect(fallbackTdee).not.toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalled();
    const upsertedRow = upsertMock.mock.calls[0]![0];
    expect(upsertedRow.kcal_workout_day).toBe(2500);
    expect(upsertedRow.targets_source).toBe('ai_initial');
  });

  it('falls back to fallbackTdee when provider throws AIError(schema_invalid)', async () => {
    providerMock.computeInitialTargets.mockRejectedValueOnce(
      new AIError('schema_invalid', false, 'bad json'),
    );
    const r = await POST(buildReq(validBody));
    expect(r.status).toBe(200);
    expect(fallbackTdee).toHaveBeenCalledWith(expect.objectContaining({ height_cm: 175 }));
    const upsertedRow = upsertMock.mock.calls[0]![0];
    expect(upsertedRow.kcal_workout_day).toBe(2400);
  });

  it('returns 429 when provider throws AIError(rate_limit)', async () => {
    providerMock.computeInitialTargets.mockRejectedValueOnce(
      new AIError('rate_limit', false, 'budget exhausted'),
    );
    const r = await POST(buildReq(validBody));
    expect([429, 500]).toContain(r.status);
  });
});
