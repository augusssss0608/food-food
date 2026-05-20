import { test, expect } from '@playwright/test';
import { DEV_SECRET } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('25 admin-debug-double-auth: secret gate → 错 secret 挡 → 对 secret 后看到调试面板', async ({ page }) => {
  await page.goto('/admin/debug');
  await expect(page.getByRole('heading', { name: /维护面板鉴权/ })).toBeVisible();

  // 错 secret → 留在 gate + 错误文案
  await page.getByPlaceholder('DEV_SECRET').fill('wrong-secret');
  await page.getByRole('button', { name: /进入/ }).click();
  await expect(page.getByText(/错误的 secret/)).toBeVisible({ timeout: 5_000 });
  expect(page.url()).toContain('/admin/debug');

  // 对 secret → reload → 显示调试面板
  await page.getByPlaceholder('DEV_SECRET').fill(DEV_SECRET);
  await page.getByRole('button', { name: /进入/ }).click();
  await expect(page.getByRole('heading', { name: '/admin/debug' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/最近 50 条 AI 调用/)).toBeVisible();
  await expect(page.getByText(/最近 50 条错误日志/)).toBeVisible();
  await expect(page.getByText(/预算状态/)).toBeVisible();
  await expect(page.getByText(/Cron Runs/)).toBeVisible();
});
