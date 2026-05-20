import { test, expect } from '@playwright/test';
import { OWNER_UID } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';
import { clearDraftsInBrowser, readDraftsInBrowser } from './helpers/browser';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('18 offline-draft-create: 离线点 preset → 提示 + IndexedDB pending', async ({ page, context }) => {
  page.on('dialog', (d) => d.accept());
  // networkidle 等 supa.auth.getUser() 完成（userId 必须 set 才会走草稿分支）
  await page.goto('/', { waitUntil: 'networkidle' });
  await clearDraftsInBrowser(page);

  await context.setOffline(true);
  await page.getByRole('button', { name: /牛肉糙米饭/ }).click();
  await expect(page.getByText(/已存入本地草稿/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/草稿待同步/)).toBeVisible({ timeout: 5_000 });

  const drafts = await readDraftsInBrowser(page);
  expect(drafts).toHaveLength(1);
  expect(drafts[0]!.status).toBe('pending');
  expect(drafts[0]!.ownerUserId).toBe(OWNER_UID);
  expect(drafts[0]!.type).toBe('meal');

  await context.setOffline(false);
});
