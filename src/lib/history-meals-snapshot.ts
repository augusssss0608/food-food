import { cookies } from 'next/headers';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * /history/meals 單日視圖所需 snapshot：當日 meals + 當日 AI advice + tz/today。
 *
 * 走 PostgreSQL RPC load_history_meals(p_local_date, p_tz)，一次拿全部，
 * 從 2 個 HTTP RT 壓到 1 個。RPC 內部會把未來日期 clamp 回今天。
 */
export type HistoryMeal = {
  id: string;
  ate_at: string;
  source: 'preset' | 'photo_ai' | 'manual';
  dish_name: string | null;
  kcal: number | null;
};

export type DailyAdvice = {
  content_md: string;
  generated_at: string | null;
  stale: boolean | null;
};

export type HistoryMealsSnapshot = {
  timezone: string;
  date: string;           // 實際生效的本地日期（clamp 過未來日）
  todayDate: string;      // 本地今天
  meals: HistoryMeal[];
  advice: DailyAdvice | null;
};

const HistoryMealSchema = z.object({
  id: z.string(),
  ate_at: z.string(),
  source: z.enum(['preset', 'photo_ai', 'manual']),
  dish_name: z.string().nullable(),
  kcal: z.number().nullable(),
}).strict();

const DailyAdviceSchema = z.object({
  content_md: z.string(),
  generated_at: z.string().nullable(),
  stale: z.boolean().nullable(),
}).strict();

const HistoryMealsSnapshotSchema = z.object({
  timezone: z.string(),
  date: z.string(),
  todayDate: z.string(),
  meals: z.array(HistoryMealSchema),
  advice: DailyAdviceSchema.nullable(),
}).strict();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function readCookieTz(): Promise<string | null> {
  try {
    return (await cookies()).get('ff_tz')?.value ?? null;
  } catch {
    return null;
  }
}

export async function loadHistoryMealsSnapshot(
  supa: SupabaseClient,
  inputDate: string | null,
): Promise<HistoryMealsSnapshot> {
  const safeDate = inputDate && DATE_RE.test(inputDate) ? inputDate : null;
  const { data, error } = await supa.rpc('load_history_meals', {
    p_local_date: safeDate,
    p_tz: await readCookieTz(),
  });
  if (error) throw error;
  if (data == null) throw new Error('load_history_meals returned null');
  return HistoryMealsSnapshotSchema.parse(data) as HistoryMealsSnapshot;
}
