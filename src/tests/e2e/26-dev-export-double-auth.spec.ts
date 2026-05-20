import { test, expect } from '@playwright/test';
import { OWNER_UID, DEV_SECRET } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('26 dev-export-double-auth: owner+secret → 200 tables；无 secret → 403', async ({ page }) => {
  await page.goto('/');  // 让 page.request 拿 owner cookie

  // 无 secret → 403 (forbidden dev_secret)
  const noSecret = await page.request.get('/api/dev/export');
  expect(noSecret.status()).toBe(403);

  // 错 secret → 403
  const wrongSecret = await page.request.get('/api/dev/export', {
    headers: { 'x-dev-secret': 'wrong' },
  });
  expect(wrongSecret.status()).toBe(403);

  // 对 secret → 200 + tables
  const ok = await page.request.get('/api/dev/export', {
    headers: { 'x-dev-secret': DEV_SECRET },
  });
  expect(ok.status()).toBe(200);
  const j = await ok.json();
  // 必须断言 user_id === OWNER_UID（否则 API 返回别的用户也能过）
  expect(j.user_id).toBe(OWNER_UID);
  expect(j.tables).toBeTruthy();
  for (const t of ['meals', 'body_metrics', 'advice', 'profiles', 'workout_days']) {
    expect(j.tables).toHaveProperty(t);
    expect(Array.isArray(j.tables[t])).toBe(true);
  }
});
