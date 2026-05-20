import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, deleteOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await deleteOwnerProfile();  // /setup 是初次进入：profile 不存在
});

test('02 setup-initial-targets: 提交后 profile 写入，targets_source=ai_initial', async ({ page }) => {
  await page.goto('/setup');
  await expect(page.getByRole('heading', { name: /首次设置/ })).toBeVisible();

  const respP = page.waitForResponse(
    (r) => r.url().includes('/api/setup') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /生成初始目标/ }).click();
  const r = await respP;
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j.ok).toBe(true);
  expect(j.targets).toBeTruthy();

  const supa = adminClient();
  const { data } = await supa.from('profiles').select('*').eq('user_id', OWNER_UID).single();
  expect(data).toBeTruthy();
  expect((data as { targets_source: string }).targets_source).toBe('ai_initial');
  expect((data as { kcal_workout_day: number }).kcal_workout_day).toBeGreaterThan(0);
});
