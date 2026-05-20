import { SetupForm, type SetupInitial } from '@/components/setup-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// 從 drawer 的「個人資料」進入，目的是讓用戶編輯既有 profile。
// 必須先撈現有 profile 注入為 initial，否則 SetupForm 用硬編碼默認值提交會覆蓋真實資料。
export default async function SetupPage() {
  const supa = await createSupabaseServerClient();
  const { data: claimsData } = await supa.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  // middleware 已擋未登入，這條分支理論不會走到；保守 fallback：直接以 defaults 渲染
  if (!userId) return <SetupForm />;

  const { data: profile, error } = await supa.from('profiles')
    .select('height_cm, current_weight_kg, birth_date, sex, training_days_per_week, preferred_timezone')
    .eq('user_id', userId)
    .maybeSingle();
  // transient DB/RLS error 必須拋出，不能默默掉到默認值（會覆蓋現有 profile）
  if (error) throw error;

  return <SetupForm initial={(profile ?? undefined) as SetupInitial | undefined} />;
}
