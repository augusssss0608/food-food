import type { SupabaseClient } from '@supabase/supabase-js';
import { todayUtcRange } from '@/lib/timezone';
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

type ProfileRow = {
  user_id: string;
  preferred_timezone: string | null;
  kcal_workout_day: number | null;
  kcal_rest_day: number | null;
  protein_g: number | null;
  carb_workout_day: number | null;
  carb_rest_day: number | null;
  fat_g: number | null;
};

/**
 * 拿主頁 snapshot。沒 profile 返 null，呼叫方自行決定 redirect 到 setup。
 * 任何 DB 錯誤直接 throw（不靜默 fallback）。
 */
export async function loadHomeSnapshot(
  supa: SupabaseClient,
  userId: string,
): Promise<HomeSnapshot | null> {
  const { data: profile, error: profileError } = await supa
    .from('profiles')
    .select(
      'user_id, preferred_timezone, kcal_workout_day, kcal_rest_day, protein_g, carb_workout_day, carb_rest_day, fat_g',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const p = profile as ProfileRow;
  const { timezone, startUtc, endExclusiveUtc, localDate } = todayUtcRange(p.preferred_timezone);

  // 並行查 meals + workout_days（無依賴）
  const [mealsResult, workoutResult] = await Promise.all([
    supa
      .from('meals')
      .select('id, ate_at, source, dish_name, kcal, protein_g, carb_g, fat_g, fiber_g, satiety')
      .eq('user_id', userId)
      .gte('ate_at', startUtc)
      .lt('ate_at', endExclusiveUtc)
      .order('ate_at', { ascending: false }),
    supa
      .from('workout_days')
      .select('is_workout')
      .eq('user_id', userId)
      .eq('date', localDate)
      .maybeSingle(),
  ]);
  if (mealsResult.error) throw mealsResult.error;
  if (workoutResult.error) throw workoutResult.error;

  const meals = (mealsResult.data ?? []) as TodayMeal[];
  const workoutRow = workoutResult.data;
  const workoutMarked = workoutRow != null;
  const isWorkoutDay = (workoutRow?.is_workout ?? false) as boolean;

  const workoutTargets: Nutrients = {
    kcal: p.kcal_workout_day ?? 0,
    protein_g: p.protein_g ?? 0,
    carb_g: p.carb_workout_day ?? 0,
    fat_g: p.fat_g ?? 0,
  };
  const restTargets: Nutrients = {
    kcal: p.kcal_rest_day ?? 0,
    protein_g: p.protein_g ?? 0,
    carb_g: p.carb_rest_day ?? 0,
    fat_g: p.fat_g ?? 0,
  };
  const emptyTargets: Nutrients = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };

  const targets: Nutrients = !workoutMarked
    ? emptyTargets
    : isWorkoutDay ? workoutTargets : restTargets;

  return {
    meals,
    timezone,
    todayDate: localDate,
    workoutMarked,
    isWorkoutDay,
    targets,
    targetOptions: {
      workout: workoutTargets,
      rest: restTargets,
      empty: emptyTargets,
    },
  };
}
