import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  process.env.SUPABASE_SECRET_KEY_ADMIN!,
  { auth: { persistSession: false } },
);

test('04-weekly-advice-inbox: cron 后 inbox 出现 weekly_advice_ready', async ({ page, request }) => {
  const cronSecret = process.env.CRON_SECRET ?? 'dev-cron-secret';
  const cronRes = await request.get('/api/cron/catchup', {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  expect([200, 204]).toContain(cronRes.status());

  const ownerId = process.env.ALLOWED_USER_ID!;
  const { data } = await admin.from('inbox').select('*')
    .eq('user_id', ownerId).eq('type', 'weekly_advice_ready');
  expect((data ?? []).length).toBeGreaterThanOrEqual(1);

  await page.goto('/inbox');
  await expect(page.getByText(/本周建议/).first()).toBeVisible();
});
