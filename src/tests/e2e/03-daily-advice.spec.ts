import { test, expect } from '@playwright/test';

test('03-daily-advice: 点"今天怎么样" → alert 显示建议片段', async ({ page }) => {
  await page.goto('/');
  const dialogP = page.waitForEvent('dialog', { timeout: 10_000 });
  await page.getByRole('button', { name: /今天怎么样/ }).click();
  const dialog = await dialogP;
  expect(dialog.message().length).toBeGreaterThan(10);
  await dialog.accept();
});
