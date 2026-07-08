import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, relaxAiBudgetForCronRun } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('12 weekly-cron-inbox: cron 触发后 weekly advice + inbox + cron_runs finished', async ({ page, request }) => {
  const supa = adminClient();
  // service_role 没 app_config update 权限，改用预 seed budget 行让累加不触发 cap
  await relaxAiBudgetForCronRun();

  const cronRes = await request.get('/api/cron/catchup', { headers: cronHeaders() });
  expect(cronRes.status()).toBe(200);
  const cronJson = await cronRes.json();
  expect(cronJson).toHaveProperty('processed');
  expect(Array.isArray(cronJson.results)).toBe(true);

  // 必须断言上周 weekly runKey 走完 finished（防止 budget/AI 失败混着通过）
  const lastWeekStart = DateTime.now().setZone('Asia/Tokyo').startOf('week').minus({ weeks: 1 }).toISODate();
  const targetRunKey = `weekly:${lastWeekStart}`;
  expect(cronJson.results.some((x: { runKey: string; status: string }) =>
    x.runKey === targetRunKey && x.status === 'finished',
  )).toBe(true);

  const { data: advice } = await supa.from('advice').select('*')
    .eq('user_id', OWNER_UID).eq('kind', 'weekly');
  expect((advice ?? []).length).toBeGreaterThanOrEqual(1);

  const { data: inbox } = await supa.from('inbox').select('*')
    .eq('user_id', OWNER_UID).eq('type', 'weekly_advice_ready');
  expect((inbox ?? []).length).toBeGreaterThanOrEqual(1);

  const { data: runs } = await supa.schema('app_private').from('cron_runs').select('*')
    .eq('job_name', 'advice_catchup').eq('status', 'finished');
  expect((runs ?? []).length).toBeGreaterThanOrEqual(1);

  await page.goto('/inbox');
  await expect(page.getByText(/週建議已生成/).first()).toBeVisible();
});
