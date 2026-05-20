import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/meals/log/route';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';

const supa = createTestAdminClient();

beforeEach(async () => {
  await supa.from('meals').delete().eq('user_id', OWNER_UID);
});

function buildReq(body: unknown, mutationId?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'sec-fetch-site': 'same-origin',
  };
  if (mutationId) headers['Idempotency-Key'] = mutationId;
  return new Request('http://localhost:3000/api/meals/log', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('POST /api/meals/log integration', () => {
  it('rejects without Idempotency-Key (400)', async () => {
    const r = await POST(buildReq({ ate_at: new Date().toISOString(), source: 'preset', preset_key: 'beef_rice' }));
    expect(r.status).toBe(400);
  });
});
