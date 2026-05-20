import { test, expect } from '@playwright/test';
import path from 'node:path';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

const FIXTURE = path.resolve(__dirname, 'fixtures', 'sample-meal.jpg');

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('06 photo-meal-edit-confirm: 上传 → 编辑 kcal/satiety → 确认入库写编辑值', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const supa = adminClient();
  await page.goto('/');

  // 第一阶段：上传图片，等 extract API 返回，再等 preview 卡片
  const extractResp = page.waitForResponse(
    (r) => r.url().includes('/api/meals/extract') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  const extractR = await extractResp;
  expect(extractR.status()).toBe(200);
  await expect(page.getByRole('button', { name: /確認入庫/ })).toBeVisible({ timeout: 10_000 });

  // mock 返回的 dish_name = '牛肉糙米饭' / kcal=480；改成 555 验证编辑值生效
  // UI 用 Input 组件 + label 文案；id 比 label 文字版本稳
  await page.locator('#mp-kcal').fill('555');
  // 饱腹感从单个 number input 改成 5 个按钮 1-5，点 "4"（exact:true 避免命中其他文本）
  await page.getByRole('button', { name: '4', exact: true }).click();

  const logResp = page.waitForResponse(
    (r) => r.url().includes('/api/meals/log') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /確認入庫/ }).click();
  const r = await logResp;
  expect(r.status()).toBe(200);

  const { data } = await supa.from('meals').select('*').eq('user_id', OWNER_UID);
  expect(data).toHaveLength(1);
  const row = data![0] as Record<string, unknown>;
  expect(row.source).toBe('photo_ai');
  expect(row.dish_name).toBe('牛肉糙米饭');
  expect(row.kcal).toBe(555);
  expect(row.satiety).toBe(4);
});
