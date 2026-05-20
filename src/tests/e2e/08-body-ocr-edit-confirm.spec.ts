import { test, expect } from '@playwright/test';
import path from 'node:path';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

const FIXTURE = path.resolve(__dirname, 'fixtures', 'sample-meal.jpg');

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('08 body-ocr-edit-confirm: 上传 body 图 → 编辑 weight → 确认；body_metrics + profile 更新', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const supa = adminClient();
  await page.goto('/');

  // body 上传用第二个 file input
  const extractResp = page.waitForResponse(
    (r) => r.url().includes('/api/body/extract') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.locator('input[type="file"]').nth(1).setInputFiles(FIXTURE);
  const extractR = await extractResp;
  expect(extractR.status()).toBe(200);

  // BodyPreviewCard 出现：含 weight_kg/body_fat_pct 等 input
  // UI 用 Input 组件，id `bp-weight_kg`，比 label 文字版本稳
  const weightInput = page.locator('#bp-weight_kg');
  await expect(weightInput).toBeVisible({ timeout: 10_000 });
  await weightInput.fill('72.5');

  const logResp = page.waitForResponse(
    (r) => r.url().includes('/api/body/log') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /確認入庫/ }).click();
  const r = await logResp;
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j.ok).toBe(true);
  expect(j.idempotentSkip).toBe(false);

  const { data: bm } = await supa.from('body_metrics').select('*').eq('user_id', OWNER_UID);
  expect(bm).toHaveLength(1);
  expect((bm![0] as { weight_kg: number }).weight_kg).toBeCloseTo(72.5, 1);

  // profile.current_weight_kg 应同步更新
  const { data: prof } = await supa.from('profiles').select('current_weight_kg').eq('user_id', OWNER_UID).single();
  expect((prof as { current_weight_kg: number }).current_weight_kg).toBeCloseTo(72.5, 1);
});
