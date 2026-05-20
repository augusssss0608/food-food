import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;

const admin = createTestAdminClient();
const anon = createClient(SUPABASE_URL, ANON_KEY);

beforeAll(async () => {
  // 准备一条 owner 的 meal
  await admin.from('meals').delete().eq('user_id', OWNER_UID);
  await admin.from('meals').insert({
    user_id: OWNER_UID,
    ate_at: new Date().toISOString(),
    source: 'manual',
    client_mutation_id: crypto.randomUUID(),
    kcal: 500,
  });
});

describe('RLS — anon client', () => {
  it('cannot read public.meals', async () => {
    const { data } = await anon.from('meals').select('*');
    // RLS 拒绝时通常返回空数组 + error = null（Supabase 行为）
    expect((data ?? []).length).toBe(0);
  });
});

describe('RLS — service_role bypass', () => {
  it('admin can read all meals', async () => {
    const { data, error } = await admin.from('meals').select('*');
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});

// ============== authenticated user JWT 矩阵 ==============
// 双层 policy 设计（spec §3.5）：
//   1. permissive policy "owner_self"：user_id = auth.uid()
//   2. restrictive policy "owner_allowed"：auth.uid() = app_private.owner_user_id()
// 两层 AND；任一不满足都拒绝。

describe('RLS — authenticated user JWT matrix', () => {
  // 每次跑用唯一邮箱避免 supabase auth 内存里残留的已注册用户（即使 listUsers 查不到也无法 createUser）
  const stamp = Date.now();
  const TEST_OWNER_EMAIL = `rls-test-owner-${stamp}@food-food.local`;
  const STRANGER_EMAIL = `rls-test-stranger-${stamp}@food-food.local`;
  const PW = 'rls-test-pw-12345';

  let ownerId: string;
  let strangerId: string;
  let ownerClient: ReturnType<typeof createClient>;
  let strangerClient: ReturnType<typeof createClient>;

  async function ensureUser(email: string): Promise<{ id: string }> {
    // 先尝试 createUser，如果 "already registered" 错误就用 list 找出来
    const r = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    if (r.data.user) return r.data.user;
    // createUser 失败（多半因为已存在）→ listUsers 找
    for (let page = 1; page <= 10; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      const found = list.users.find((u) => u.email === email);
      if (found) {
        await admin.auth.admin.updateUserById(found.id, { password: PW });
        return found;
      }
      if (list.users.length < 100) break;
    }
    throw new Error(`ensureUser('${email}') 失败：createUser err=${r.error?.message ?? 'null'}, list search no hit`);
  }

  beforeAll(async () => {
    ownerId = (await ensureUser(TEST_OWNER_EMAIL)).id;
    strangerId = (await ensureUser(STRANGER_EMAIL)).id;

    // 把 owner 绑到 app_private.app_owner（表结构 id boolean + owner_user_id uuid，single_owner 约束）
    await admin.schema('app_private').from('app_owner').upsert({
      id: true, owner_user_id: ownerId,
    }, { onConflict: 'id' });

    // 用 admin 给 owner 写一条 meal
    await admin.from('meals').delete().in('user_id', [ownerId, strangerId]);
    await admin.from('meals').insert({
      user_id: ownerId, ate_at: new Date().toISOString(), source: 'manual',
      kcal: 500, client_mutation_id: crypto.randomUUID(),
    });

    // 两个用户各拿 JWT
    const ownerSignIn = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const r1 = await ownerSignIn.auth.signInWithPassword({ email: TEST_OWNER_EMAIL, password: PW });
    if (r1.error || !r1.data.session) throw new Error(`owner signIn failed: ${r1.error?.message}`);
    ownerClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${r1.data.session.access_token}` } },
    });

    const strangerSignIn = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const r2 = await strangerSignIn.auth.signInWithPassword({ email: STRANGER_EMAIL, password: PW });
    if (r2.error || !r2.data.session) throw new Error(`stranger signIn failed: ${r2.error?.message}`);
    strangerClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${r2.data.session.access_token}` } },
    });
  });

  afterAll(async () => {
    // 恢复 seed 的 OWNER_UID，避免污染后续 integration test 的 DB state
    await admin.schema('app_private').from('app_owner').upsert({
      id: true, owner_user_id: OWNER_UID,
    }, { onConflict: 'id' });
    await admin.from('meals').delete().in('user_id', [ownerId, strangerId]);
  });

  it('owner JWT can read own meal (permissive pass + restrictive pass)', async () => {
    const { data, error } = await ownerClient.from('meals').select('id, user_id');
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect((data ?? []).every((r: { user_id: string }) => r.user_id === ownerId)).toBe(true);
  });

  it('stranger JWT (not in app_owner) cannot read owner meal (restrictive blocks)', async () => {
    const { data, error } = await strangerClient.from('meals').select('id, user_id');
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it('stranger JWT cannot insert into own user_id (restrictive blocks write)', async () => {
    const { error } = await strangerClient.from('meals').insert({
      user_id: strangerId, ate_at: new Date().toISOString(), source: 'manual',
      kcal: 100, client_mutation_id: crypto.randomUUID(),
    } as never);
    expect(error?.message ?? '').toMatch(/violates row-level security|new row violates/i);
  });

  it('owner JWT cannot insert with another user_id (permissive blocks write)', async () => {
    const { error } = await ownerClient.from('meals').insert({
      user_id: strangerId,  // 故意写错 user_id
      ate_at: new Date().toISOString(), source: 'manual',
      kcal: 100, client_mutation_id: crypto.randomUUID(),
    } as never);
    expect(error?.message ?? '').toMatch(/violates row-level security|new row violates/i);
  });

  it.each([
    'meals', 'body_metrics', 'workout_days', 'advice', 'inbox', 'push_subscriptions',
  ])('stranger JWT reads %s returns 0 rows (restrictive)', async (table) => {
    const { data, error } = await strangerClient.from(table).select('*');
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });
});
