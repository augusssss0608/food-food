import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

// 测试侧未生成 Database 类型，rpc(name, args) 在未键入 schema 下推断 args=undefined。
// 用 helper 强制 cast，集中处理而不是每处加 as never。
type RpcArgs = Record<string, unknown>;
async function rpc(client: SupabaseClient, name: string, args: RpcArgs) {
  const c = client as unknown as { rpc: (n: string, a: RpcArgs) => Promise<{ data: unknown; error: unknown }> };
  return c.rpc(name, args);
}
function asObj(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;

/**
 * Snapshot RPC integration smoke：
 * - 验 RPC 在 owner JWT 下返回正确 jsonb shape（与 zod schema 对齐）
 * - 验 anon 调用拿不到业务数据（grant/revoke + RLS 双层）
 * - 不重复测 RLS 矩阵（rls.test.ts 已覆盖）
 */
describe('snapshot RPCs', () => {
  const admin = createTestAdminClient();
  const anon = createClient(SUPABASE_URL, ANON_KEY);

  const stamp = Date.now();
  const TEST_OWNER_EMAIL = `snapshot-rpc-owner-${stamp}@food-food.local`;
  const PW = 'snapshot-rpc-pw-12345';

  let ownerId: string;
  let ownerClient: ReturnType<typeof createClient>;

  async function ensureUser(email: string): Promise<{ id: string }> {
    const r = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    if (r.data.user) return r.data.user;
    for (let page = 1; page <= 10; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      const found = list.users.find((u) => u.email === email);
      if (found) {
        await admin.auth.admin.updateUserById(found.id, { password: PW });
        return found;
      }
      if (list.users.length < 100) break;
    }
    throw new Error(`ensureUser('${email}') 失败`);
  }

  beforeAll(async () => {
    ownerId = (await ensureUser(TEST_OWNER_EMAIL)).id;

    // 切到测试 owner（双层 RLS 需要 app_owner = ownerId）
    await admin.schema('app_private').from('app_owner').upsert({
      id: true, owner_user_id: ownerId,
    }, { onConflict: 'id' });

    // owner 的 profile（snapshot RPC 主页需要 profile 存在才返回非 null）
    await admin.from('profiles').upsert({
      user_id: ownerId,
      preferred_timezone: 'Asia/Tokyo',
      kcal_workout_day: 2500,
      kcal_rest_day: 2050,
      protein_g: 145,
      carb_workout_day: 290,
      carb_rest_day: 210,
      fat_g: 65,
      fiber_g: 30,
      height_cm: 175,
      current_weight_kg: 70,
      birth_date: '1996-05-19',
      sex: 'male',
      training_days_per_week: 3,
      targets_source: 'ai_initial',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // 简单插一笔 meal（今日 UTC），让 home/history snapshot 至少返回 1 行
    await admin.from('meals').delete().eq('user_id', ownerId);
    await admin.from('meals').insert({
      user_id: ownerId,
      ate_at: new Date().toISOString(),
      source: 'manual',
      dish_name: 'snapshot smoke meal',
      kcal: 500,
      client_mutation_id: crypto.randomUUID(),
    });

    // owner JWT
    const signIn = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const r = await signIn.auth.signInWithPassword({ email: TEST_OWNER_EMAIL, password: PW });
    if (r.error || !r.data.session) throw new Error(`owner signIn failed: ${r.error?.message}`);
    ownerClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${r.data.session.access_token}` } },
    });
  });

  afterAll(async () => {
    await admin.from('meals').delete().eq('user_id', ownerId);
    await admin.from('profiles').delete().eq('user_id', ownerId);
    await admin.schema('app_private').from('app_owner').upsert({
      id: true, owner_user_id: OWNER_UID,
    }, { onConflict: 'id' });
  });

  it('load_home_snapshot returns expected shape for owner', async () => {
    const { data, error } = await rpc(ownerClient, 'load_home_snapshot', { p_tz: 'Asia/Tokyo' });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const snap = asObj(data);
    expect(snap.timezone).toBe('Asia/Tokyo');
    expect(typeof snap.todayDate).toBe('string');
    expect(Array.isArray(snap.meals)).toBe(true);
    expect((snap.meals as unknown[]).length).toBeGreaterThan(0);
    expect(snap.workoutMarked).toBe(false);
    expect(snap.isWorkoutDay).toBe(false);
    expect(snap.targets).toEqual({ kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 });
    const opts = snap.targetOptions as { workout: Record<string, number>; rest: Record<string, number>; empty: Record<string, number> };
    expect(opts.workout.kcal).toBe(2500);
    expect(opts.rest.kcal).toBe(2050);
    expect(opts.empty.kcal).toBe(0);
  });

  it('load_history_meals returns expected shape for owner', async () => {
    const { data, error } = await rpc(ownerClient, 'load_history_meals', {
      p_local_date: null, p_tz: 'Asia/Tokyo',
    });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const snap = asObj(data);
    expect(snap.timezone).toBe('Asia/Tokyo');
    expect(typeof snap.date).toBe('string');
    expect(typeof snap.todayDate).toBe('string');
    expect(Array.isArray(snap.meals)).toBe(true);
    expect(snap.date).toBe(snap.todayDate);
  });

  it('load_history_meals clamps future date to today', async () => {
    const { data, error } = await rpc(ownerClient, 'load_history_meals', {
      p_local_date: '2099-12-31', p_tz: 'Asia/Tokyo',
    });
    expect(error).toBeNull();
    const snap = asObj(data);
    expect(snap.date).toBe(snap.todayDate);
  });

  it('load_body_snapshot returns expected shape for owner', async () => {
    const { data, error } = await rpc(ownerClient, 'load_body_snapshot', { p_tz: 'Asia/Tokyo' });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const snap = asObj(data);
    expect(snap.timezone).toBe('Asia/Tokyo');
    expect(typeof snap.windowStartUtc).toBe('string');
    expect(Array.isArray(snap.rows)).toBe(true);
  });

  it('RPCs fall back to profile.preferred_timezone when p_tz is null', async () => {
    const { data, error } = await rpc(ownerClient, 'load_home_snapshot', { p_tz: null });
    expect(error).toBeNull();
    expect(asObj(data).timezone).toBe('Asia/Tokyo');
  });

  it('RPCs ignore invalid p_tz and fall back', async () => {
    const { data, error } = await rpc(ownerClient, 'load_home_snapshot', { p_tz: 'Not/A_Real_Zone' });
    expect(error).toBeNull();
    expect(asObj(data).timezone).toBe('Asia/Tokyo');
  });

  it('anon cannot call snapshot RPCs (revoke + auth.uid is null)', async () => {
    // grant 已 revoke from anon；预期 PostgREST 直接 permission denied
    const { error } = await rpc(anon, 'load_home_snapshot', { p_tz: 'Asia/Tokyo' });
    expect(error).not.toBeNull();
  });
});
