-- User custom meal presets + home snapshot extension.
-- 用户自定义菜单 + load_home_snapshot RPC 多返回 customPresets / recentPhotoMeals。

create table if not exists public.user_meal_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kcal numeric not null check (kcal >= 0 and kcal <= 5000),
  protein_g numeric not null default 0 check (protein_g >= 0 and protein_g <= 500),
  carb_g numeric not null default 0 check (carb_g >= 0 and carb_g <= 1000),
  fat_g numeric not null default 0 check (fat_g >= 0 and fat_g <= 500),
  fiber_g numeric not null default 0 check (fiber_g >= 0 and fiber_g <= 200),
  source_meal_id uuid null references public.meals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint user_meal_presets_name_not_blank check (nullif(btrim(name), '') is not null)
);

-- 防大小寫 / 連續空白導致重複名（v1 物理刪除，不做 partial unique；v2 軟刪除時遷移）
create unique index if not exists user_meal_presets_user_normalized_name_uidx
  on public.user_meal_presets (
    user_id,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
  );

create index if not exists user_meal_presets_user_created_idx
  on public.user_meal_presets(user_id, created_at desc);

create index if not exists user_meal_presets_user_active_created_idx
  on public.user_meal_presets(user_id, created_at desc)
  where deleted_at is null;

-- updated_at trigger（v1 不寫入 update，但 grant update 已開放未來 v2 編輯）
create or replace function public.user_meal_presets_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.user_meal_presets_set_updated_at() from public, anon, authenticated;

drop trigger if exists user_meal_presets_touch_updated_at on public.user_meal_presets;
create trigger user_meal_presets_touch_updated_at
  before update on public.user_meal_presets
  for each row execute function public.user_meal_presets_set_updated_at();

-- RLS：self（owner 看 / 寫自己的）+ restrictive owner（強制 app_owner = auth.uid()）
alter table public.user_meal_presets enable row level security;

drop policy if exists user_meal_presets_self on public.user_meal_presets;
create policy user_meal_presets_self on public.user_meal_presets
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists user_meal_presets_owner_only on public.user_meal_presets;
create policy user_meal_presets_owner_only on public.user_meal_presets
  as restrictive for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = app_private.owner_user_id())
  with check ((select auth.uid()) is not null and (select auth.uid()) = app_private.owner_user_id());

grant select, insert, update, delete on table public.user_meal_presets to authenticated;

-- 重寫 load_home_snapshot：加 customPresets[] / recentPhotoMeals[]
create or replace function public.load_home_snapshot(p_tz text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_tz text;
  v_local_date date;
  v_start_utc timestamptz;
  v_end_utc timestamptz;
  v_meals jsonb;
  v_custom_presets jsonb;
  v_recent_photo_meals jsonb;
  v_is_workout boolean;
  v_workout_marked boolean;
begin
  if v_uid is null then
    return null;
  end if;

  select *
    into v_profile
  from public.profiles
  where user_id = v_uid;

  if not found then
    return null;
  end if;

  select name
    into v_tz
  from pg_timezone_names
  where name = nullif(btrim(p_tz), '')
  limit 1;

  if v_tz is null then
    select name
      into v_tz
    from pg_timezone_names
    where name = nullif(btrim(v_profile.preferred_timezone), '')
    limit 1;
  end if;

  v_tz := coalesce(v_tz, 'Asia/Tokyo');
  v_local_date := (now() at time zone v_tz)::date;
  v_start_utc := v_local_date::timestamp at time zone v_tz;
  v_end_utc := (v_local_date + 1)::timestamp at time zone v_tz;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'ate_at', m.ate_at,
    'source', m.source,
    'dish_name', m.dish_name,
    'kcal', m.kcal,
    'protein_g', m.protein_g,
    'carb_g', m.carb_g,
    'fat_g', m.fat_g,
    'fiber_g', m.fiber_g,
    'satiety', m.satiety
  ) order by m.ate_at desc), '[]'::jsonb)
    into v_meals
  from public.meals m
  where m.user_id = v_uid
    and m.ate_at >= v_start_utc
    and m.ate_at < v_end_utc;

  -- customPresets：最多 50 條，按 created_at desc
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'kcal', p.kcal,
    'protein_g', p.protein_g,
    'carb_g', p.carb_g,
    'fat_g', p.fat_g,
    'fiber_g', p.fiber_g,
    'created_at', p.created_at
  ) order by p.created_at desc, p.id desc), '[]'::jsonb)
    into v_custom_presets
  from (
    select *
    from public.user_meal_presets
    where user_id = v_uid
      and deleted_at is null
    order by created_at desc, id desc
    limit 50
  ) p;

  -- recentPhotoMeals：30 天窗口、source=photo_ai、macros 完整、normalized name 去重、最多 10 條
  select coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'meal_id', r.id,
        'dish_name', r.dish_name,
        'kcal', r.kcal,
        'protein_g', r.protein_g,
        'carb_g', r.carb_g,
        'fat_g', r.fat_g,
        'fiber_g', r.fiber_g,
        'created_at', r.created_at
      )
      order by r.created_at desc, r.id desc
    )
    from (
      select d.*
      from (
        select distinct on (n.norm_name)
          m.id,
          btrim(m.dish_name) as dish_name,
          m.kcal,
          m.protein_g,
          m.carb_g,
          m.fat_g,
          coalesce(m.fiber_g, 0) as fiber_g,
          m.created_at,
          n.norm_name
        from public.meals m
        cross join lateral (
          select lower(regexp_replace(btrim(m.dish_name), '[[:space:]]+', ' ', 'g')) as norm_name
        ) n
        where m.user_id = v_uid
          and m.source = 'photo_ai'
          and m.created_at >= now() - interval '30 days'
          and m.dish_name is not null
          and nullif(btrim(m.dish_name), '') is not null
          and m.kcal is not null
          and m.protein_g is not null
          and m.carb_g is not null
          and m.fat_g is not null
        order by n.norm_name, m.created_at desc, m.id desc
      ) d
      order by d.created_at desc, d.id desc
      limit 10
    ) r
  ), '[]'::jsonb)
    into v_recent_photo_meals;

  select w.is_workout
    into v_is_workout
  from public.workout_days w
  where w.user_id = v_uid
    and w.date = v_local_date;

  v_workout_marked := found;
  v_is_workout := coalesce(v_is_workout, false);

  return jsonb_build_object(
    'meals', v_meals,
    'customPresets', v_custom_presets,
    'recentPhotoMeals', v_recent_photo_meals,
    'timezone', v_tz,
    'todayDate', v_local_date::text,
    'workoutMarked', v_workout_marked,
    'isWorkoutDay', v_is_workout,
    'targets', case
      when not v_workout_marked then jsonb_build_object('kcal', 0, 'protein_g', 0, 'carb_g', 0, 'fat_g', 0)
      when v_is_workout then jsonb_build_object(
        'kcal', coalesce(v_profile.kcal_workout_day, 0),
        'protein_g', coalesce(v_profile.protein_g, 0),
        'carb_g', coalesce(v_profile.carb_workout_day, 0),
        'fat_g', coalesce(v_profile.fat_g, 0)
      )
      else jsonb_build_object(
        'kcal', coalesce(v_profile.kcal_rest_day, 0),
        'protein_g', coalesce(v_profile.protein_g, 0),
        'carb_g', coalesce(v_profile.carb_rest_day, 0),
        'fat_g', coalesce(v_profile.fat_g, 0)
      )
    end,
    'targetOptions', jsonb_build_object(
      'workout', jsonb_build_object(
        'kcal', coalesce(v_profile.kcal_workout_day, 0),
        'protein_g', coalesce(v_profile.protein_g, 0),
        'carb_g', coalesce(v_profile.carb_workout_day, 0),
        'fat_g', coalesce(v_profile.fat_g, 0)
      ),
      'rest', jsonb_build_object(
        'kcal', coalesce(v_profile.kcal_rest_day, 0),
        'protein_g', coalesce(v_profile.protein_g, 0),
        'carb_g', coalesce(v_profile.carb_rest_day, 0),
        'fat_g', coalesce(v_profile.fat_g, 0)
      ),
      'empty', jsonb_build_object('kcal', 0, 'protein_g', 0, 'carb_g', 0, 'fat_g', 0)
    )
  );
end;
$$;

revoke all on function public.load_home_snapshot(text) from public, anon;
grant execute on function public.load_home_snapshot(text) to authenticated, service_role;

notify pgrst, 'reload schema';
