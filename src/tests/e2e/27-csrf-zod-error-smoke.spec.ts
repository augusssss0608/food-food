import { test, expect } from '@playwright/test';

test.describe('27 csrf-zod-error-smoke', () => {
  test('cross-origin POST /api/meals/log → 403 (CsrfError，确认打到 route 而非 middleware redirect)', async ({ page }) => {
    await page.goto('/');
    const r = await page.request.post('/api/meals/log', {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
        'origin': 'https://evil.example.com',
        'sec-fetch-site': 'cross-site',
      },
      data: { ate_at: new Date().toISOString(), source: 'preset', preset_key: 'beef_rice' },
    });
    expect(r.status()).toBe(403);
    // route 直接返 'forbidden' 文本；middleware redirect 会返 HTML
    const body = await r.text();
    expect(body).toBe('forbidden');
  });

  test('缺 Idempotency-Key → 400', async ({ page }) => {
    await page.goto('/');
    const r = await page.request.post('/api/meals/log', {
      headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
      data: { ate_at: new Date().toISOString(), source: 'preset', preset_key: 'beef_rice' },
    });
    expect(r.status()).toBe(400);
  });

  test('bad body (Zod fail：缺 image_base64) → 400', async ({ page }) => {
    await page.goto('/');
    // body/extract 有显式 ZodError → 400 分支（meals/log 没有，会走 500）
    const r = await page.request.post('/api/body/extract', {
      headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
      data: {},  // 缺 image_base64
    });
    expect(r.status()).toBe(400);
  });
});
