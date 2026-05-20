import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';
import { mockPushApi } from './helpers/browser';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('23 push-subscribe-mocked-api: mock Push API → 真实 fetch /api/push/subscribe → DB 写入 → 刷新显示已开启', async ({ page }) => {
  const supa = adminClient();
  const endpoint = 'https://push.test.local/sub/23-e2e';
  await mockPushApi(page, { permission: 'granted', endpoint });

  await page.goto('/');
  // 点 "开启推送通知" 触发 register / requestPermission / fetch manifest / subscribe / POST /api/push/subscribe
  const subResp = page.waitForResponse(
    (r) => r.url().includes('/api/push/subscribe') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /開啟推送/ }).click();
  const r = await subResp;
  expect(r.status()).toBe(200);
  expect((await r.json()).ok).toBe(true);

  await expect(page.getByText(/推送已開啟/)).toBeVisible({ timeout: 5_000 });

  const { data } = await supa.from('push_subscriptions').select('*').eq('user_id', OWNER_UID);
  expect(data).toHaveLength(1);
  expect((data![0] as { endpoint: string }).endpoint).toBe(endpoint);
  expect((data![0] as { p256dh: string }).p256dh).toBe('p256dh-e2e');

  // 关键：reload 后 getSubscription() 应从持久化状态读出已订阅，UI 仍显示 "推送已开启"
  await page.reload();
  await expect(page.getByText(/推送已開啟/)).toBeVisible({ timeout: 5_000 });
});
