import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
const anon = createClient(SUPABASE_URL, ANON_KEY);

describe('app_private schema isolation (anon)', () => {
  it.each([
    'ai_calls','ai_budget_daily','ai_budget_monthly_fallback',
    'app_owner','app_config','app_errors','cron_runs',
  ])('anon cannot select from app_private.%s', async (table) => {
    const { error } = await anon.schema('app_private').from(table).select('*');
    expect(error).toBeTruthy(); // permission denied
  });

  it.each([
    'try_reserve_ai_budget',
    'settle_ai_budget',
    'try_reserve_fallback_monthly_cap',
    'settle_fallback_monthly_cap',
    'try_start_cron_run',
    'finish_cron_run',
  ])('anon cannot call %s RPC', async (fn) => {
    const { error } = await anon.schema('app_private').rpc(fn as never, {} as never);
    expect(error?.message ?? '').toMatch(/permission denied|function .* does not exist|Could not find/i);
  });

  it('anon CANNOT call app_private.owner_user_id() (only granted to authenticated + service_role)', async () => {
    const { error } = await anon.schema('app_private').rpc('owner_user_id');
    expect(error?.message ?? '').toMatch(/permission denied|function .* does not exist|Could not find/i);
  });
});
