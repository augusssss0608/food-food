import { cookies } from 'next/headers';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TodayMeal } from '@/components/today-meals';

/**
 * 主頁所需的「當下狀態 snapshot」。
 *
 * 被 page.tsx（RSC 初次渲染）和 /api/home/today（SWR client revalidate）共用，
 * 保證兩條路徑同口徑。
 *
 * 客戶端可由 targetOptions 在切訓練/休息日時本地立即算出新 targets，不必再請求服務器。
 */
export type Nutrients = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

export type HomeSnapshot = {
  meals: TodayMeal[];
  timezone: string;
  todayDate: string;          // local date YYYY-MM-DD
  workoutMarked: boolean;
  isWorkoutDay: boolean;
  targets: Nutrients;          // 當前生效目標（未標記時 0）
  targetOptions: {
    workout: Nutrients;
    rest: Nutrients;
    empty: Nutrients;          // 未標記時用，恆 0
  };
};

const NutrientsSchema = z.object({
  kcal: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
}).strict();

const TodayMealSchema = z.object({
  id: z.string(),
  ate_at: z.string(),
  source: z.enum(['preset', 'photo_ai', 'manual']),
  dish_name: z.string().nullable(),
  kcal: z.number().nullable(),
  protein_g: z.number().nullable(),
  carb_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  satiety: z.number().nullable(),
}).strict();

const HomeSnapshotSchema = z.object({
  meals: z.array(TodayMealSchema),
  timezone: z.string(),
  todayDate: z.string(),
  workoutMarked: z.boolean(),
  isWorkoutDay: z.boolean(),
  targets: NutrientsSchema,
  targetOptions: z.object({
    workout: NutrientsSchema,
    rest: NutrientsSchema,
    empty: NutrientsSchema,
  }).strict(),
}).strict();

async function readCookieTz(): Promise<string | null> {
  try {
    return (await cookies()).get('ff_tz')?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * 拿主頁 snapshot。沒 profile 返 null，呼叫方自行決定 redirect 到 setup。
 * 任何 DB / shape 錯誤直接 throw（不靜默 fallback）。
 *
 * 走 PostgreSQL RPC load_home_snapshot，一次拿 profile + meals + workout_days，
 * 從 2 個 HTTP RT 壓到 1 個。
 */
export async function loadHomeSnapshot(
  supa: SupabaseClient,
  _userId: string,
): Promise<HomeSnapshot | null> {
  const { data, error } = await supa.rpc('load_home_snapshot', {
    p_tz: await readCookieTz(),
  });
  if (error) throw error;
  if (data == null) return null;
  return HomeSnapshotSchema.parse(data) as HomeSnapshot;
}
