import { test, expect } from '@playwright/test';
import { cleanupOwnerState, ensureOwnerProfile, seedInbox } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('17 inbox-render-empty: 无 inbox 时显示 "暂无通知"', async ({ page }) => {
  await page.goto('/inbox');
  await expect(page.getByText(/暂无通知/)).toBeVisible();
});

test('17 inbox-render-read-vs-unread: read item 有 opacity-60 样式，unread 没有', async ({ page }) => {
  await seedInbox({
    type: 'weekly_advice_ready', ref_id: 'weekly:2026-05-04',
    title: '本周建议 (read)', read_at: new Date().toISOString(),
  });
  await seedInbox({
    type: 'monthly_advice_ready', ref_id: 'monthly:2026-04-01',
    title: '本月建议 (unread)', read_at: null,
  });

  await page.goto('/inbox');
  const readItem = page.locator('li', { hasText: '本周建议 (read)' });
  const unreadItem = page.locator('li', { hasText: '本月建议 (unread)' });
  await expect(readItem).toBeVisible();
  await expect(unreadItem).toBeVisible();
  await expect(readItem).toHaveClass(/opacity-60/);
  await expect(unreadItem).not.toHaveClass(/opacity-60/);
});
