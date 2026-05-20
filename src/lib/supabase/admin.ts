import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _adminClient: SupabaseClient | null = null;
let _cronClient: SupabaseClient | null = null;

function buildClient(secretKey: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: {} },
    },
  );
}

function assertServerOnly(name: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(`${name} must not be imported on client side`);
  }
}

export function supabaseAdmin(): SupabaseClient {
  assertServerOnly('supabaseAdmin');
  if (!_adminClient) _adminClient = buildClient(process.env.SUPABASE_SECRET_KEY_ADMIN!);
  return _adminClient;
}

export function supabaseCron(): SupabaseClient {
  assertServerOnly('supabaseCron');
  if (!_cronClient) _cronClient = buildClient(process.env.SUPABASE_SECRET_KEY_CRON!);
  return _cronClient;
}
