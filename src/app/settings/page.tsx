import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SettingsForm, type SettingsInitial } from '@/components/settings-form';

// drawer 「修改目標」進入。server 先撈 profile 注入為 initial，
// client 不再做 useEffect fetch → 不再有 skeleton loading 階段。
export default async function SettingsPage() {
  const supa = await createSupabaseServerClient();
  const { data: claimsData } = await supa.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: profile, error } = await supa
    .from('profiles')
    .select(
      'user_id, kcal_workout_day, kcal_rest_day, protein_g, carb_workout_day, carb_rest_day, fat_g, fiber_g',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  // 沒 profile 不渲染空表單；交給 / 的 gate 統一處理（inline render SetupForm）
  if (!profile) redirect('/');

  return <SettingsForm initial={profile as SettingsInitial} />;
}
