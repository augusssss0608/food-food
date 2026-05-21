-- Snapshot RPCs for SSR/SWR loaders.
-- Collapse profile + page data queries into one PostgREST RPC round trip.
-- All functions are SECURITY INVOKER and use auth.uid(); RLS remains authoritative.
-- Timezone resolution: p_tz (cookie fast-path) → profile.preferred_timezone → 'Asia/Tokyo'.

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

  select w.is_workout
    into v_is_workout
  from public.workout_days w
  where w.user_id = v_uid
    and w.date = v_local_date;

  v_workout_marked := found;
  v_is_workout := coalesce(v_is_workout, false);

  return jsonb_build_object(
    'meals', v_meals,
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

create or replace function public.load_history_meals(
  p_local_date date default null,
  p_tz text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_tz text;
  v_tz text;
  v_today_date date;
  v_date date;
  v_start_utc timestamptz;
  v_end_utc timestamptz;
  v_meals jsonb;
  v_advice jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select name
    into v_tz
  from pg_timezone_names
  where name = nullif(btrim(p_tz), '')
  limit 1;

  if v_tz is null then
    select preferred_timezone
      into v_profile_tz
    from public.profiles
    where user_id = v_uid;

    select name
      into v_tz
    from pg_timezone_names
    where name = nullif(btrim(v_profile_tz), '')
    limit 1;
  end if;

  v_tz := coalesce(v_tz, 'Asia/Tokyo');
  v_today_date := (now() at time zone v_tz)::date;
  v_date := coalesce(p_local_date, v_today_date);

  if v_date > v_today_date then
    v_date := v_today_date;
  end if;

  v_start_utc := v_date::timestamp at time zone v_tz;
  v_end_utc := (v_date + 1)::timestamp at time zone v_tz;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'ate_at', m.ate_at,
    'source', m.source,
    'dish_name', m.dish_name,
    'kcal', m.kcal
  ) order by m.ate_at asc), '[]'::jsonb)
    into v_meals
  from public.meals m
  where m.user_id = v_uid
    and m.ate_at >= v_start_utc
    and m.ate_at < v_end_utc;

  select to_jsonb(a)
    into v_advice
  from (
    select content_md, generated_at, stale
    from public.advice
    where user_id = v_uid
      and kind = 'daily'
      and period_start = v_date
    limit 1
  ) a;

  return jsonb_build_object(
    'timezone', v_tz,
    'date', v_date::text,
    'todayDate', v_today_date::text,
    'meals', v_meals,
    'advice', v_advice
  );
end;
$$;

create or replace function public.load_body_snapshot(p_tz text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_tz text;
  v_tz text;
  v_window_start timestamptz;
  v_rows jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select name
    into v_tz
  from pg_timezone_names
  where name = nullif(btrim(p_tz), '')
  limit 1;

  if v_tz is null then
    select preferred_timezone
      into v_profile_tz
    from public.profiles
    where user_id = v_uid;

    select name
      into v_tz
    from pg_timezone_names
    where name = nullif(btrim(v_profile_tz), '')
    limit 1;
  end if;

  v_tz := coalesce(v_tz, 'Asia/Tokyo');
  v_window_start := (((now() at time zone v_tz)::date - 90)::timestamp at time zone v_tz);

  select coalesce(jsonb_agg(jsonb_build_object(
    'measured_at', b.measured_at,
    'weight_kg', b.weight_kg,
    'body_fat_pct', b.body_fat_pct,
    'skeletal_muscle_pct', b.skeletal_muscle_pct,
    'visceral_fat', b.visceral_fat,
    'bmi', b.bmi
  ) order by b.measured_at asc), '[]'::jsonb)
    into v_rows
  from public.body_metrics b
  where b.user_id = v_uid
    and b.measured_at >= v_window_start;

  return jsonb_build_object(
    'rows', v_rows,
    'timezone', v_tz,
    'windowStartUtc', v_window_start
  );
end;
$$;

revoke all on function public.load_home_snapshot(text) from public, anon;
revoke all on function public.load_history_meals(date, text) from public, anon;
revoke all on function public.load_body_snapshot(text) from public, anon;

grant execute on function public.load_home_snapshot(text) to authenticated, service_role;
grant execute on function public.load_history_meals(date, text) to authenticated, service_role;
grant execute on function public.load_body_snapshot(text) to authenticated, service_role;

notify pgrst, 'reload schema';
