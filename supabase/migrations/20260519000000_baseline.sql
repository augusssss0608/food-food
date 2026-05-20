-- ============ Step 1: extensions ============
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ============ Step 2: public tables（spec §3.7 baseline DDL）============

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm numeric,
  current_weight_kg numeric,
  birth_date date,
  sex text check (sex in ('male','female')),
  training_days_per_week smallint,
  kcal_workout_day int,
  kcal_rest_day int,
  protein_g int,
  carb_workout_day int,
  carb_rest_day int,
  fat_g int,
  fiber_g int,
  targets_source text check (targets_source in ('ai_initial','user_override','ai_adjusted')),
  targets_updated_at timestamptz,
  preferred_timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ate_at timestamptz not null,
  source text not null check (source in ('preset','photo_ai','manual')),
  preset_key text,
  dish_name text,
  kcal numeric,
  protein_g numeric,
  carb_g numeric,
  fat_g numeric,
  fiber_g numeric,
  satiety smallint check (satiety between 1 and 5),
  ai_raw_json jsonb,
  notes text,
  client_mutation_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.workout_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  is_workout boolean not null,
  marked_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric not null,
  body_fat_pct numeric,
  skeletal_muscle_pct numeric,
  visceral_fat numeric,
  bmi numeric,
  source text not null check (source in ('screenshot','manual')),
  ai_raw_json jsonb,
  client_mutation_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.advice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  correlation_id uuid,
  kind text not null check (kind in ('daily','weekly','monthly')),
  period_start date not null,
  period_end date not null,
  period_timezone text not null,
  generated_at timestamptz not null default now(),
  model text,
  prompt_version text,
  content_md text not null,
  context_json jsonb,
  user_reaction text check (user_reaction in ('useful','not_useful','applied')),
  stale boolean not null default false,
  stale_at timestamptz,
  stale_reason text,
  flagged boolean not null default false,
  flagged_reason text,
  constraint advice_user_kind_period_uk unique (user_id, kind, period_start)
);

create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('weekly_advice_ready','monthly_advice_ready','body_metrics_overdue')),
  ref_id text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint inbox_user_type_ref_uk unique (user_id, type, ref_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  fail_count int not null default 0
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  type text not null,
  ref_id text not null,
  status text not null check (status in ('sending','sent','failed','abandoned')),
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_user_channel_type_ref_uk unique (user_id, channel, type, ref_id)
);

-- ============ Step 3: app_private schema 权限准入（spec §3.5 顶部）============

create schema if not exists app_private;

revoke all on schema app_private from anon, authenticated, public;
revoke all on all tables in schema app_private from anon, authenticated, public;
revoke all on all functions in schema app_private from anon, authenticated, public;

alter default privileges in schema app_private revoke execute on functions from public;
alter default privileges in schema app_private revoke execute on functions from authenticated, anon;

grant usage on schema app_private to authenticated;
-- service_role 通过 PostgREST 调用 app_private RPC / 表时也需要 schema usage
-- （plan 漏写；表级 grant 已有，但缺 schema-level usage 会被 PostgREST 拦在 schema 入口）
grant usage on schema app_private to service_role;

-- ============ Step 4: app_private 配置 / owner 表 + owner_user_id() ============

create table app_private.app_owner (
  id boolean primary key default true,
  owner_user_id uuid not null,
  constraint single_owner check (id)
);
revoke all on app_private.app_owner from public, anon, authenticated;
grant select, insert, update, delete on app_private.app_owner to service_role;

create or replace function app_private.owner_user_id()
returns uuid language sql stable security definer
set search_path = app_private
as $$ select owner_user_id from app_owner where id = true $$;

grant execute on function app_private.owner_user_id() to authenticated, service_role;

create table app_private.app_config (
  key text primary key,
  value jsonb not null
);
revoke all on app_private.app_config from public, anon, authenticated;
grant select on app_private.app_config to service_role;

-- ============ Step 5: app_private 业务表 ============

create table app_private.app_errors (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  kind text not null,
  context jsonb not null default '{}',
  message text,
  stack text
);
create index app_errors_kind_occurred_at_idx on app_private.app_errors(kind, occurred_at desc);
revoke all on app_private.app_errors from public, anon, authenticated;
grant select, insert on app_private.app_errors to service_role;

create table app_private.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  correlation_id uuid not null,
  kind text not null check (kind in ('meal_photo','body_ocr','initial_targets','daily_advice','weekly_advice','monthly_advice')),
  trigger text not null check (trigger in ('user','cron','admin')),
  provider text not null check (provider in ('anthropic_api','claude_agent_sdk','mock')),
  model text,
  prompt_version text,
  status text not null check (status in ('started','succeeded','failed')),
  attempt int,
  input_tokens int,
  output_tokens int,
  cache_creation_input_tokens int,
  cache_read_input_tokens int,
  estimated_cost_usd numeric(12,6),
  latency_ms int,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  request_ref text
);
create unique index ai_calls_correlation_provider_uidx
  on app_private.ai_calls (correlation_id, provider);
create index ai_calls_user_started_at_idx on app_private.ai_calls (user_id, started_at desc);
create index ai_calls_correlation_idx on app_private.ai_calls (correlation_id);
create index ai_calls_month_cost_idx
  on app_private.ai_calls (user_id, started_at)
  where provider = 'anthropic_api' and status = 'succeeded';
revoke all on app_private.ai_calls from public, anon, authenticated;
grant select, insert, update, delete on app_private.ai_calls to service_role;

create table app_private.ai_budget_daily (
  user_id uuid not null,
  usage_date date not null,
  call_count int not null default 0,
  estimated_cost_cents int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);
revoke all on app_private.ai_budget_daily from public, anon, authenticated;
grant select, insert, update, delete on app_private.ai_budget_daily to service_role;

create table app_private.ai_budget_monthly_fallback (
  user_id uuid not null,
  usage_month date not null,
  estimated_cost_cents int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_month)
);
revoke all on app_private.ai_budget_monthly_fallback from public, anon, authenticated;
grant select, insert, update, delete on app_private.ai_budget_monthly_fallback to service_role;

create table app_private.cron_runs (
  job_name text not null,
  run_key text not null,
  locked_until timestamptz not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text default 'running',
  result jsonb default '{}',
  primary key (job_name, run_key)
);
revoke all on app_private.cron_runs from public, anon, authenticated;
grant select, insert, update, delete on app_private.cron_runs to service_role;

-- ============ Step 6: app_private RPCs ============

create or replace function app_private.try_reserve_ai_budget(
  p_user_id uuid,
  p_estimated_cost_cents int,
  out ok boolean,
  out usage_date date
) language plpgsql security definer set search_path = app_private as $$
#variable_conflict use_column
declare
  today_utc date := (now() at time zone 'UTC')::date;
  call_cap int;
  cost_cap int;
  row_call_count int;
  row_cost int;
begin
  select (value::text)::int into call_cap from app_config where key = 'ai_budget_daily_call_cap';
  select (value::text)::int into cost_cap from app_config where key = 'ai_budget_daily_cost_cap_cents';

  if call_cap is null or cost_cap is null then
    raise exception 'ai_budget_daily caps not configured (seed app_config first)';
  end if;

  insert into ai_budget_daily(user_id, usage_date) values (p_user_id, today_utc)
    on conflict (user_id, usage_date) do nothing;

  select call_count, estimated_cost_cents into row_call_count, row_cost
    from ai_budget_daily
    where ai_budget_daily.user_id = p_user_id and ai_budget_daily.usage_date = today_utc
    for update;

  if row_call_count + 1 > call_cap then ok := false; usage_date := today_utc; return; end if;
  if row_cost + p_estimated_cost_cents > cost_cap then ok := false; usage_date := today_utc; return; end if;

  update ai_budget_daily
    set call_count = call_count + 1,
        estimated_cost_cents = estimated_cost_cents + p_estimated_cost_cents,
        updated_at = now()
    where ai_budget_daily.user_id = p_user_id and ai_budget_daily.usage_date = today_utc;

  ok := true; usage_date := today_utc;
end; $$;

grant execute on function app_private.try_reserve_ai_budget(uuid, int) to service_role;

create or replace function app_private.settle_ai_budget(
  p_user_id uuid,
  p_usage_date date,
  p_estimated_cost_cents int,
  p_actual_cost_cents int
) returns void language plpgsql security definer set search_path = app_private as $$
declare
  delta int := p_actual_cost_cents - p_estimated_cost_cents;
begin
  update ai_budget_daily
    set estimated_cost_cents = greatest(0, estimated_cost_cents + delta),
        updated_at = now()
    where user_id = p_user_id and usage_date = p_usage_date;
end; $$;

grant execute on function app_private.settle_ai_budget(uuid, date, int, int) to service_role;

create or replace function app_private.try_reserve_fallback_monthly_cap(
  p_user_id uuid,
  p_estimated_cost_cents int,
  out ok boolean,
  out usage_month date
) language plpgsql security definer set search_path = app_private as $$
#variable_conflict use_column
declare
  current_month date := date_trunc('month', (now() at time zone 'UTC')::date)::date;
  cap int;
  row_cost int;
begin
  select (value::text)::int into cap from app_config where key = 'ai_budget_monthly_fallback_cap_cents';

  if cap is null then
    raise exception 'ai_budget_monthly_fallback_cap_cents not configured (seed app_config first)';
  end if;

  insert into ai_budget_monthly_fallback(user_id, usage_month) values (p_user_id, current_month)
    on conflict (user_id, usage_month) do nothing;

  select estimated_cost_cents into row_cost
    from ai_budget_monthly_fallback
    where ai_budget_monthly_fallback.user_id = p_user_id and ai_budget_monthly_fallback.usage_month = current_month
    for update;

  if row_cost + p_estimated_cost_cents > cap then ok := false; usage_month := current_month; return; end if;

  update ai_budget_monthly_fallback
    set estimated_cost_cents = estimated_cost_cents + p_estimated_cost_cents,
        updated_at = now()
    where ai_budget_monthly_fallback.user_id = p_user_id and ai_budget_monthly_fallback.usage_month = current_month;

  ok := true; usage_month := current_month;
end; $$;

grant execute on function app_private.try_reserve_fallback_monthly_cap(uuid, int) to service_role;

create or replace function app_private.settle_fallback_monthly_cap(
  p_user_id uuid,
  p_usage_month date,
  p_estimated_cost_cents int,
  p_actual_cost_cents int
) returns void language plpgsql security definer set search_path = app_private as $$
declare
  delta int := p_actual_cost_cents - p_estimated_cost_cents;
begin
  update ai_budget_monthly_fallback
    set estimated_cost_cents = greatest(0, estimated_cost_cents + delta),
        updated_at = now()
    where user_id = p_user_id and usage_month = p_usage_month;
end; $$;

grant execute on function app_private.settle_fallback_monthly_cap(uuid, date, int, int) to service_role;

create or replace function app_private.try_start_cron_run(
  p_job_name text, p_run_key text, p_lock_seconds int default 900
) returns boolean language plpgsql security definer
set search_path = app_private as $$
begin
  insert into app_private.cron_runs(job_name, run_key, locked_until)
  values (p_job_name, p_run_key, now() + make_interval(secs => p_lock_seconds))
  on conflict (job_name, run_key) do update set
    locked_until = excluded.locked_until,
    started_at = now(),
    status = 'running'
  where cron_runs.locked_until < now() or cron_runs.status in ('failed', 'finished');
  return found;
end; $$;

grant execute on function app_private.try_start_cron_run(text, text, int) to service_role;

create or replace function app_private.finish_cron_run(
  p_job_name text,
  p_run_key text,
  p_status text,
  p_result jsonb default '{}'
) returns void language plpgsql security definer
set search_path = app_private as $$
begin
  update app_private.cron_runs
    set finished_at = now(),
        status = p_status,
        result = coalesce(p_result, '{}'::jsonb)
    where job_name = p_job_name and run_key = p_run_key;
end; $$;

grant execute on function app_private.finish_cron_run(text, text, text, jsonb) to service_role;

-- ============ Step 7: indexes（public 表的剩余索引）============

create index meals_user_ate_at_idx on public.meals(user_id, ate_at desc);
create unique index meals_user_client_mutation_id_uidx
  on public.meals(user_id, client_mutation_id);

create index body_metrics_user_measured_at_idx on public.body_metrics(user_id, measured_at desc);
create unique index body_metrics_user_client_mutation_id_uidx
  on public.body_metrics(user_id, client_mutation_id);

create index advice_correlation_idx on public.advice(correlation_id) where correlation_id is not null;
create index advice_user_kind_generated_idx on public.advice(user_id, kind, generated_at desc);

create index inbox_user_created_idx on public.inbox(user_id, created_at desc);
create index inbox_user_unread_idx on public.inbox(user_id) where read_at is null;

-- ============ Step 8: triggers（spec §7.7 advice stale trigger）============

create or replace function public.mark_advice_period_stale(
  p_user_id uuid, p_ate_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare
  tz text;
  local_ts timestamp;
  week_start date;
  month_start date;
begin
  if p_user_id is null or p_ate_at is null then return; end if;
  select preferred_timezone into tz from public.profiles where user_id = p_user_id;
  tz := coalesce(tz, 'Asia/Tokyo');
  local_ts := p_ate_at at time zone tz;
  week_start := date_trunc('week', local_ts)::date;
  month_start := date_trunc('month', local_ts)::date;
  update public.advice
    set stale = true, stale_at = now(), stale_reason = 'meal_changed'
    where user_id = p_user_id
      and kind in ('weekly', 'monthly')
      and ((kind = 'weekly' and period_start = week_start)
           or (kind = 'monthly' and period_start = month_start))
      and stale = false;
end; $$;

create or replace function public.mark_advice_stale_for_meal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform mark_advice_period_stale(new.user_id, new.ate_at);
  elsif tg_op = 'DELETE' then
    perform mark_advice_period_stale(old.user_id, old.ate_at);
  elsif tg_op = 'UPDATE' then
    perform mark_advice_period_stale(old.user_id, old.ate_at);
    if new.ate_at is distinct from old.ate_at then
      perform mark_advice_period_stale(new.user_id, new.ate_at);
    end if;
    if new.user_id is distinct from old.user_id then
      perform mark_advice_period_stale(new.user_id, new.ate_at);
    end if;
  end if;
  return coalesce(new, old);
end; $$;

create trigger meals_mark_advice_stale
  after insert or update or delete on public.meals
  for each row execute function public.mark_advice_stale_for_meal();

-- 扩展：workout_days / body_metrics / profile.targets 改动也标 stale
create or replace function public.mark_advice_stale_for_workout()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  tz text;
begin
  -- coalesce 让 profile 行缺失时仍按 Asia/Tokyo 走（spec 默认时区）
  if tg_op = 'INSERT' then
    uid := new.user_id;
    select coalesce(preferred_timezone, 'Asia/Tokyo') into tz from public.profiles where user_id = uid;
    tz := coalesce(tz, 'Asia/Tokyo');
    perform mark_advice_period_stale(uid, (new.date::timestamp at time zone tz));
  elsif tg_op = 'DELETE' then
    uid := old.user_id;
    select coalesce(preferred_timezone, 'Asia/Tokyo') into tz from public.profiles where user_id = uid;
    tz := coalesce(tz, 'Asia/Tokyo');
    perform mark_advice_period_stale(uid, (old.date::timestamp at time zone tz));
  elsif tg_op = 'UPDATE' then
    -- UPDATE 时分别标 old 和 new 的 period（date 跨周/月时旧 period 也要 stale）
    select coalesce(preferred_timezone, 'Asia/Tokyo') into tz from public.profiles where user_id = old.user_id;
    tz := coalesce(tz, 'Asia/Tokyo');
    perform mark_advice_period_stale(old.user_id, (old.date::timestamp at time zone tz));
    if new.date is distinct from old.date or new.user_id is distinct from old.user_id then
      select coalesce(preferred_timezone, 'Asia/Tokyo') into tz from public.profiles where user_id = new.user_id;
      tz := coalesce(tz, 'Asia/Tokyo');
      perform mark_advice_period_stale(new.user_id, (new.date::timestamp at time zone tz));
    end if;
  end if;
  return coalesce(new, old);
end; $$;

create trigger workout_days_mark_advice_stale
  after insert or update or delete on public.workout_days
  for each row execute function public.mark_advice_stale_for_workout();

create or replace function public.mark_advice_stale_for_body()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform mark_advice_period_stale(new.user_id, new.measured_at);
  elsif tg_op = 'DELETE' then
    perform mark_advice_period_stale(old.user_id, old.measured_at);
  elsif tg_op = 'UPDATE' then
    perform mark_advice_period_stale(old.user_id, old.measured_at);
    if new.measured_at is distinct from old.measured_at or new.user_id is distinct from old.user_id then
      perform mark_advice_period_stale(new.user_id, new.measured_at);
    end if;
  end if;
  return coalesce(new, old);
end; $$;

create trigger body_metrics_mark_advice_stale
  after insert or update or delete on public.body_metrics
  for each row execute function public.mark_advice_stale_for_body();

create or replace function public.mark_advice_stale_for_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE') and (
    new.kcal_workout_day is distinct from old.kcal_workout_day or
    new.kcal_rest_day is distinct from old.kcal_rest_day or
    new.protein_g is distinct from old.protein_g or
    new.carb_workout_day is distinct from old.carb_workout_day or
    new.carb_rest_day is distinct from old.carb_rest_day or
    new.fat_g is distinct from old.fat_g or
    new.fiber_g is distinct from old.fiber_g or
    new.targets_source is distinct from old.targets_source
  ) then
    perform mark_advice_period_stale(new.user_id, now());
  end if;
  return coalesce(new, old);
end; $$;

create trigger profiles_targets_mark_advice_stale
  after update on public.profiles
  for each row execute function public.mark_advice_stale_for_profile();

-- 安全 revoke：所有 stale trigger function 不允许被 RPC 调用
revoke all on function public.mark_advice_period_stale(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_advice_stale_for_meal() from public, anon, authenticated;
revoke all on function public.mark_advice_stale_for_workout() from public, anon, authenticated;
revoke all on function public.mark_advice_stale_for_body() from public, anon, authenticated;
revoke all on function public.mark_advice_stale_for_profile() from public, anon, authenticated;

-- ============ Step 9: RLS policies（spec §6.5 双层兜底）============

-- 模板：每张 public 表都启用 RLS + 双层 policy
do $$
declare
  t text;
  user_tables text[] := array['profiles','meals','workout_days','body_metrics','advice','inbox','push_subscriptions','notification_deliveries'];
begin
  foreach t in array user_tables loop
    execute format('alter table public.%I enable row level security', t);

    -- self policy
    execute format($f$
      create policy %I_self on public.%I
        for all to authenticated
        using ((select auth.uid()) is not null and (select auth.uid()) = %I)
        with check ((select auth.uid()) is not null and (select auth.uid()) = %I)
    $f$, t, t, case when t = 'profiles' then 'user_id' else 'user_id' end,
            case when t = 'profiles' then 'user_id' else 'user_id' end);

    -- restrictive owner policy
    execute format($f$
      create policy %I_owner_only on public.%I
        as restrictive for all to authenticated
        using ((select auth.uid()) is not null and (select auth.uid()) = app_private.owner_user_id())
        with check ((select auth.uid()) is not null and (select auth.uid()) = app_private.owner_user_id())
    $f$, t, t);
  end loop;
end $$;

-- ============ Step 10: seed 的 schema 占位（实际值在 seed.sql）============
-- 注：app_config 的 cap 值 + app_owner.owner_user_id 在 seed.sql 写
