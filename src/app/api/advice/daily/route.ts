import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { reserveAiBudget } from '@/lib/ai-provider/budget';
import { getAiProvider, AIError } from '@/lib/ai-provider';
import { fetchAdviceInputData } from '@/lib/ai-provider/context-builder';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { scanAdviceForDanger } from '@/lib/ai-provider/danger-words';
import { writeAppError } from '@/lib/errors/app-errors';

const Body = z.object({ date: z.string().optional() });

type ProfileRow = {
  preferred_timezone?: string;
  kcal_workout_day?: number;
  kcal_rest_day?: number;
  protein_g?: number;
  carb_workout_day?: number;
  carb_rest_day?: number;
  fat_g?: number;
  fiber_g?: number;
};

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    const body = Body.parse(await req.json());

    const supa = supabaseAdmin();
    const { data: profileData } = await supa.from('profiles').select('*').eq('user_id', userId).single();
    const profile = profileData as ProfileRow | null;
    if (!profile) return NextResponse.json({ error: 'profile not found; run /setup first' }, { status: 400 });

    const tz = profile.preferred_timezone ?? 'Asia/Tokyo';
    const targetDate = body.date ?? DateTime.now().setZone(tz).toISODate()!;

    const correlationId = crypto.randomUUID();
    const { usageDate } = await reserveAiBudget(userId, 'daily_advice');

    const { data: workoutToday } = await supa.from('workout_days').select('is_workout')
      .eq('user_id', userId).eq('date', targetDate).maybeSingle();
    const isWorkout = (workoutToday as { is_workout?: boolean } | null)?.is_workout ?? false;

    const sevenDaysAgo = DateTime.fromISO(targetDate).minus({ days: 6 }).toISODate()!;
    const inputData = await fetchAdviceInputData({
      userId, timezone: tz,
      mealsRange: { startDate: targetDate, endDate: targetDate },
      bodyMetricsRange: { startDate: sevenDaysAgo, endDate: targetDate },
    });

    const ctx = {
      date: targetDate,
      is_workout: isWorkout,
      targets: {
        kcal_workout_day: profile.kcal_workout_day ?? 2400,
        kcal_rest_day: profile.kcal_rest_day ?? 2000,
        protein_g: profile.protein_g ?? 140,
        carb_workout_day: profile.carb_workout_day ?? 280,
        carb_rest_day: profile.carb_rest_day ?? 200,
        fat_g: profile.fat_g ?? 60,
        fiber_g: profile.fiber_g ?? 28,
      },
      meals: inputData.meals,
      body_metrics: inputData.body_metrics,
    };

    const provider = getAiProvider();
    const result = await provider.generateDailyAdvice(ctx, { userId, trigger: 'user', correlationId, kind: 'daily_advice', usageDate });

    const flagged = result.flagged ?? scanAdviceForDanger(result.content_md);
    const { data: advice, error: upErr } = await supa.from('advice').upsert({
      user_id: userId,
      correlation_id: correlationId,
      kind: 'daily',
      period_start: targetDate, period_end: targetDate,
      period_timezone: tz,
      content_md: result.content_md,
      context_json: ctx,
      stale: false, stale_at: null, stale_reason: null,
      flagged,
      flagged_reason: flagged ? 'danger_word' : null,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,kind,period_start' }).select('*').single();
    if (upErr) throw upErr;

    return NextResponse.json({ adviceId: (advice as { id: string }).id, content_md: result.content_md, flagged, _meta: result._meta });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AIError && e.category === 'rate_limit') return NextResponse.json({ error: '今日 AI 預算已用完' }, { status: 429 });
    if (e instanceof AIError) return NextResponse.json({ error: 'AI 不可用，請稍後重試', category: e.category }, { status: 502 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'ai_call', message: err.message, stack: err.stack });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export const maxDuration = 60;
