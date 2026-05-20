import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';
import { mockPushApi } from './helpers/browser';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('22 push-permission-denied: Notification.permission=denied → 显示拒绝文案，不写 DB', async ({ page }) => {
  await mockPushApi(page, { permission: 'denied' });
  await page.goto('/');

  await expect(page.getByText(/通知權限被拒/)).toBeVisible({ timeout: 5_000 });

  const supa = adminClient();
  const { data } = await supa.from('push_subscriptions').select('*').eq('user_id', OWNER_UID);
  expect(data ?? []).toHaveLength(0);
});
