import { test, expect } from '@playwright/test';
import { DEV_SECRET } from './helpers/supabase';

/**
 * /api/dev/export 受 middleware 保护（不在 PUBLIC_PATHS），且 route 内还会 fresh 校验 owner。
 * 无 owner cookie 时不应靠 DEV_SECRET 单点绕过 → 必须 redirect /login 或 401。
 */
test('35 dev-export-unauthenticated: 无 owner cookie + 正确 secret 仍不返 200，不泄表', async ({ browser, baseURL }) => {
  void baseURL;
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const r = await ctx.request.get('/api/dev/export', {
    headers: { 'x-dev-secret': DEV_SECRET },
    maxRedirects: 0,
  });
  expect(r.status()).not.toBe(200);
  // middleware 会 redirect → 30x；route fresh 校验失败 → 401
  expect([301, 302, 303, 307, 308, 401, 403]).toContain(r.status());

  if (r.status() === 200) {
    // 二次保险：即使返了 200 也绝不能含 tables（防数据泄露）
    const body = await r.text();
    expect(body).not.toContain('"tables"');
  }
  await ctx.close();
});
