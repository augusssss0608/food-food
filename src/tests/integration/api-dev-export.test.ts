import { describe, it, expect, vi } from 'vitest';

// next/headers cookies() 在 vitest 直接调用 route handler 时不可用；
// mock require-allowed-user 让它直接抛 AuthError（无 session 等价场景）
vi.mock('@/lib/auth/require-allowed-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-allowed-user')>('@/lib/auth/require-allowed-user');
  return {
    ...actual,
    requireAllowedUser: vi.fn().mockRejectedValue(new actual.AuthError()),
  };
});

import { GET } from '@/app/api/dev/export/route';

function buildReq(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret) headers['x-dev-secret'] = secret;
  return new Request('http://localhost:3000/api/dev/export', { method: 'GET', headers });
}

describe('GET /api/dev/export', () => {
  it('rejects without owner session (401)', async () => {
    const r = await GET(buildReq('any-secret'));
    expect(r.status).toBe(401);
  });
});
