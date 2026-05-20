import { supabaseAdmin } from '@/lib/supabase/admin';
import { periodUtcRange } from '@/lib/time/period';

type DateRange = { startDate: string; endDate: string };

export type FetchAdviceInput = {
  userId: string;
  timezone: string;
  mealsRange: DateRange;
  bodyMetricsRange: DateRange;
};

export function stripAiRawJson<T extends { ai_raw_json?: unknown }>(rows: T[]): T[] {
  return rows.map((r) => {
    if (!r.ai_raw_json) return r;
    const raw = r.ai_raw_json as Record<string, unknown>;
    const { reasoning: _reasoning, ...rest } = raw;
    return { ...r, ai_raw_json: rest };
  });
}

export async function fetchAdviceInputData(input: FetchAdviceInput) {
  const { userId, timezone, mealsRange, bodyMetricsRange } = input;
  const mealsRangeUtc = periodUtcRange(mealsRange.startDate, mealsRange.endDate, timezone);
  const bodyRangeUtc = periodUtcRange(bodyMetricsRange.startDate, bodyMetricsRange.endDate, timezone);

  const [mealsRes, bodyRes] = await Promise.all([
    supabaseAdmin().from('meals').select('*')
      .eq('user_id', userId)
      .gte('ate_at', mealsRangeUtc.startUtc).lt('ate_at', mealsRangeUtc.endExclusiveUtc),
    supabaseAdmin().from('body_metrics').select('*')
      .eq('user_id', userId)
      .gte('measured_at', bodyRangeUtc.startUtc).lt('measured_at', bodyRangeUtc.endExclusiveUtc),
  ]);

  // DB 查询失败必须抛，避免上下文缺失的 advice 生成（看似成功的脏 advice 比错误更危险）
  if (mealsRes.error) throw new Error(`fetchAdviceInputData: meals query failed: ${mealsRes.error.message}`);
  if (bodyRes.error) throw new Error(`fetchAdviceInputData: body_metrics query failed: ${bodyRes.error.message}`);

  return {
    meals: stripAiRawJson((mealsRes.data as { ai_raw_json?: unknown }[] | null) ?? []),
    body_metrics: stripAiRawJson((bodyRes.data as { ai_raw_json?: unknown }[] | null) ?? []),
  };
}
