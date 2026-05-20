import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('04 preset-meal-log: 点 preset → meals 行字段全正确', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const supa = adminClient();
  await page.goto('/');
  const resp = page.waitForResponse(
    (r) => r.url().includes('/api/meals/log') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /牛肉糙米饭/ }).click();
  const r = await resp;
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j.ok).toBe(true);
  expect(j.mealId).toBeTruthy();

  const { data } = await supa.from('meals').select('*').eq('user_id', OWNER_UID);
  expect(data).toHaveLength(1);
  const row = data![0] as Record<string, unknown>;
  expect(row.source).toBe('preset');
  expect(row.preset_key).toBe('beef_rice');
  expect(row.dish_name).toBe('牛肉糙米饭');
  expect(row.kcal).toBe(480);
  expect(row.protein_g).toBe(38);
  expect(row.carb_g).toBe(52);
  expect(row.client_mutation_id).toBeTruthy();
});
