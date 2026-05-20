import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, relaxAiBudgetForCronRun } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('13 monthly-cron-inbox: cron 触发 → monthly advice + inbox + 页面显示', async ({ page, request }) => {
  const supa = adminClient();
  // service_role 没 app_config update 权限，改用预 seed budget 行让 cron 跑完整 catchup
  await relaxAiBudgetForCronRun();

  const r = await request.get('/api/cron/catchup', { headers: cronHeaders() });
  expect(r.status()).toBe(200);
  const cronJson = await r.json();
  // 必须有 monthly runKey 走完，不能让 budget/AI 失败混着通过
  expect(cronJson.results.some((x: { runKey: string; status: string }) =>
    x.runKey.startsWith('monthly:') && x.status === 'finished',
  )).toBe(true);

  const { data: advice } = await supa.from('advice').select('*')
    .eq('user_id', OWNER_UID).eq('kind', 'monthly');
  expect((advice ?? []).length).toBeGreaterThanOrEqual(1);
  expect((advice![0] as { content_md: string }).content_md).toContain('本月总评');

  const { data: inbox } = await supa.from('inbox').select('*')
    .eq('user_id', OWNER_UID).eq('type', 'monthly_advice_ready');
  expect((inbox ?? []).length).toBeGreaterThanOrEqual(1);

  await page.goto('/inbox');
  await expect(page.getByText(/本月建議/).first()).toBeVisible();
});
