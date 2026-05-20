import { test, expect } from '@playwright/test';
import { DEV_SECRET } from './helpers/supabase';

test.describe('29 sandbox-probe-secret', () => {
  test('无 secret → 403', async ({ request }) => {
    const r = await request.get('/api/dev/sandbox-probe');
    expect(r.status()).toBe(403);
  });

  test('错 secret → 403', async ({ request }) => {
    const r = await request.get('/api/dev/sandbox-probe', { headers: { 'x-dev-secret': 'wrong' } });
    expect(r.status()).toBe(403);
  });

  test('对 secret → 200 + { phase, note }', async ({ request }) => {
    const r = await request.get('/api/dev/sandbox-probe', { headers: { 'x-dev-secret': DEV_SECRET } });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.phase).toBe(1);
    expect(j.note).toBeTruthy();
  });
});
