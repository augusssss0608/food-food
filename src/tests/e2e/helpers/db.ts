import { OWNER_UID, adminClient } from './supabase';

const PROFILE_DEFAULT = {
  user_id: OWNER_UID,
  height_cm: 175, current_weight_kg: 70, birth_date: '1996-05-19',
  sex: 'male' as const, training_days_per_week: 3,
  kcal_workout_day: 2400, kcal_rest_day: 2000, protein_g: 140,
  carb_workout_day: 280, carb_rest_day: 200, fat_g: 60, fiber_g: 28,
  targets_source: 'user_override' as const,
  preferred_timezone: 'Asia/Tokyo',
};

/** 清 owner 范围 + app_private 测试状态。spec beforeEach 用，确保从已知状态起。 */
export async function cleanupOwnerState(): Promise<void> {
  const supa = adminClient();
  await supa.from('meals').delete().eq('user_id', OWNER_UID);
  await supa.from('body_metrics').delete().eq('user_id', OWNER_UID);
  await supa.from('advice').delete().eq('user_id', OWNER_UID);
  await supa.from('inbox').delete().eq('user_id', OWNER_UID);
  await supa.from('workout_days').delete().eq('user_id', OWNER_UID);
  await supa.from('push_subscriptions').delete().eq('user_id', OWNER_UID);
  await supa.from('notification_deliveries').delete().eq('user_id', OWNER_UID);
  await supa.schema('app_private').from('ai_budget_daily').delete().eq('user_id', OWNER_UID);
  await supa.schema('app_private').from('ai_budget_monthly_fallback').delete().eq('user_id', OWNER_UID);
  await supa.schema('app_private').from('cron_runs').delete().eq('job_name', 'advice_catchup');
  await supa.schema('app_private').from('ai_calls').delete().eq('user_id', OWNER_UID);
}

/** 重新 upsert owner profile 到默认值。spec 改了 profile 后用来还原。 */
export async function ensureOwnerProfile(overrides: Partial<typeof PROFILE_DEFAULT> = {}): Promise<void> {
  await adminClient().from('profiles').upsert({
    ...PROFILE_DEFAULT, ...overrides,
    targets_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never, { onConflict: 'user_id' });
}

/** 删 profile（02 setup-initial-targets spec 用） */
export async function deleteOwnerProfile(): Promise<void> {
  await adminClient().from('profiles').delete().eq('user_id', OWNER_UID);
}

export type AdviceKind = 'daily' | 'weekly' | 'monthly';

export async function seedAdvice(input: {
  kind: AdviceKind;
  period_start: string;
  period_end: string;
  content_md?: string;
  timezone?: string;
  stale?: boolean;
}): Promise<string> {
  const { data, error } = await adminClient().from('advice').insert({
    user_id: OWNER_UID,
    kind: input.kind,
    period_start: input.period_start,
    period_end: input.period_end,
    period_timezone: input.timezone ?? 'Asia/Tokyo',
    content_md: input.content_md ?? `seeded ${input.kind} ${input.period_start}`,
    stale: input.stale ?? false,
  } as never).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function seedInbox(input: {
  type: 'weekly_advice_ready' | 'monthly_advice_ready' | 'body_metrics_overdue';
  ref_id: string;
  title?: string;
  body?: string;
  read_at?: string | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await adminClient().from('inbox').insert({
    user_id: OWNER_UID,
    type: input.type,
    ref_id: input.ref_id,
    title: input.title ?? 'seeded',
    body: input.body ?? '',
    data: input.data ?? {},
    read_at: input.read_at ?? null,
  } as never);
  if (error) throw error;
}

export async function seedBodyMetric(input: {
  measured_at: string;
  weight_kg?: number;
  client_mutation_id?: string;
}): Promise<void> {
  const { error } = await adminClient().from('body_metrics').insert({
    user_id: OWNER_UID,
    measured_at: input.measured_at,
    weight_kg: input.weight_kg ?? 70,
    source: 'manual',
    ai_raw_json: null,
    client_mutation_id: input.client_mutation_id ?? crypto.randomUUID(),
  } as never);
  if (error) throw error;
}

export async function seedPushSubscription(endpoint = 'https://127.0.0.1:1/e2e-push'): Promise<void> {
  const { error } = await adminClient().from('push_subscriptions').upsert({
    user_id: OWNER_UID,
    endpoint,
    p256dh: 'p256dh-e2e',
    auth: 'auth-e2e',
    user_agent: 'playwright',
  } as never, { onConflict: 'endpoint' });
  if (error) throw error;
}

/** 把 AI 预算预占到 cap，模拟"今天已用完"。
 *  schema 真实字段：call_count / estimated_cost_cents（不是 reserved/actual）；
 *  try_reserve_ai_budget 以 UTC 当天 row 累加，所以 usageDate 必须传 UTC ISO date。
 *  daily preEstimate=3c，capCents=50 让 50+3>50 稳定进 429。
 */
export async function exhaustAiBudget(usageDate: string, capCents = 50): Promise<void> {
  const { error } = await adminClient().schema('app_private').from('ai_budget_daily').upsert({
    user_id: OWNER_UID,
    usage_date: usageDate,
    call_count: 0,
    estimated_cost_cents: capCents,
  } as never, { onConflict: 'user_id,usage_date' });
  if (error) throw error;
}

/**
 * 给 budget 留余地，让 cron 跑完整 lookback（8 weekly × 8c = 64c）不被 cap=50 拦。
 * 通过预 seed 大负数 estimated_cost_cents 实现（service_role 不能改 app_config，只能改 ai_budget_daily）。
 */
export async function relaxAiBudgetForCronRun(): Promise<void> {
  const usageDateUtc = new Date().toISOString().slice(0, 10);
  const { error } = await adminClient().schema('app_private').from('ai_budget_daily').upsert({
    user_id: OWNER_UID,
    usage_date: usageDateUtc,
    call_count: 0,
    estimated_cost_cents: -1000,
  } as never, { onConflict: 'user_id,usage_date' });
  if (error) throw error;
}
