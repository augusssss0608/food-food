import { test, expect } from '@playwright/test';
import { OWNER_UID, adminClient, cronHeaders } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, seedPushSubscription, relaxAiBudgetForCronRun } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('24 push-delivery-dedup-failed: 真 VAPID + fake endpoint → failed delivery 单行 dedup + attempts +1', async ({ request }) => {
  const endpoint = 'https://127.0.0.1:1/e2e-push-fail-24';
  await seedPushSubscription(endpoint);
  await relaxAiBudgetForCronRun();
  const supa = adminClient();

  {
    const r1 = await request.get('/api/cron/catchup', { headers: cronHeaders() });
    expect(r1.status()).toBe(200);

    const { data: rows } = await supa.from('notification_deliveries').select('*')
      .eq('user_id', OWNER_UID).eq('channel', 'web_push').eq('status', 'failed');
    expect((rows ?? []).length).toBeGreaterThanOrEqual(1);
    const picked = rows![0] as { type: string; ref_id: string; attempts: number };
    expect(picked.attempts).toBe(1);

    const { data: sub1 } = await supa.from('push_subscriptions')
      .select('fail_count').eq('endpoint', endpoint).single();
    expect((sub1 as { fail_count: number }).fail_count).toBeGreaterThanOrEqual(1);

    // 强制同 runKey 重新 due → 第二次 cron 应该再发一次同一 (type/ref_id) push，
    // 验证 notification_deliveries 不插重复行（unique key 命中），而是 attempts +1
    await supa.schema('app_private').from('cron_runs')
      .delete().eq('job_name', 'advice_catchup').eq('run_key', picked.ref_id);

    const r2 = await request.get('/api/cron/catchup', { headers: cronHeaders() });
    expect(r2.status()).toBe(200);

    const { data: exact } = await supa.from('notification_deliveries').select('*')
      .eq('user_id', OWNER_UID).eq('channel', 'web_push')
      .eq('type', picked.type).eq('ref_id', picked.ref_id);
    expect(exact).toHaveLength(1);
    expect((exact![0] as { status: string }).status).toBe('failed');
    expect((exact![0] as { attempts: number }).attempts).toBe(2);

    const { data: sub2 } = await supa.from('push_subscriptions')
      .select('fail_count').eq('endpoint', endpoint).single();
    expect((sub2 as { fail_count: number }).fail_count).toBeGreaterThanOrEqual(2);
  }
});
