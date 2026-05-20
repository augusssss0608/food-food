import { test, expect } from '@playwright/test';
import { cleanupOwnerState, ensureOwnerProfile, seedInbox } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('17 inbox-render-empty: 无 inbox 时显示空态文案', async ({ page }) => {
  await page.goto('/inbox');
  await expect(page.getByText(/什麼都沒發生/)).toBeVisible();
});

test('17 inbox-render-read-vs-unread: read item 有 opacity-55 样式，unread 没有', async ({ page }) => {
  await seedInbox({
    type: 'weekly_advice_ready', ref_id: 'weekly:2026-05-04',
    title: '本週建議 (read)', read_at: new Date().toISOString(),
  });
  await seedInbox({
    type: 'monthly_advice_ready', ref_id: 'monthly:2026-04-01',
    title: '本月建議 (unread)', read_at: null,
  });

  await page.goto('/inbox');
  const readItem = page.locator('li', { hasText: '本週建議 (read)' });
  const unreadItem = page.locator('li', { hasText: '本月建議 (unread)' });
  await expect(readItem).toBeVisible();
  await expect(unreadItem).toBeVisible();
  // UI overhaul 后 Card 用 opacity-55（read）/ 无（unread）
  await expect(readItem.locator('div').first()).toHaveClass(/opacity-55/);
  await expect(unreadItem.locator('div').first()).not.toHaveClass(/opacity-55/);
});
