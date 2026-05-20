-- seed.sql 每次 supabase db reset 都会自动跑

-- 1. owner 用户（seed 阶段插入 auth.users，本地开发用）
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, instance_id)
values ('00000000-0000-0000-0000-000000000001',
        'owner@example.com',
        crypt('localpassword', gen_salt('bf')),
        now(), now(), now(),
        'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

-- 2. 把 owner_user_id 写入 app_owner
insert into app_private.app_owner (id, owner_user_id)
values (true, '00000000-0000-0000-0000-000000000001')
on conflict (id) do update set owner_user_id = excluded.owner_user_id;

-- 3. app_config caps（spec §7.3 + §7.3.1）
insert into app_private.app_config (key, value) values
  ('ai_budget_daily_call_cap', '50'::jsonb),
  ('ai_budget_daily_cost_cap_cents', '50'::jsonb),
  ('ai_budget_monthly_fallback_cap_cents', '500'::jsonb)
on conflict (key) do update set value = excluded.value;
