import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SECRET_KEY_ADMIN!,
  { auth: { persistSession: false } },
);

test('01-fitness-meal: 选健身餐 → 服务端 meals +1', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const ownerId = process.env.ALLOWED_USER_ID!;
  const before = await admin.from('meals').select('id').eq('user_id', ownerId);
  await page.goto('/');
  await page.getByRole('button', { name: /牛肉糙米饭/ }).click();
  await page.waitForTimeout(500);
  const after = await admin.from('meals').select('id').eq('user_id', ownerId);
  expect((after.data ?? []).length).toBe((before.data ?? []).length + 1);
});
