import { test, expect } from '@playwright/test';
import { OWNER_UID } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';
import { clearDraftsInBrowser, seedDraftInBrowser, readDraftsInBrowser } from './helpers/browser';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('20 draft-payload-version-gate: payloadVersion=99 → 同步时 mark failed，不发 POST', async ({ page }) => {
  let postHit = 0;
  await page.route('**/api/meals/log', async (route) => {
    postHit++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mealId: 'unexpected' }) });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await clearDraftsInBrowser(page);

  await seedDraftInBrowser(page, {
    ownerUserId: OWNER_UID,
    payloadVersion: 99,
    status: 'pending',
  });

  // 触发一次 sync
  await page.evaluate(() => window.dispatchEvent(new Event('online')));

  await expect.poll(async () => {
    const arr = await readDraftsInBrowser(page);
    return arr[0]?.status;
  }, { timeout: 10_000 }).toBe('failed');

  const drafts = await readDraftsInBrowser(page);
  expect(drafts[0]!.lastError).toMatch(/unsupported payload version/);
  expect(postHit).toBe(0);
});
