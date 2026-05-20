import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('10 daily-advice-user-trigger: 点 "今天怎么样" → advice upsert + alert', async ({ page }) => {
  const supa = adminClient();
  await page.goto('/');

  const dialogP = page.waitForEvent('dialog', { timeout: 60_000 });
  const respP = page.waitForResponse(
    (r) => r.url().includes('/api/advice/daily') && r.request().method() === 'POST',
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: /今天怎么样/ }).click();

  // 顺序很重要：先 accept dialog 释放浏览器 main thread，再读 response
  const dialog = await dialogP;
  const dialogMsg = dialog.message();
  await dialog.accept();
  expect(dialogMsg).toContain('今日总评');  // mock advice fixture marker

  const r = await respP;
  expect(r.status()).toBe(200);

  const { data } = await supa.from('advice').select('*')
    .eq('user_id', OWNER_UID).eq('kind', 'daily');
  expect(data).toHaveLength(1);
});
