// vitest 默认 jsdom env 在每个 worker 注入 window；
// cron/catchup -> supabase/admin 的 assertServerOnly 会拒。集成测在 node-like 环境跑才对。
delete (globalThis as { window?: unknown }).window;

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';

beforeAll(() => {
  process.env.MOCK_AI = '1';
  process.env.ALLOWED_USER_ID = OWNER_UID;
});

const supa = createTestAdminClient();

beforeEach(async () => {
  await supa.from('advice').delete().eq('user_id', OWNER_UID);
  await supa.from('inbox').delete().eq('user_id', OWNER_UID);
  await supa.schema('app_private').from('cron_runs').delete().eq('job_name', 'advice_catchup');
  // 清 OWNER_UID 的预算，避免 budget-cap 测试用完 cap 让 reconcile reserve 失败
  await supa.schema('app_private').from('ai_budget_daily').delete().eq('user_id', OWNER_UID);
});

describe('reconcileAdvicePeriod', () => {
  it('creates advice + inbox when both missing', async () => {
    const { reconcileAdvicePeriod } = await import('@/lib/cron/catchup');
    const result = await reconcileAdvicePeriod({
      adviceKind: 'weekly', periodStart: '2026-05-04', periodEnd: '2026-05-10',
      timezone: 'Asia/Tokyo', userId: OWNER_UID, runKey: 'weekly:2026-05-04',
    });
    expect(result.adviceId).toBeTruthy();
    const { data: advice } = await supa.from('advice').select('*').eq('user_id', OWNER_UID).eq('kind', 'weekly').single();
    expect(advice).toBeTruthy();
    const { data: inbox } = await supa.from('inbox').select('*')
      .eq('user_id', OWNER_UID).eq('type', 'weekly_advice_ready').single();
    expect(inbox).toBeTruthy();
  });

  it('repair only inbox when advice exists but inbox missing', async () => {
    await supa.from('advice').insert({
      user_id: OWNER_UID, kind: 'weekly', period_start: '2026-05-04', period_end: '2026-05-10',
      period_timezone: 'Asia/Tokyo', content_md: 'existing', stale: false,
    } as never);
    const { reconcileAdvicePeriod } = await import('@/lib/cron/catchup');
    await reconcileAdvicePeriod({
      adviceKind: 'weekly', periodStart: '2026-05-04', periodEnd: '2026-05-10',
      timezone: 'Asia/Tokyo', userId: OWNER_UID, runKey: 'weekly:2026-05-04',
    });
    const { data: advices } = await supa.from('advice').select('*').eq('user_id', OWNER_UID);
    expect(advices?.length).toBe(1);
    expect((advices?.[0] as { content_md: string }).content_md).toBe('existing');
    const { data: inbox } = await supa.from('inbox').select('*').eq('user_id', OWNER_UID);
    expect(inbox?.length).toBe(1);
  });
});

describe('findDueAdviceJobs artifact gap matrix', () => {
  beforeAll(async () => {
    await supa.from('profiles').upsert({
      user_id: OWNER_UID,
      height_cm: 175, current_weight_kg: 70, birth_date: '1996-05-19',
      sex: 'male', training_days_per_week: 3, preferred_timezone: 'Asia/Tokyo',
      kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140,
      carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28,
      targets_source: 'user_override', targets_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'user_id' });
  });

  it('advice+inbox exist but cron_runs.finished missing → period is still due', async () => {
    const { DateTime } = await import('luxon');
    const lastWeekStart = DateTime.now().setZone('Asia/Tokyo').startOf('week').minus({ weeks: 1 });
    const periodStart = lastWeekStart.toISODate()!;
    const periodEnd = lastWeekStart.plus({ days: 6 }).toISODate()!;
    const runKey = `weekly:${periodStart}`;

    await supa.from('advice').insert({
      user_id: OWNER_UID, kind: 'weekly', period_start: periodStart, period_end: periodEnd,
      period_timezone: 'Asia/Tokyo', content_md: 'pre', stale: false,
    } as never);
    await supa.from('inbox').insert({
      user_id: OWNER_UID, type: 'weekly_advice_ready', ref_id: `weekly:${periodStart}`,
      title: '本周建议已生成', body: '...', data: {},
    } as never);

    const { findDueAdviceJobs } = await import('@/lib/cron/catchup');
    const jobs = await findDueAdviceJobs(OWNER_UID);
    // eslint-disable-next-line no-console
    console.log('jobs:', jobs.length, 'expectedRunKey:', runKey, 'allRunKeys:', jobs.map((j) => j.runKey));
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.some((j) => j.runKey === runKey)).toBe(true);
  });

  it('all three artifacts present → period not due', async () => {
    const { DateTime } = await import('luxon');
    const lastWeekStart = DateTime.now().setZone('Asia/Tokyo').startOf('week').minus({ weeks: 1 });
    const periodStart = lastWeekStart.toISODate()!;
    const periodEnd = lastWeekStart.plus({ days: 6 }).toISODate()!;
    const runKey = `weekly:${periodStart}`;

    await supa.from('advice').insert({
      user_id: OWNER_UID, kind: 'weekly', period_start: periodStart, period_end: periodEnd,
      period_timezone: 'Asia/Tokyo', content_md: 'pre', stale: false,
    } as never);
    await supa.from('inbox').insert({
      user_id: OWNER_UID, type: 'weekly_advice_ready', ref_id: `weekly:${periodStart}`,
      title: '本周建议已生成', body: '...', data: {},
    } as never);
    await supa.schema('app_private').from('cron_runs').insert({
      job_name: 'advice_catchup', run_key: runKey, status: 'finished',
      locked_until: new Date(Date.now() - 1000).toISOString(),
      started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    } as never);

    const { findDueAdviceJobs } = await import('@/lib/cron/catchup');
    const jobs = await findDueAdviceJobs(OWNER_UID);
    expect(jobs.find((j) => j.runKey === runKey)).toBeFalsy();
  });
});
