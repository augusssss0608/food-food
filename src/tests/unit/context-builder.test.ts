import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: vi.fn() }));
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchAdviceInputData, stripAiRawJson } from '@/lib/ai-provider/context-builder';

describe('stripAiRawJson', () => {
  it('removes reasoning field from ai_raw_json', () => {
    const rows = [
      { id: 1, ai_raw_json: { reasoning: 'AI 推理', confidence: 'high' } },
      { id: 2, ai_raw_json: null },
      { id: 3 },
    ];
    const out = stripAiRawJson(rows);
    expect(out[0]!.ai_raw_json).toEqual({ confidence: 'high' });
    expect(out[1]!.ai_raw_json).toBeNull();
    expect((out[2] as { ai_raw_json?: unknown }).ai_raw_json).toBeUndefined();
  });
});

describe('fetchAdviceInputData', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses mealsRange for meals query and bodyRange for body_metrics query', async () => {
    const mealsRows = [{ id: 1, ai_raw_json: { reasoning: 'r' } }];
    const bodyRows = [{ id: 99 }];
    const mealsQuery = { eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lt: vi.fn().mockResolvedValue({ data: mealsRows }) };
    const bodyQuery  = { eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lt: vi.fn().mockResolvedValue({ data: bodyRows }) };
    const from = vi.fn((t: string) => t === 'meals' ? { select: () => mealsQuery } : { select: () => bodyQuery });
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const r = await fetchAdviceInputData({
      userId: 'uid',
      timezone: 'Asia/Tokyo',
      mealsRange: { startDate: '2026-05-19', endDate: '2026-05-19' },
      bodyMetricsRange: { startDate: '2026-05-13', endDate: '2026-05-19' },
    });

    expect(from).toHaveBeenCalledWith('meals');
    expect(from).toHaveBeenCalledWith('body_metrics');
    expect((r.meals[0] as { ai_raw_json?: Record<string, unknown> }).ai_raw_json).toEqual({});
    expect(r.body_metrics).toEqual(bodyRows);
  });
});
