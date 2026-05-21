import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadHomeSnapshot } from '@/lib/home-snapshot';
import { HomeContent } from './home-content';
import { SetupForm } from '@/components/setup-form';

// 強制每請求重新渲染：主頁讀的是「當下狀態」型數據，不能讓 Vercel edge / RSC payload 緩存。
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supa = await createSupabaseServerClient();

  const { data, error } = await supa.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect('/login');

  const snapshot = await loadHomeSnapshot(supa, userId);
  if (!snapshot) return <SetupForm />;

  return <HomeContent initialSnapshot={snapshot} />;
}
