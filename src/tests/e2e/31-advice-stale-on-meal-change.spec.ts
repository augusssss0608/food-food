import { test, expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { adminClient } from './helpers/supabase';
import { cleanupOwnerState, ensureOwnerProfile, seedAdvice } from './helpers/db';

test.beforeEach(async () => {
  await cleanupOwnerState();
  await ensureOwnerProfile();
});

test('31 advice-stale-on-meal-change: 记 meal 后对应 period advice trigger 标 stale=true', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  // seed 上周 weekly advice + 上月 monthly advice，初始 stale=false
  const now = DateTime.now().setZone('Asia/Tokyo');
  const lastWeekStart = now.startOf('week').minus({ weeks: 1 });
  const lastWeekEnd = lastWeekStart.plus({ days: 6 });
  const lastMonthStart = now.startOf('month').minus({ months: 1 });
  const lastMonthEnd = lastMonthStart.endOf('month').startOf('day');

  // 这次测的是 "记今天的 meal 后，包含今天的 period 的 advice 变 stale"
  // 所以 seed 当前周和当前月的 advice
  const thisWeekStart = now.startOf('week');
  const thisWeekEnd = thisWeekStart.plus({ days: 6 });
  const thisMonthStart = now.startOf('month');
  const thisMonthEnd = thisMonthStart.endOf('month').startOf('day');

  const weeklyId = await seedAdvice({
    kind: 'weekly',
    period_start: thisWeekStart.toISODate()!,
    period_end: thisWeekEnd.toISODate()!,
    stale: false,
  });
  const monthlyId = await seedAdvice({
    kind: 'monthly',
    period_start: thisMonthStart.toISODate()!,
    period_end: thisMonthEnd.toISODate()!,
    stale: false,
  });

  // 不引用 lastWeek 等，保持声明清洁
  void lastWeekEnd; void lastMonthEnd;

  // 通过 UI 真实记一餐（preset），ate_at 是 now → trigger mark_advice_stale_for_meal 触发
  await page.goto('/');
  const respP = page.waitForResponse(
    (r) => r.url().includes('/api/meals/log') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /牛肉糙米饭/ }).click();
  await respP;

  // poll 等 trigger 把对应 advice 标 stale
  const supa = adminClient();
  await expect.poll(async () => {
    const { data } = await supa.from('advice').select('id, stale').eq('id', weeklyId).single();
    return (data as { stale: boolean }).stale;
  }, { timeout: 5_000 }).toBe(true);
  await expect.poll(async () => {
    const { data } = await supa.from('advice').select('id, stale').eq('id', monthlyId).single();
    return (data as { stale: boolean }).stale;
  }, { timeout: 5_000 }).toBe(true);
});
