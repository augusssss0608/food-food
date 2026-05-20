import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';

const supa = createTestAdminClient();

vi.mock('@/lib/auth/require-allowed-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-allowed-user')>('@/lib/auth/require-allowed-user');
  return {
    ...actual,
    requireAllowedUser: vi.fn().mockRejectedValue(new actual.AuthError()),
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => supa,
  supabaseCron: () => supa,
}));

import { POST } from '@/app/api/workout-day/route';
import { requireAllowedUser } from '@/lib/auth/require-allowed-user';

function buildReq(body: unknown, opts: { sameOrigin?: boolean } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.sameOrigin !== false) headers['sec-fetch-site'] = 'same-origin';
  return new Request('http://localhost:3000/api/workout-day', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await supa.from('workout_days').delete().eq('user_id', OWNER_UID);
  vi.mocked(requireAllowedUser).mockReset();
  vi.mocked(requireAllowedUser).mockRejectedValue(new (await import('@/lib/auth/require-allowed-user')).AuthError());
});

describe('POST /api/workout-day', () => {
  it('rejects cross-origin with 403', async () => {
    const r = await POST(buildReq({ date: '2026-05-21', is_workout: true }, { sameOrigin: false }));
    expect(r.status).toBe(403);
  });

  it('rejects unauthenticated with 401', async () => {
    const r = await POST(buildReq({ date: '2026-05-21', is_workout: true }));
    expect(r.status).toBe(401);
  });

  it('rejects invalid date format with 400', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2026/05/21', is_workout: true }));
    expect(r.status).toBe(400);
  });

  it('rejects missing is_workout with 400', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2026-05-21' }));
    expect(r.status).toBe(400);
  });

  it('rejects unknown field with 400 (strict)', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2026-05-21', is_workout: true, hijack: 'x' }));
    expect(r.status).toBe(400);
  });

  it('rejects invalid calendar date (Feb 31) with 400', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2026-02-31', is_workout: true }));
    expect(r.status).toBe(400);
  });

  it('rejects far-past date with 400 (write bound: 2 years)', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2010-01-01', is_workout: true }));
    expect(r.status).toBe(400);
  });

  it('rejects far-future date with 400 (write bound: 30 days)', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2099-12-31', is_workout: true }));
    expect(r.status).toBe(400);
  });

  it('inserts new row on first call (200)', async () => {
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2026-05-21', is_workout: true }));
    expect(r.status).toBe(200);

    const { data } = await supa.from('workout_days').select('is_workout')
      .eq('user_id', OWNER_UID).eq('date', '2026-05-21').single();
    expect((data as { is_workout: boolean }).is_workout).toBe(true);
  });

  it('updates existing row on second call (upsert)', async () => {
    // first: mark workout
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    await POST(buildReq({ date: '2026-05-21', is_workout: true }));

    // second: change to rest
    vi.mocked(requireAllowedUser).mockResolvedValueOnce({ userId: OWNER_UID, supabase: undefined as never });
    const r = await POST(buildReq({ date: '2026-05-21', is_workout: false }));
    expect(r.status).toBe(200);

    const { data } = await supa.from('workout_days').select('is_workout')
      .eq('user_id', OWNER_UID).eq('date', '2026-05-21').single();
    expect((data as { is_workout: boolean }).is_workout).toBe(false);
  });
});
