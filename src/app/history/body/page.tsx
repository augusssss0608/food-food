import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadBodySnapshot } from '@/lib/body-snapshot';
import { BodyHistoryContent } from './body-history-content';

export const dynamic = 'force-dynamic';

export default async function HistoryBodyPage() {
  const supa = await createSupabaseServerClient();
  const { data: claims, error: claimsError } = await supa.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect('/login');
  const userId = claims.claims.sub as string;

  const snapshot = await loadBodySnapshot(supa, userId);
  return <BodyHistoryContent initialSnapshot={snapshot} />;
}
