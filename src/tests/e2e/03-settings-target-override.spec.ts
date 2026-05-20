import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('03 settings-target-override: 修改 kcal 保存 → DB 更新 + targets_source=user_override', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /修改目標/ })).toBeVisible();

  // settings 页有 kcal_workout_day 等数字 input，默认 2400 → 改 3000
  // UI 用 Input 组件 + label 文案；用 id selector 更稳，不依赖 label 文字版本
  const kcalInput = page.locator('#kcal_workout_day');
  await expect(kcalInput).toBeVisible({ timeout: 10_000 });
  await kcalInput.fill('3000');

  await page.getByRole('button', { name: /儲存目標/ }).click();
  await expect(page.getByText(/已儲存/)).toBeVisible({ timeout: 10_000 });

  const supa = adminClient();
  const { data } = await supa.from('profiles').select('*').eq('user_id', OWNER_UID).single();
  expect((data as { kcal_workout_day: number }).kcal_workout_day).toBe(3000);
  expect((data as { targets_source: string }).targets_source).toBe('user_override');
});
