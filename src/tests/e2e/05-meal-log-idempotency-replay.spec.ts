import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('05 meal-log-idempotency-replay: 同 Idempotency-Key 两次 POST 只 1 row', async ({ page }) => {
  await page.goto('/'); // 让 page.request 拿 owner session cookie
  const supa = adminClient();
  const key = crypto.randomUUID();
  const body = { ate_at: new Date().toISOString(), source: 'preset', preset_key: 'beef_rice' };

  const r1 = await page.request.post('/api/meals/log', {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'sec-fetch-site': 'same-origin' },
    data: body,
  });
  expect(r1.status()).toBe(200);
  const j1 = await r1.json();
  expect(j1.ok).toBe(true);
  expect(j1.mealId).toBeTruthy();

  const r2 = await page.request.post('/api/meals/log', {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'sec-fetch-site': 'same-origin' },
    data: body,
  });
  expect(r2.status()).toBe(200);
  const j2 = await r2.json();
  // ignoreDuplicates: conflict 命中时 .maybeSingle() 返回 null
  expect(j2.mealId).toBeNull();

  const { data } = await supa.from('meals').select('*').eq('user_id', OWNER_UID);
  expect(data).toHaveLength(1);
  expect((data![0] as { client_mutation_id: string }).client_mutation_id).toBe(key);
});
