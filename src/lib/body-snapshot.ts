import type { SupabaseClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { todayUtcRange } from '@/lib/timezone';

/**
 * /history/body 所需的 90 天 body_metrics snapshot。
 *
 * 被 history/body/page.tsx（RSC 初次渲染）和 /api/body/snapshot（SWR client revalidate）
 * 共用，保證兩條路徑同口徑。
 */
export type BodyRow = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  skeletal_muscle_pct: number | null;
  visceral_fat: number | null;
  bmi: number | null;
};

export type BodySnapshot = {
  rows: BodyRow[];
  timezone: string;
  /** 90 天窗口起點（UTC ISO），client 端 patch 時用同一邊界判斷新 row 是否該插入 */
  windowStartUtc: string;
};

export async function loadBodySnapshot(
  supa: SupabaseClient,
  userId: string,
): Promise<BodySnapshot> {
  const { data: profile, error: profileError } = await supa
    .from('profiles')
    .select('preferred_timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  const tz = (profile?.preferred_timezone ?? null) as string | null;
  const { timezone } = todayUtcRange(tz);

  const ninetyDaysAgoUtc = DateTime.now()
    .setZone(timezone)
    .minus({ days: 90 })
    .startOf('day')
    .toUTC()
    .toISO()!;

  const { data, error } = await supa
    .from('body_metrics')
    .select('measured_at, weight_kg, body_fat_pct, skeletal_muscle_pct, visceral_fat, bmi')
    .eq('user_id', userId)
    .gte('measured_at', ninetyDaysAgoUtc)
    .order('measured_at', { ascending: true });
  if (error) throw error;

  return {
    rows: (data ?? []) as BodyRow[],
    timezone,
    windowStartUtc: ninetyDaysAgoUtc,
  };
}
