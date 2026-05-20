import { test, expect } from '@playwright/test';
import { OWNER_UID } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';
import { clearDraftsInBrowser, seedDraftInBrowser, readDraftsInBrowser } from './helpers/browser';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('21 draft-five-failures: route 500 触发 5 次失败 → status failed, attempts=5', async ({ page }) => {
  let hit = 0;
  await page.route('**/api/meals/log', async (route) => {
    hit++;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'forced' }),
    });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await clearDraftsInBrowser(page);

  await seedDraftInBrowser(page, {
    ownerUserId: OWNER_UID,
    payloadVersion: 1,
    status: 'pending',
  });

  // 5 次 online dispatch → 每次等 attempts 增量到位再发下一次（不依赖固定 timeout）
  for (let expectedAttempts = 1; expectedAttempts <= 5; expectedAttempts++) {
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => {
      const arr = await readDraftsInBrowser(page);
      return { status: arr[0]?.status, attempts: arr[0]?.attempts };
    }, { timeout: 10_000 }).toEqual({
      status: 'pending',
      attempts: expectedAttempts,
    });
  }

  // 第 6 次不应再 fetch，只把 attempts>=5 的 pending 标 failed
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(async () => {
    const arr = await readDraftsInBrowser(page);
    return { status: arr[0]?.status, attempts: arr[0]?.attempts };
  }, { timeout: 10_000 }).toEqual({ status: 'failed', attempts: 5 });

  expect(hit).toBe(5);
});
