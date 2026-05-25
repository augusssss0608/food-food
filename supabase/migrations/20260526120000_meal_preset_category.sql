-- 加 category 列到 user_meal_presets，支持用户自定义分类。
-- 老数据 category=null（属于「未分类」，UI 上 mode strip 不显示）。
-- 部署后我们会手动 DELETE 测试数据，所以不做迁移填值。

alter table public.user_meal_presets
  add column if not exists category text null;

-- category 长度约束：1-30 char（trim 后）；允许 null（无分类）
alter table public.user_meal_presets
  drop constraint if exists user_meal_presets_category_length;
alter table public.user_meal_presets
  add constraint user_meal_presets_category_length
  check (category is null or (char_length(btrim(category)) between 1 and 30));

-- 索引：mode strip 派发 + 卡片过滤（category 非空、未软删）
create index if not exists user_meal_presets_user_category_idx
  on public.user_meal_presets(user_id, category)
  where deleted_at is null and category is not null;

-- 重写 load_home_snapshot 把 category 加进 customPresets jsonb
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

  -- customPresets：最多 50 條，按 created_at desc；新增 category 字段
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'category', p.category,
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
