import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';

const supa = createTestAdminClient();

// 預設 mock 為「未登入」；individual test 內可 vi.mocked(requireAllowedUser).mockResolvedValueOnce(...) 覆蓋
vi.mock('@/lib/auth/require-allowed-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-allowed-user')>('@/lib/auth/require-allowed-user');
  return {
    ...actual,
    requireAllowedUser: vi.fn().mockRejectedValue(new actual.AuthError()),
  };
});

// supabaseAdmin 有 `assertServerOnly` 在 jsdom 環境會 throw（typeof window !== 'undefined'）
// 用 test admin client 替代，行為等價（都是 service_role）
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => supa,
  supabaseCron: () => supa,
}));

import { PATCH, DELETE } from '@/app/api/meals/[id]/route';
import { requireAllowedUser } from '@/lib/auth/require-allowed-user';

function buildPatchReq(body: unknown, opts: { sameOrigin?: boolean } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.sameOrigin !== false) headers['sec-fetch-site'] = 'same-origin';
  return new Request('http://localhost:3000/api/meals/x', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

function buildDeleteReq(opts: { sameOrigin?: boolean } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.sameOrigin !== false) headers['sec-fetch-site'] = 'same-origin';
  return new Request('http://localhost:3000/api/meals/x', { method: 'DELETE', headers });
}

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });

// 合法 UUID v4：第 3 段以 4 開頭，第 4 段以 8/9/a/b 開頭。
// 用一個固定但格式正確的 UUID 做 non-owner / not-found 測試
const VALID_UUID = '11111111-1111-4111-8111-111111111111';

beforeEach(async () => {
  await supa.from('meals').delete().eq('user_id', OWNER_UID);
  vi.mocked(requireAllowedUser).mockReset();
  vi.mocked(requireAllowedUser).mockRejectedValue(new (await import('@/lib/auth/require-allowed-user')).AuthError());
});

describe('PATCH /api/meals/[id]', () => {
  it('rejects cross-origin (no sec-fetch-site=same-origin) with 403', async () => {
    const r = await PATCH(buildPatchReq({ kcal: 100 }, { sameOrigin: false }), ctxFor(VALID_UUID));
    expect(r.status).toBe(403);
  });

  it('rejects unauthenticated with 401', async () => {
    const r = await PATCH(buildPatchReq({ kcal: 100 }), ctxFor(VALID_UUID));
    expect(r.status).toBe(401);
  });

  it('rejects malformed uuid with 400', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await PATCH(buildPatchReq({ kcal: 100 }), ctxFor('not-a-uuid'));
    expect(r.status).toBe(400);
  });

  it('rejects negative kcal with 400', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await PATCH(buildPatchReq({ kcal: -50 }), ctxFor(VALID_UUID));
    expect(r.status).toBe(400);
  });

  it('rejects unknown field with 400 (strict schema)', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await PATCH(buildPatchReq({ ate_at: '2026-01-01' }), ctxFor(VALID_UUID));
    expect(r.status).toBe(400);
  });

  it('updates owner meal (200)', async () => {
    const { data: meal } = await supa.from('meals').insert({
      user_id: OWNER_UID,
      ate_at: '2026-05-21T03:00:00Z',
      source: 'manual',
      dish_name: 'old name',
      kcal: 400,
      client_mutation_id: crypto.randomUUID(),
    } as never).select('id').single();
    const mealId = (meal as { id: string }).id;

    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await PATCH(buildPatchReq({ kcal: 555, dish_name: 'new name' }), ctxFor(mealId));
    expect(r.status).toBe(200);

    const { data } = await supa.from('meals').select('kcal, dish_name').eq('id', mealId).single();
    expect((data as { kcal: number }).kcal).toBe(555);
    expect((data as { dish_name: string }).dish_name).toBe('new name');
  });

  it("returns 404 when meal id doesn't exist", async () => {
    const otherUserId = '99999999-9999-4999-8999-999999999999';
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: otherUserId, supabase: undefined as never });
    const r = await PATCH(buildPatchReq({ kcal: 100 }), ctxFor(VALID_UUID));
    expect(r.status).toBe(404);
  });

  it("returns 404 when meal exists but belongs to OWNER_UID and caller is different user (越權防護)", async () => {
    const { data: meal } = await supa.from('meals').insert({
      user_id: OWNER_UID,
      ate_at: '2026-05-21T03:00:00Z',
      source: 'manual',
      dish_name: 'owner meal',
      kcal: 400,
      client_mutation_id: crypto.randomUUID(),
    } as never).select('id').single();
    const mealId = (meal as { id: string }).id;

    const otherUserId = '99999999-9999-4999-8999-999999999999';
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: otherUserId, supabase: undefined as never });
    const r = await PATCH(buildPatchReq({ kcal: 9999, dish_name: 'hijacked' }), ctxFor(mealId));
    expect(r.status).toBe(404);

    // DB row 未被改
    const { data } = await supa.from('meals').select('kcal, dish_name').eq('id', mealId).single();
    expect((data as { kcal: number }).kcal).toBe(400);
    expect((data as { dish_name: string }).dish_name).toBe('owner meal');
  });
});

describe('DELETE /api/meals/[id]', () => {
  it('rejects cross-origin with 403', async () => {
    const r = await DELETE(buildDeleteReq({ sameOrigin: false }), ctxFor(VALID_UUID));
    expect(r.status).toBe(403);
  });

  it('rejects unauthenticated with 401', async () => {
    const r = await DELETE(buildDeleteReq(), ctxFor(VALID_UUID));
    expect(r.status).toBe(401);
  });

  it('rejects malformed uuid with 400', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await DELETE(buildDeleteReq(), ctxFor('bad-id'));
    expect(r.status).toBe(400);
  });

  it('deletes owner meal (200) and row is gone', async () => {
    const { data: meal } = await supa.from('meals').insert({
      user_id: OWNER_UID,
      ate_at: '2026-05-21T03:00:00Z',
      source: 'manual',
      dish_name: 'to-delete',
      kcal: 100,
      client_mutation_id: crypto.randomUUID(),
    } as never).select('id').single();
    const mealId = (meal as { id: string }).id;

    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await DELETE(buildDeleteReq(), ctxFor(mealId));
    expect(r.status).toBe(200);

    const { data } = await supa.from('meals').select('id').eq('id', mealId).maybeSingle();
    expect(data).toBeNull();
  });

  it("returns 404 when meal id doesn't exist", async () => {
    const otherUserId = '99999999-9999-4999-8999-999999999999';
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: otherUserId, supabase: undefined as never });
    const r = await DELETE(buildDeleteReq(), ctxFor(VALID_UUID));
    expect(r.status).toBe(404);
  });

  it("returns 404 when meal exists but caller is different user (越權防護，DB row 不被刪)", async () => {
    const { data: meal } = await supa.from('meals').insert({
      user_id: OWNER_UID,
      ate_at: '2026-05-21T03:00:00Z',
      source: 'manual',
      dish_name: 'owner meal',
      kcal: 400,
      client_mutation_id: crypto.randomUUID(),
    } as never).select('id').single();
    const mealId = (meal as { id: string }).id;

    const otherUserId = '99999999-9999-4999-8999-999999999999';
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: otherUserId, supabase: undefined as never });
    const r = await DELETE(buildDeleteReq(), ctxFor(mealId));
    expect(r.status).toBe(404);

    // DB row 仍在
    const { data } = await supa.from('meals').select('id').eq('id', mealId).maybeSingle();
    expect(data).not.toBeNull();
    expect((data as { id: string }).id).toBe(mealId);
  });
});
