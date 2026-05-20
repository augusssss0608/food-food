import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';
import { clearDraftsInBrowser, readDraftsInBrowser } from './helpers/browser';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('19 offline-draft-reconnect-sync: 离线写草稿 → 上线自动同步 → DB +1', async ({ page, context }) => {
  // 注：原版本含 offline 状态下 page.reload()，但当前 sw.js 无 fetch/app-shell cache，
  // 离线 reload 会导航失败，那不是产品承诺路径。真正业务价值是"离线不丢 + 上线同步"。
  page.on('dialog', (d) => d.accept());
  const supa = adminClient();

  await page.goto('/', { waitUntil: 'networkidle' });
  await clearDraftsInBrowser(page);

  await context.setOffline(true);
  await page.getByRole('button', { name: /牛肉糙米饭/ }).click();
  await expect(page.getByText(/離線已暫存/)).toBeVisible({ timeout: 10_000 });
  const drafts = await readDraftsInBrowser(page);
  expect(drafts).toHaveLength(1);
  expect(drafts[0]!.status).toBe('pending');
  expect((drafts[0]!.payload as { endpoint: string }).endpoint).toBe('/api/meals/log');

  // 上线 → page.tsx 'online' listener 会调 syncDrafts
  const logResp = page.waitForResponse(
    (r) => r.url().includes('/api/meals/log') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  const r = await logResp;
  expect(r.status()).toBe(200);

  await expect.poll(async () => {
    const arr = await readDraftsInBrowser(page);
    return arr[0]?.status;
  }, { timeout: 10_000 }).toBe('synced');

  const { data } = await supa.from('meals').select('*').eq('user_id', OWNER_UID);
  expect(data).toHaveLength(1);
  expect((data![0] as { source: string }).source).toBe('preset');
});
