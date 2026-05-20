import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, seedAdvice, seedInbox } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('32 cron-regenerates-stale-advice: stale advice 被重生，content/correlation/generated_at 更新', async ({ request }) => {
  const supa = adminClient();
  // 抬 cap，避免 budget 影响（catchup 跑完整 lookback）
  await supa.schema('app_private').from('app_config')
    .update({ value: 10000 } as never).eq('key', 'ai_budget_daily_cost_cap_cents');

  try {
    const lastWeekStart = DateTime.now().setZone('Asia/Tokyo').startOf('week').minus({ weeks: 1 });
    const periodStart = lastWeekStart.toISODate()!;
    const periodEnd = lastWeekStart.plus({ days: 6 }).toISODate()!;
    const STALE_MARKER = 'stale-content-should-be-replaced';

    // seed stale advice + inbox（让 cron 触发"stale → 重生"分支）
    await seedAdvice({
      kind: 'weekly', period_start: periodStart, period_end: periodEnd,
      content_md: STALE_MARKER, stale: true,
    });
    await seedInbox({
      type: 'weekly_advice_ready', ref_id: `weekly:${periodStart}`,
      title: '本周建议已生成', body: '', read_at: null,
    });

    const r = await request.get('/api/cron/catchup', { headers: cronHeaders() });
    expect(r.status()).toBe(200);

    // advice 应被重生：stale=false，content_md 不再是 STALE_MARKER
    const { data: rows } = await supa.from('advice').select('*')
      .eq('user_id', OWNER_UID).eq('kind', 'weekly').eq('period_start', periodStart);
    expect(rows).toHaveLength(1);
    const row = rows![0] as { stale: boolean; content_md: string; correlation_id: string | null };
    expect(row.stale).toBe(false);
    expect(row.content_md).not.toBe(STALE_MARKER);
    expect(row.content_md).toContain('本周总评');  // mock 返回的标记
    expect(row.correlation_id).toBeTruthy();

    // inbox 仍唯一（不重复 insert）
    const { data: inbox } = await supa.from('inbox').select('*')
      .eq('user_id', OWNER_UID).eq('type', 'weekly_advice_ready').eq('ref_id', `weekly:${periodStart}`);
    expect(inbox).toHaveLength(1);
  } finally {
    await supa.schema('app_private').from('app_config')
      .update({ value: 50 } as never).eq('key', 'ai_budget_daily_cost_cap_cents');
  }
});
