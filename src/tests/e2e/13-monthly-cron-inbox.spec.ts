import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, relaxAiBudgetForCronRun } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('13 monthly-cron-disabled: catchup 不再產出 monthly job', async ({ request }) => {
  const supa = adminClient();
  await relaxAiBudgetForCronRun();

  const r = await request.get('/api/cron/catchup', { headers: cronHeaders() });
  expect(r.status()).toBe(200);
  const cronJson = await r.json();
  expect(cronJson.results.some((x: { runKey: string }) =>
    x.runKey.startsWith('monthly:'),
  )).toBe(false);

  const { data: advice } = await supa.from('advice').select('id')
    .eq('user_id', OWNER_UID).eq('kind', 'monthly');
  expect((advice ?? []).length).toBe(0);

  const { data: inbox } = await supa.from('inbox').select('id')
    .eq('user_id', OWNER_UID).eq('type', 'monthly_advice_ready');
  expect((inbox ?? []).length).toBe(0);
});
