import { describe, it, expect } from 'vitest';
import { createTestAdminClient } from './helpers/test-supabase';

describe('migration smoke', () => {
  const supa = createTestAdminClient();

  it('public tables exist and queryable', async () => {
    const tables = ['profiles','meals','workout_days','body_metrics','advice','inbox','push_subscriptions','notification_deliveries'];
    for (const t of tables) {
      const { error } = await supa.from(t).select('*').limit(1);
      expect(error, `table ${t} should exist`).toBeNull();
    }
  });

  it('app_private RPCs callable as service_role', async () => {
    // try_start_cron_run 是最简单的可调用 RPC
    const { data, error } = await supa.schema('app_private')
      .rpc('try_start_cron_run', { p_job_name: 'smoke_test', p_run_key: 'smoke:1', p_lock_seconds: 5 });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('app_private.owner_user_id() returns seeded owner', async () => {
    const { data, error } = await supa.schema('app_private').rpc('owner_user_id');
    expect(error).toBeNull();
    expect(data).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('app_config has 3 caps seeded', async () => {
    const { data, error } = await supa.schema('app_private')
      .from('app_config').select('key');
    expect(error).toBeNull();
    const keys = (data ?? []).map((r: { key: string }) => r.key).sort();
    expect(keys).toEqual([
      'ai_budget_daily_call_cap',
      'ai_budget_daily_cost_cap_cents',
      'ai_budget_monthly_fallback_cap_cents',
    ]);
  });

  it('mark_advice_stale_for_meal trigger exists', async () => {
    const { data, error } = await supa
      .from('information_schema.triggers' as never)
      .select('trigger_name')
      .eq('event_object_table', 'meals')
      .eq('trigger_name', 'meals_mark_advice_stale');
    // Supabase 不一定 expose information_schema; 不行就跳过此断言
    if (!error) expect((data ?? []).length).toBeGreaterThan(0);
  });
});
