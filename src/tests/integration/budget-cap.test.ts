import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';

const supa = createTestAdminClient();

beforeEach(async () => {
  await supa.schema('app_private').from('ai_budget_daily').delete().eq('user_id', OWNER_UID);
});

describe('daily budget cap', () => {
  it('rejects the 51st reserve when call_count cap = 50', async () => {
    let last = { ok: true };
    for (let i = 0; i < 51; i++) {
      const { data } = await supa.schema('app_private').rpc('try_reserve_ai_budget',
        { p_user_id: OWNER_UID, p_estimated_cost_cents: 1 });
      last = data as { ok: boolean };
    }
    expect(last.ok).toBe(false);
  });

  it('rejects when cost_cap exceeded (cap_cents=50, single big reserve 60)', async () => {
    const { data } = await supa.schema('app_private').rpc('try_reserve_ai_budget',
      { p_user_id: OWNER_UID, p_estimated_cost_cents: 60 });
    expect((data as { ok: boolean }).ok).toBe(false);
  });

  it('settle delta correctly updates account', async () => {
    // 用独立 user_id 避免 beforeEach 延迟 / connection cache 让前一个 it 的写入污染
    const isolatedUid = `11111111-1111-1111-1111-${Date.now().toString().padStart(12, '0').slice(-12)}`;
    await supa.schema('app_private').rpc('try_reserve_ai_budget',
      { p_user_id: isolatedUid, p_estimated_cost_cents: 8 });
    await supa.schema('app_private').rpc('settle_ai_budget',
      { p_user_id: isolatedUid, p_usage_date: new Date().toISOString().slice(0, 10), p_estimated_cost_cents: 8, p_actual_cost_cents: 3 });
    const { data } = await supa.schema('app_private').from('ai_budget_daily').select('*').eq('user_id', isolatedUid).single();
    expect((data as { estimated_cost_cents: number }).estimated_cost_cents).toBe(3);
    await supa.schema('app_private').from('ai_budget_daily').delete().eq('user_id', isolatedUid);
  });
});
