import { test, expect } from '@playwright/test';
import path from 'node:path';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

const FIXTURE = path.resolve(__dirname, 'fixtures', 'sample-meal.jpg');

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('07 photo-meal-cancel: 上传 → preview 出现 → 点取消 → DB 无 row', async ({ page }) => {
  const supa = adminClient();
  await page.goto('/');

  const extractResp = page.waitForResponse(
    (r) => r.url().includes('/api/meals/extract') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await extractResp;
  await expect(page.getByRole('button', { name: /確認入庫/ })).toBeVisible({ timeout: 10_000 });

  // 点 "取消" → preview 应消失，file input 回来（"拍餐"小节下）
  await page.getByRole('button', { name: /^取消$/ }).first().click();
  await expect(page.getByRole('button', { name: /確認入庫/ })).toHaveCount(0);

  // DB 没有新 meal
  const { data } = await supa.from('meals').select('*').eq('user_id', OWNER_UID);
  expect(data ?? []).toHaveLength(0);
});
