import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('10 daily-advice-user-trigger: 点 "今天怎麼樣" → advice upsert + toast', async ({ page }) => {
  const supa = adminClient();
  await page.goto('/');

  // UI overhaul 后用 toast.info 取代 alert()，不再触发 page.on('dialog')。
  // 改成等 API 200 + toast 渲染（body 含 mock marker '今日总评'）。
  const respP = page.waitForResponse(
    (r) => r.url().includes('/api/advice/daily') && r.request().method() === 'POST',
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: /今天怎麼樣/ }).click();
  const r = await respP;
  expect(r.status()).toBe(200);

  // toast body = j.content_md.slice(0, 300)，mock fixture 含 '今日总评' 标记
  await expect(page.getByText(/今日总评/)).toBeVisible({ timeout: 10_000 });

  const { data } = await supa.from('advice').select('*')
    .eq('user_id', OWNER_UID).eq('kind', 'daily');
  expect(data).toHaveLength(1);
});
