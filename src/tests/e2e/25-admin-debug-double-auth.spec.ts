import { test, expect } from '@playwright/test';
import { DEV_SECRET } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('25 admin-debug-double-auth: secret gate → 错 secret 挡 → 对 secret 后看到调试面板', async ({ page }) => {
  await page.goto('/admin/debug');
  // gate 页 heading: 維護面板
  await expect(page.getByRole('heading', { name: /維護面板/ })).toBeVisible();

  // 错 secret → 留在 gate + 错误 toast
  // gate 用 Input 组件 + label="DEV_SECRET"；placeholder 是 ••••••••••••，所以用 label 定位
  await page.getByLabel('DEV_SECRET').fill('wrong-secret');
  await page.getByRole('button', { name: /進入/ }).click();
  // toast.error('secret 錯誤') 或 '工作階段已過期'
  await expect(page.getByText(/secret 錯誤|工作階段已過期/)).toBeVisible({ timeout: 5_000 });
  expect(page.url()).toContain('/admin/debug');

  // 对 secret → reload → 显示调试面板
  await page.getByLabel('DEV_SECRET').fill(DEV_SECRET);
  await page.getByRole('button', { name: /進入/ }).click();
  // debug 页 heading 是 'debug'（小写英文）
  await expect(page.getByRole('heading', { name: /^debug$/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/最近 50 條 AI 呼叫/)).toBeVisible();
  await expect(page.getByText(/最近 50 條錯誤日誌/)).toBeVisible();
  await expect(page.getByText(/^預算$/)).toBeVisible();
  await expect(page.getByText(/Cron Runs/)).toBeVisible();
});
