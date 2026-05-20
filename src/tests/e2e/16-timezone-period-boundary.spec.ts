import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
});

test('16 timezone-period-boundary: 改 profile timezone → cron period 按该 timezone 计算', async ({ request }) => {
  const TZ = 'America/New_York';
  await ensureOwnerProfile({ preferred_timezone: TZ });

  const r = await request.get('/api/cron/catchup', { headers: cronHeaders() });
  expect(r.status()).toBe(200);

  const supa = adminClient();
  const { data } = await supa.from('advice').select('*').eq('user_id', OWNER_UID);
  expect((data ?? []).length).toBeGreaterThanOrEqual(1);
  // 所有生成的 advice.period_timezone 都应该用新 tz
  for (const row of data!) {
    expect((row as { period_timezone: string }).period_timezone).toBe(TZ);
  }

  // weekly 期 ref_id 应该按 NY 时区算（NY 周一 vs Tokyo 周一可能差 1 天）
  const nyLastWeek = DateTime.now().setZone(TZ).startOf('week').minus({ weeks: 1 }).toISODate()!;
  const { data: inbox } = await supa.from('inbox').select('*')
    .eq('user_id', OWNER_UID).eq('type', 'weekly_advice_ready').eq('ref_id', `weekly:${nyLastWeek}`);
  expect((inbox ?? []).length).toBeGreaterThanOrEqual(1);
});
