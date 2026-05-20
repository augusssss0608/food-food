import { test, expect } from '@playwright/test';

test('28 pwa-manifest-sw-smoke: manifest 字段 + SW 可注册 + sw.js 含必备监听', async ({ page, request }) => {
  // manifest 内容
  const m = await request.get('/manifest.json');
  expect(m.status()).toBe(200);
  const manifest = await m.json();
  expect(manifest.start_url).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);

  // SW 可被浏览器注册
  await page.goto('/');
  const swOk = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return !!reg.active || !!reg.installing || !!reg.waiting;
  });
  expect(swOk).toBe(true);

  // sw.js 静态文件包含 push / notificationclick / openWindow('/inbox')
  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  const swText = await sw.text();
  expect(swText).toContain("addEventListener('push'");
  expect(swText).toContain("addEventListener('notificationclick'");
  expect(swText).toContain("openWindow('/inbox')");
});
