import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, exhaustAiBudget } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('11 daily-advice-budget-exhausted: 预算 cap 后点击 → 429 + 显示限额错误，不写 advice', async ({ page }) => {
  // try_reserve_ai_budget 按 UTC 当天行累加，必须用 UTC ISO date
  const todayUtc = DateTime.utc().toISODate()!;
  await exhaustAiBudget(todayUtc, 50);

  const supa = adminClient();
  await page.goto('/');

  const respP = page.waitForResponse(
    (r) => r.url().includes('/api/advice/daily') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /今天怎麼樣/ }).click();
  const r = await respP;
  expect(r.status()).toBe(429);
  expect((await r.json()).error).toContain('預算');

  // toast.error 应展示错误文案
  await expect(page.getByText(/預算已用完|AI 預算/)).toBeVisible({ timeout: 5_000 });

  // 没有 advice 被写入
  const { data } = await supa.from('advice').select('*')
    .eq('user_id', OWNER_UID).eq('kind', 'daily');
  expect(data ?? []).toHaveLength(0);
});
