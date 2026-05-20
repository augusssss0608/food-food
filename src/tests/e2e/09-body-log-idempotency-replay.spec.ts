import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();  // 默认 current_weight_kg = 70
});

test('09 body-log-idempotency-replay: 同 key 两次只 1 row, profile 不被陈旧 weight 重放覆盖', async ({ page }) => {
  await page.goto('/');
  const supa = adminClient();
  const key = crypto.randomUUID();
  const body1 = {
    measured_at: new Date().toISOString(), weight_kg: 72.0, source: 'manual',
  };

  const r1 = await page.request.post('/api/body/log', {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'sec-fetch-site': 'same-origin' },
    data: body1,
  });
  expect(r1.status()).toBe(200);
  expect((await r1.json()).idempotentSkip).toBe(false);

  // 同 key 第二次发不同 weight；route 应 idempotentSkip 且不动 profile
  const r2 = await page.request.post('/api/body/log', {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'sec-fetch-site': 'same-origin' },
    data: { ...body1, weight_kg: 60.0 },
  });
  expect(r2.status()).toBe(200);
  expect((await r2.json()).idempotentSkip).toBe(true);

  const { data: rows } = await supa.from('body_metrics').select('*').eq('user_id', OWNER_UID);
  expect(rows).toHaveLength(1);
  expect((rows![0] as { weight_kg: number }).weight_kg).toBeCloseTo(72.0, 1);

  // profile.current_weight_kg 应等于第一次的 72，不被 60 覆盖
  const { data: prof } = await supa.from('profiles').select('current_weight_kg').eq('user_id', OWNER_UID).single();
  expect((prof as { current_weight_kg: number }).current_weight_kg).toBeCloseTo(72.0, 1);
});
