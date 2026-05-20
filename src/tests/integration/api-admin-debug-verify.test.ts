import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth/require-allowed-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-allowed-user')>('@/lib/auth/require-allowed-user');
  return {
    ...actual,
    requireAllowedUser: vi.fn().mockRejectedValue(new actual.AuthError()),
  };
});

import { POST } from '@/app/admin/debug/api/verify/route';

function buildReq(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/admin/debug/api/verify', {
    method: 'POST',
    headers: { 'sec-fetch-site': 'same-origin', ...headers },
  });
}

describe('POST /admin/debug/api/verify', () => {
  it('rejects without owner session (401)', async () => {
    const r = await POST(buildReq({ 'x-dev-secret': 'whatever' }));
    expect([401, 403]).toContain(r.status);
  });
});
