import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/cron/catchup/route';

function buildReq(authHeader?: string): Request {
  return new Request('http://localhost:3000/api/cron/catchup', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/catchup auth', () => {
  it('rejects without authorization (401)', async () => {
    const r = await GET(buildReq());
    expect(r.status).toBe(401);
  });
  it('rejects wrong bearer (401)', async () => {
    const r = await GET(buildReq('Bearer wrong-secret'));
    expect(r.status).toBe(401);
  });
});
