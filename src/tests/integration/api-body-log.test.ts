import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/body/log/route';

function buildReq(body: unknown, mutationId?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'sec-fetch-site': 'same-origin',
  };
  if (mutationId) headers['Idempotency-Key'] = mutationId;
  return new Request('http://localhost:3000/api/body/log', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('POST /api/body/log integration', () => {
  it('rejects without Idempotency-Key (400)', async () => {
    const r = await POST(buildReq({ measured_at: new Date().toISOString(), weight_kg: 70, source: 'manual' }));
    expect(r.status).toBe(400);
  });
});
