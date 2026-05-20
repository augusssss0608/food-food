import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HomeContent } from './home-content';
import { SetupForm } from '@/components/setup-form';

export default async function HomePage() {
  const supa = await createSupabaseServerClient();

  // middleware 已 fresh getClaims 過，這裡 getClaims 通常從本地 cookie 解 JWT，
  // token 接近過期才會 refresh，比 getUser() 通常省一次 /auth/v1/user 網絡往返。
  const { data, error } = await supa.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect('/login');

  // 不能把 transient DB/RLS error 吞掉誤判為「沒 profile」——
  // 否則 SetupForm 會用默認值覆蓋已有真實 profile（codex review #1dd967f 發現的風險）
  const { data: profile, error: profileError } = await supa.from('profiles')
    .select('user_id').eq('user_id', userId).maybeSingle();
  if (profileError) throw profileError;

  // 沒 profile → inline 渲染 setup 表單，省一次 server redirect 到 /setup 的請求 + middleware 重跑
  if (!profile) return <SetupForm />;

  return <HomeContent />;
}
