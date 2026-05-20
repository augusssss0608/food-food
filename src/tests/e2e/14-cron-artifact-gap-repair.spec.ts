import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, seedAdvice } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('14 cron-artifact-gap-repair: 已有 advice 但缺 inbox/cron_run → 补 inbox，不重生 advice', async ({ request }) => {
  const supa = adminClient();
  // seed 上周 weekly advice，标记 content_md 为已知字符串，验证 cron 不会重生（不会覆盖 content）
  const lastWeekStart = DateTime.now().setZone('Asia/Tokyo').startOf('week').minus({ weeks: 1 });
  const periodStart = lastWeekStart.toISODate()!;
  const periodEnd = lastWeekStart.plus({ days: 6 }).toISODate()!;
  const KEEP = 'seeded-no-rewrite-marker';
  await seedAdvice({ kind: 'weekly', period_start: periodStart, period_end: periodEnd, content_md: KEEP });

  const r = await request.get('/api/cron/catchup', { headers: cronHeaders() });
  expect(r.status()).toBe(200);

  // advice 仍只 1 条，content_md 没被重生覆盖
  const { data: advice } = await supa.from('advice').select('*')
    .eq('user_id', OWNER_UID).eq('kind', 'weekly').eq('period_start', periodStart);
  expect(advice).toHaveLength(1);
  expect((advice![0] as { content_md: string }).content_md).toBe(KEEP);

  // inbox 被补
  const { data: inbox } = await supa.from('inbox').select('*')
    .eq('user_id', OWNER_UID).eq('type', 'weekly_advice_ready').eq('ref_id', `weekly:${periodStart}`);
  expect(inbox).toHaveLength(1);

  // cron_runs finished
  const { data: runs } = await supa.schema('app_private').from('cron_runs').select('*')
    .eq('job_name', 'advice_catchup').eq('run_key', `weekly:${periodStart}`).eq('status', 'finished');
  expect((runs ?? []).length).toBeGreaterThanOrEqual(1);
});
