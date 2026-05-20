import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, seedBodyMetric } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('15 body-overdue-inbox-dedup: 旧 body 触发 "该称重了"，同天重复 cron 只 1 条', async ({ request }) => {
  const supa = adminClient();
  // seed 一条 4 天前的 body_metric → 触发 body_metrics_overdue（route 用 72h 阈值）
  const fourDaysAgo = DateTime.now().setZone('Asia/Tokyo').minus({ days: 4 }).toISO()!;
  await seedBodyMetric({ measured_at: fourDaysAgo, weight_kg: 70 });

  const r1 = await request.get('/api/cron/catchup', { headers: cronHeaders() });
  expect(r1.status()).toBe(200);

  const r2 = await request.get('/api/cron/catchup', { headers: cronHeaders() });
  expect(r2.status()).toBe(200);

  const { data } = await supa.from('inbox').select('*')
    .eq('user_id', OWNER_UID).eq('type', 'body_metrics_overdue');
  expect(data).toHaveLength(1);
  expect((data![0] as { title: string }).title).toContain('該稱重了');
  expect((data![0] as { ref_id: string }).ref_id).toContain('body_metrics_overdue:');
});
