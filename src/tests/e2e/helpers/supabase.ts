import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const OWNER_UID = '00000000-0000-0000-0000-000000000001';
export const OWNER_EMAIL = 'owner@food-food.local';
export const OWNER_PASSWORD = 'food-food-e2e-test-password-12345';
export const CRON_SECRET = 'food-food-e2e-cron-secret-12345';
export const DEV_SECRET = 'food-food-e2e-dev-secret-12345';

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SECRET_KEY_ADMIN!,
    { auth: { persistSession: false } },
  );
}

export function cronHeaders(): { authorization: string } {
  return { authorization: `Bearer ${process.env.CRON_SECRET ?? CRON_SECRET}` };
}
