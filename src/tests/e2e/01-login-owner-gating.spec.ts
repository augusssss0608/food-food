import { test, expect } from '@playwright/test';

test.describe('01 login-owner-gating', () => {
  // 无 storageState 的纯净 context：访问受保护路径必须跳 /login
  test('未登录访问 / 跳 /login', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.goto(`${baseURL}/`);
    expect(page.url()).toContain('/login');
    expect(res?.status()).toBeLessThan(400);
    await ctx.close();
  });

  test('未登录访问 /inbox 跳 /login', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/inbox`);
    expect(page.url()).toContain('/login');
    await ctx.close();
  });

  test('owner 已登录直接进主页（不跳 login）', async ({ page }) => {
    await page.goto('/');
    expect(page.url()).not.toContain('/login');
    await expect(page.getByRole('heading', { name: 'food-food', level: 1 })).toBeVisible();
  });
});
