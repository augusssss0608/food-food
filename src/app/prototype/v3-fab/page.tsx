import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadHomeSnapshot } from '@/lib/home-snapshot';
import { FabContent } from './fab-content';

export const dynamic = 'force-dynamic';

export default async function FabPage() {
  const supa = await createSupabaseServerClient();
  const { data, error } = await supa.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  const snapshot = await loadHomeSnapshot(supa, data.claims.sub as string);
  if (!snapshot) redirect('/setup');
  return <FabContent initialSnapshot={snapshot} />;
}
