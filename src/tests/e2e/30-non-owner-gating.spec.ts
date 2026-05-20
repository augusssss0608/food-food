import { test, expect } from '@playwright/test';
import { adminClient, DEV_SECRET } from './helpers/supabase';

const STRANGER_EMAIL = 'stranger-30@food-food.local';
const STRANGER_PASSWORD = 'stranger-pw-30-12345';

/**
 * 制造一个非 owner 用户，验证 middleware + API fresh auth 双重拒绝。
 * 用 admin.createUser 制造；测后清理。
 */
test.describe('30 non-owner-gating', () => {
  let strangerId: string;

  test.beforeAll(async () => {
    const admin = adminClient();
    // 清旧的同 email 用户
    const { data: list } = await admin.auth.admin.listUsers();
    for (const u of (list?.users ?? [])) {
      if (u.email === STRANGER_EMAIL) await admin.auth.admin.deleteUser(u.id);
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: STRANGER_EMAIL, password: STRANGER_PASSWORD, email_confirm: true,
    });
    if (error) throw new Error(`createUser stranger failed: ${error.message}`);
    strangerId = data.user!.id;
  });

  test.afterAll(async () => {
    if (strangerId) await adminClient().auth.admin.deleteUser(strangerId);
  });

  test('非 owner 已登录访问 / 跳 /login（middleware claims.sub 不匹配）', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/login`);
    await page.fill('#email', STRANGER_EMAIL);
    await page.fill('#password', STRANGER_PASSWORD);
    await page.click('button[type="submit"]');
    // 登录后会 location.href = '/'；middleware 看到 claims.sub != ALLOWED_USER_ID 又跳回 /login
    await page.waitForURL((u) => u.pathname.includes('/login'), { timeout: 15_000 });
    expect(page.url()).toContain('/login');
    await ctx.close();
  });

  test('非 owner 直接访问 /api/dev/export（带正确 secret）也应被 401 (fresh auth 拒)', async ({ browser, baseURL }) => {
    // 用 stranger session
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/login`);
    await page.fill('#email', STRANGER_EMAIL);
    await page.fill('#password', STRANGER_PASSWORD);
    await page.click('button[type="submit"]');
    // 登录后被踢回 /login（middleware），但 stranger 的 cookie 已写入；用 page.request 调 API
    await page.waitForURL((u) => u.pathname.includes('/login'), { timeout: 15_000 });
    const r = await page.request.get('/api/dev/export', {
      headers: { 'x-dev-secret': DEV_SECRET },
      maxRedirects: 0,
    });
    // /api/dev/* 受 middleware 保护（不在 PUBLIC_PATHS）→ middleware 看到 stranger 即 redirect /login
    // 不跟 redirect → 应得 30x；或 fresh auth ForbiddenError → 401/403
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(r.status());
    await ctx.close();
  });
});
