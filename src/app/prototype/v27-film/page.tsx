import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadHomeSnapshot } from '@/lib/home-snapshot';
import { FilmContent } from './film-content';

export const dynamic = 'force-dynamic';

export default async function FilmPage() {
  const supa = await createSupabaseServerClient();
  const { data, error } = await supa.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  const snapshot = await loadHomeSnapshot(supa, data.claims.sub as string);
  if (!snapshot) redirect('/setup');
  return <FilmContent initialSnapshot={snapshot} />;
}
