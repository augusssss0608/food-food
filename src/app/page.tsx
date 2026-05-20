import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { HomeContent } from './home-content';
import { SetupForm } from '@/components/setup-form';

export default async function HomePage() {
  const supa = await createSupabaseServerClient();

  // middleware 已經 fresh getClaims 過了，這裡 getClaims 是從本地 cookie 解 JWT，不發網絡。
  // 比 getUser() 省一次 ~150-400ms 的 /auth/v1/user 往返。
  const { data, error } = await supa.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect('/login');

  // 沒 profile → inline 渲染 setup 表單，不再 server redirect 到 /setup 多走一次請求 + middleware。
  // 用戶填完 submit 後 form 自己 location.href='/' 重新進來，這次 profile 存在會直接顯示 HomeContent。
  const { data: profile } = await supa.from('profiles')
    .select('user_id').eq('user_id', userId).maybeSingle();
  if (!profile) return <SetupForm />;

  return <HomeContent />;
}
