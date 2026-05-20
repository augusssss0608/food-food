import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { todayUtcRange } from '@/lib/timezone';
import { HomeContent } from './home-content';
import { SetupForm } from '@/components/setup-form';
import type { TodayMeal } from '@/components/today-meals';

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

export default async function HomePage() {
  const supa = await createSupabaseServerClient();

  const { data, error } = await supa.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect('/login');

  const { data: profile, error: profileError } = await supa
    .from('profiles')
    .select(
      'user_id, preferred_timezone, kcal_workout_day, kcal_rest_day, protein_g, carb_workout_day, carb_rest_day, fat_g',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return <SetupForm />;

  const p = profile as ProfileRow;
  const { timezone, startUtc, endExclusiveUtc, localDate } = todayUtcRange(p.preferred_timezone);

  // 今日 meals：[今天 00:00, 明天 00:00)，order by 時間倒序
  // 不加 limit：consumed 摘要是直接從這個 array 聚合，limit 會截掉第 21 筆以後造成
  // 今日營養總和錯誤（codex review 找到的 ship blocker）。
  // 今日 meal 數量正常 < 10，不擔心 query 開銷。
  const { data: mealsData, error: mealsError } = await supa
    .from('meals')
    .select('id, ate_at, source, dish_name, kcal, protein_g, carb_g, fat_g, fiber_g, satiety')
    .eq('user_id', userId)
    .gte('ate_at', startUtc)
    .lt('ate_at', endExclusiveUtc)
    .order('ate_at', { ascending: false });
  if (mealsError) throw mealsError;
  const meals = (mealsData ?? []) as TodayMeal[];

  // 今日 workout_days：error 顯式 throw，不再靜默 fallback；
  // 沒記錄默認 false（休息日），跟 /api/advice/daily 同口徑；UI 顯示「未標記」小字
  const { data: workoutRow, error: workoutError } = await supa
    .from('workout_days')
    .select('is_workout')
    .eq('user_id', userId)
    .eq('date', localDate)
    .maybeSingle();
  if (workoutError) throw workoutError;
  const workoutMarked = workoutRow != null;
  const isWorkoutDay = (workoutRow?.is_workout ?? false) as boolean;

  return (
    <HomeContent
      meals={meals}
      timezone={timezone}
      isWorkoutDay={isWorkoutDay}
      workoutMarked={workoutMarked}
      targets={{
        kcal: isWorkoutDay ? (p.kcal_workout_day ?? 0) : (p.kcal_rest_day ?? 0),
        protein_g: p.protein_g ?? 0,
        carb_g: isWorkoutDay ? (p.carb_workout_day ?? 0) : (p.carb_rest_day ?? 0),
        fat_g: p.fat_g ?? 0,
      }}
    />
  );
}
