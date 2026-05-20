import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createTestAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const key = process.env.SUPABASE_SECRET_KEY_ADMIN!;
  if (!key) throw new Error('SUPABASE_SECRET_KEY_ADMIN not set; run `npx supabase status -o env > .env.test.local`');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export const OWNER_UID = '00000000-0000-0000-0000-000000000001';
