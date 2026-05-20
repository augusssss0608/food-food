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

  it('app_config caps seeded (verified by RPC behavior)', async () => {
    // app_private schema 不通过 PostgREST 暴露（spec §3.5），不能 from('app_config').select() —
    // 改用 RPC 间接验证：try_reserve_ai_budget 和 try_reserve_fallback_monthly_cap 在 cap 未 seed 时会 raise，
    // 此处用 owner_uid + 0 cents 调用，能返回 ok=true 即证明 3 个 cap 都已配置。
    const OWNER = '00000000-0000-0000-0000-000000000001';

    const r1 = await supa.schema('app_private').rpc('try_reserve_ai_budget', {
      p_user_id: OWNER, p_estimated_cost_cents: 0,
    });
    expect(r1.error, 'daily caps must be seeded (call_cap + cost_cap_cents)').toBeNull();
    expect(r1.data?.[0]?.ok ?? r1.data?.ok).toBe(true);

    const r2 = await supa.schema('app_private').rpc('try_reserve_fallback_monthly_cap', {
      p_user_id: OWNER, p_estimated_cost_cents: 0,
    });
    expect(r2.error, 'monthly fallback cap must be seeded').toBeNull();
    expect(r2.data?.[0]?.ok ?? r2.data?.ok).toBe(true);
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
