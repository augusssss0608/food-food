import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reserveAiBudget } from '@/lib/ai-provider/budget';
import { getAiProvider } from '@/lib/ai-provider';
import { fetchAdviceInputData } from '@/lib/ai-provider/context-builder';
import { ensureInboxForAdvice } from '@/lib/inbox/upsert';
import { trySendPushOnce } from '@/lib/cron/push';
import { scanAdviceForDanger } from '@/lib/ai-provider/danger-words';

export type ReconcileJob = {
  adviceKind: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  timezone: string;
  userId: string;
  runKey: string;
};

const WEEKS_LOOKBACK = 8;
const MONTHS_LOOKBACK = 6;

export async function findDueAdviceJobs(userId: string): Promise<ReconcileJob[]> {
  const supa = supabaseAdmin();
  const profileRes = await supa.from('profiles').select('preferred_timezone').eq('user_id', userId).single();
  const profile = profileRes.data as { preferred_timezone?: string } | null;
  const timezone = profile?.preferred_timezone ?? 'Asia/Tokyo';
  const now = DateTime.now().setZone(timezone);

  const candidates: ReconcileJob[] = [];

  for (let i = 1; i <= WEEKS_LOOKBACK; i++) {
    const weekStart = now.startOf('week').minus({ weeks: i });
    const weekEnd = weekStart.plus({ days: 6 });
    const cutoff = weekEnd.set({ hour: 22 });
    if (cutoff > now) continue;
    candidates.push({
      adviceKind: 'weekly',
      periodStart: weekStart.toISODate()!,
      periodEnd: weekEnd.toISODate()!,
      timezone,
      userId,
      runKey: `weekly:${weekStart.toISODate()}`,
    });
  }
  {
    const weekStart = now.startOf('week');
    const weekEnd = weekStart.plus({ days: 6 });
    const cutoff = weekEnd.set({ hour: 22 });
    if (cutoff <= now) {
      candidates.push({
        adviceKind: 'weekly', periodStart: weekStart.toISODate()!, periodEnd: weekEnd.toISODate()!,
        timezone, userId, runKey: `weekly:${weekStart.toISODate()}`,
      });
    }
  }

  for (let i = 1; i <= MONTHS_LOOKBACK; i++) {
    const mStart = now.startOf('month').minus({ months: i });
    const mEnd = mStart.endOf('month').startOf('day');
    const cutoff = mEnd.set({ hour: 22 });
    if (cutoff > now) continue;
    candidates.push({
      adviceKind: 'monthly',
      periodStart: mStart.toISODate()!, periodEnd: mEnd.toISODate()!,
      timezone, userId,
      runKey: `monthly:${mStart.toISODate()}`,
    });
  }

  const due: ReconcileJob[] = [];
  for (const c of candidates) {
    const [adviceRow, inboxRow, cronRunRow] = await Promise.all([
      supa.from('advice').select('id, stale').eq('user_id', c.userId)
        .eq('kind', c.adviceKind).eq('period_start', c.periodStart).maybeSingle(),
      supa.from('inbox').select('id').eq('user_id', c.userId)
        .eq('type', `${c.adviceKind}_advice_ready`)
        .eq('ref_id', `${c.adviceKind}:${c.periodStart}`).maybeSingle(),
      supa.schema('app_private').from('cron_runs').select('status')
        .eq('job_name', 'advice_catchup').eq('run_key', c.runKey)
        .eq('status', 'finished').maybeSingle(),
    ]);
    const advice = adviceRow.data as { id?: string; stale?: boolean } | null;
    const adviceMissingOrStale = !advice || advice.stale;
    const inboxMissing = !inboxRow.data;
    const cronRunNotFinished = !cronRunRow.data;
    if (adviceMissingOrStale || inboxMissing || cronRunNotFinished) due.push(c);
  }
  return due;
}

export async function reconcileAdvicePeriod(job: ReconcileJob): Promise<{ adviceId: string; inboxEnsured: boolean }> {
  const supa = supabaseAdmin();

  const { data: existing } = await supa.from('advice').select('*')
    .eq('user_id', job.userId).eq('kind', job.adviceKind).eq('period_start', job.periodStart).maybeSingle();

  let advice = existing as { id: string; stale?: boolean } | null;
  if (!advice || advice.stale) {
    const correlationId = crypto.randomUUID();
    const aiCallKind = job.adviceKind === 'weekly' ? 'weekly_advice' : 'monthly_advice';
    const { usageDate } = await reserveAiBudget(job.userId, aiCallKind);

    const { data: profileData } = await supa.from('profiles').select('*').eq('user_id', job.userId).single();
    const profile = profileData as Record<string, number | string | null> | null;
    if (!profile) throw new Error(`profile not found for ${job.userId}`);

    const inputData = await fetchAdviceInputData({
      userId: job.userId, timezone: job.timezone,
      mealsRange: { startDate: job.periodStart, endDate: job.periodEnd },
      bodyMetricsRange: { startDate: job.periodStart, endDate: job.periodEnd },
    });
    const { data: workoutDays } = await supa.from('workout_days').select('*').eq('user_id', job.userId)
      .gte('date', job.periodStart).lte('date', job.periodEnd);
    const { data: priorAdvice } = await supa.from('advice').select('content_md, period_start, generated_at')
      .eq('user_id', job.userId).eq('kind', job.adviceKind).eq('stale', false)
      .in('user_reaction', ['useful', 'applied'])
      .order('generated_at', { ascending: false })
      .limit(job.adviceKind === 'weekly' ? 2 : 1);
    const ctx = {
      period_start: job.periodStart, period_end: job.periodEnd,
      meals: inputData.meals, body_metrics: inputData.body_metrics,
      workout_days: (workoutDays ?? []) as unknown[],
      targets: {
        kcal_workout_day: (profile.kcal_workout_day as number) ?? 2400,
        kcal_rest_day: (profile.kcal_rest_day as number) ?? 2000,
        protein_g: (profile.protein_g as number) ?? 140,
        carb_workout_day: (profile.carb_workout_day as number) ?? 280,
        carb_rest_day: (profile.carb_rest_day as number) ?? 200,
        fat_g: (profile.fat_g as number) ?? 60,
        fiber_g: (profile.fiber_g as number) ?? 28,
      },
      prior_advice: (priorAdvice ?? []) as unknown[],
    };

    const provider = getAiProvider();
    const result = job.adviceKind === 'weekly'
      ? await provider.generateWeeklyAdvice(ctx, { userId: job.userId, trigger: 'cron', correlationId, kind: aiCallKind, usageDate })
      : await provider.generateMonthlyAdvice(ctx, { userId: job.userId, trigger: 'cron', correlationId, kind: aiCallKind, usageDate });

    const flagged = result.flagged ?? scanAdviceForDanger(result.content_md);

    const { data: upserted, error: upsertErr } = await supa.from('advice').upsert({
      user_id: job.userId,
      correlation_id: correlationId,
      kind: job.adviceKind,
      period_start: job.periodStart, period_end: job.periodEnd,
      period_timezone: job.timezone,
      content_md: result.content_md,
      context_json: ctx,
      stale: false, stale_at: null, stale_reason: null,
      flagged,
      flagged_reason: flagged ? 'danger_word' : null,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,kind,period_start' }).select('*').single();
    if (upsertErr) throw upsertErr;
    advice = upserted as { id: string; stale?: boolean };
  }

  await ensureInboxForAdvice(job.adviceKind, advice.id, job.userId, job.periodStart);

  await trySendPushOnce({
    userId: job.userId,
    type: `${job.adviceKind}_advice_ready` as 'weekly_advice_ready' | 'monthly_advice_ready',
    refId: `${job.adviceKind}:${job.periodStart}`,
    title: job.adviceKind === 'weekly' ? '本周建议已生成' : '本月建议已生成',
    body: '点开 App 查看',
    data: { adviceId: advice.id, periodStart: job.periodStart },
  });

  return { adviceId: advice.id, inboxEnsured: true };
}
