import { test, expect } from '@playwright/test';

test('05-offline-draft: 离线点击健身餐 → 草稿提示出现', async ({ page, context }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await context.setOffline(true);
  await page.getByRole('button', { name: /牛肉糙米饭/ }).click();
  await expect(page.getByText(/已存入本地草稿/)).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText(/草稿待同步/)).toBeVisible();
  await context.setOffline(false);
});
