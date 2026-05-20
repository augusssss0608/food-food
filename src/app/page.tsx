import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HomeContent } from './home-content';

export default async function HomePage() {
  const supa = await createSupabaseServerClient();
  // middleware 已经挡过未登录，这里 fresh fetch 拿 user 用于查 profile
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login');

  // profile 不存在 → 引导到 /setup 填表（首次使用流程）
  const { data: profile } = await supa.from('profiles')
    .select('user_id').eq('user_id', user.id).maybeSingle();
  if (!profile) redirect('/setup');

  return <HomeContent />;
}
