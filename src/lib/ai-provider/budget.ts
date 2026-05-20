import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AiCallKind } from './interface';
import { AIError } from './errors';

export const PRE_ESTIMATES_CENTS: Record<AiCallKind, number> = {
  meal_photo: 2,
  body_ocr: 2,
  initial_targets: 3,
  daily_advice: 3,
  weekly_advice: 8,
  monthly_advice: 20,
};

export async function reserveAiBudget(userId: string, kind: AiCallKind): Promise<{ usageDate: string }> {
  const preEstimate = PRE_ESTIMATES_CENTS[kind];
  const { data, error } = await supabaseAdmin()
    .schema('app_private')
    .rpc('try_reserve_ai_budget', { p_user_id: userId, p_estimated_cost_cents: preEstimate });
  if (error) throw error;
  const row = data as { ok: boolean; usage_date: string } | null;
  if (!row?.ok) throw new AIError('rate_limit', false, '今日 AI 预算已用完');
  return { usageDate: row.usage_date };
}

export async function settleAiBudget(
  userId: string, kind: AiCallKind, usageDate: string, actualCents: number,
): Promise<void> {
  await supabaseAdmin().schema('app_private').rpc('settle_ai_budget', {
    p_user_id: userId,
    p_usage_date: usageDate,
    p_estimated_cost_cents: PRE_ESTIMATES_CENTS[kind],
    p_actual_cost_cents: actualCents,
  });
}

export async function tryReserveFallbackMonthlyCap(
  userId: string, kind: AiCallKind,
): Promise<{ ok: boolean; usageMonth: string }> {
  const preEstimate = PRE_ESTIMATES_CENTS[kind];
  const { data, error } = await supabaseAdmin()
    .schema('app_private')
    .rpc('try_reserve_fallback_monthly_cap', { p_user_id: userId, p_estimated_cost_cents: preEstimate });
  if (error) throw error;
  const row = data as { ok: boolean; usage_month: string };
  return { ok: row.ok, usageMonth: row.usage_month };
}

export async function settleFallbackMonthlyCap(
  userId: string, kind: AiCallKind, usageMonth: string, actualCents: number,
): Promise<void> {
  await supabaseAdmin().schema('app_private').rpc('settle_fallback_monthly_cap', {
    p_user_id: userId,
    p_usage_month: usageMonth,
    p_estimated_cost_cents: PRE_ESTIMATES_CENTS[kind],
    p_actual_cost_cents: actualCents,
  });
}
