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

export type UserMealPreset = {
  id: string;
  name: string;
  category: string | null;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  created_at: string;
};

export type RecentPhotoMeal = {
  meal_id: string;
  dish_name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  created_at: string;
};

export type HomeSnapshot = {
  meals: TodayMeal[];
  customPresets: UserMealPreset[];
  recentPhotoMeals: RecentPhotoMeal[];
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

// UserMealPreset 是 UI DTO，未来会继续加字段（icon / color / sort_order...）。
// 用 passthrough 而非 strict：允许 RPC 返回额外字段时旧前端不炸（forward-compat）。
// meals/targets 这类核心契约仍保 strict，错字段早炸更有价值。
const UserMealPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  // category 是后加的字段，旧 RPC 还没返回时按 null 处理
  category: z.string().nullable().optional().transform((v) => v ?? null),
  kcal: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  created_at: z.string(),
}).passthrough();

const RecentPhotoMealSchema = z.object({
  meal_id: z.string(),
  dish_name: z.string(),
  kcal: z.number(),
  protein_g: z.number(),
  carb_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number(),
  created_at: z.string(),
}).strict();

// customPresets / recentPhotoMeals 用 optional().default([])：
// 部署窗口期 frontend 先 deploy，旧 RPC 还没返回新字段时不会 strict parse 失败
const HomeSnapshotSchema = z.object({
  meals: z.array(TodayMealSchema),
  customPresets: z.array(UserMealPresetSchema).optional().default([]),
  recentPhotoMeals: z.array(RecentPhotoMealSchema).optional().default([]),
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
