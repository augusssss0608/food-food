import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: vi.fn() }));
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  PRE_ESTIMATES_CENTS,
  reserveAiBudget,
  settleAiBudget,
  tryReserveFallbackMonthlyCap,
  settleFallbackMonthlyCap,
} from '@/lib/ai-provider/budget';
import { AIError } from '@/lib/ai-provider/errors';

const rpc = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ schema: () => ({ rpc }) });
});

describe('PRE_ESTIMATES_CENTS', () => {
  it('has 6 AiCallKind entries', () => {
    const expected = ['meal_photo','body_ocr','initial_targets','daily_advice','weekly_advice','monthly_advice'] as const;
    for (const k of expected) expect(PRE_ESTIMATES_CENTS[k]).toBeGreaterThan(0);
  });
});

describe('reserveAiBudget', () => {
  it('returns usageDate when RPC ok=true', async () => {
    rpc.mockResolvedValue({ data: { ok: true, usage_date: '2026-05-19' }, error: null });
    const r = await reserveAiBudget('uid', 'meal_photo');
    expect(r.usageDate).toBe('2026-05-19');
  });

  it('throws AIError("rate_limit") when ok=false', async () => {
    rpc.mockResolvedValue({ data: { ok: false, usage_date: '2026-05-19' }, error: null });
    await expect(reserveAiBudget('uid', 'meal_photo')).rejects.toThrow(AIError);
  });
});

describe('settleAiBudget', () => {
  it('calls RPC with delta', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await settleAiBudget('uid', 'meal_photo', '2026-05-19', 3);
    expect(rpc).toHaveBeenCalledWith('settle_ai_budget', expect.objectContaining({
      p_user_id: 'uid',
      p_usage_date: '2026-05-19',
      p_estimated_cost_cents: PRE_ESTIMATES_CENTS.meal_photo,
      p_actual_cost_cents: 3,
    }));
  });
});

describe('tryReserveFallbackMonthlyCap', () => {
  it('returns ok + usageMonth from RPC', async () => {
    rpc.mockResolvedValue({ data: { ok: true, usage_month: '2026-05-01' }, error: null });
    const r = await tryReserveFallbackMonthlyCap('uid', 'weekly_advice');
    expect(r.ok).toBe(true);
    expect(r.usageMonth).toBe('2026-05-01');
  });
});

describe('settleFallbackMonthlyCap', () => {
  it('calls RPC with usageMonth', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await settleFallbackMonthlyCap('uid', 'weekly_advice', '2026-05-01', 5);
    expect(rpc).toHaveBeenCalledWith('settle_fallback_monthly_cap', expect.objectContaining({
      p_user_id: 'uid', p_usage_month: '2026-05-01',
    }));
  });
});
