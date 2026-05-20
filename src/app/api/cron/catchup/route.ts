import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { findDueAdviceJobs, reconcileAdvicePeriod } from '@/lib/cron/catchup';
import { tryStartCronRun, finishCronRun } from '@/lib/cron/lock';
import { trySendPushOnce } from '@/lib/cron/push';
import { writeAppError } from '@/lib/errors/app-errors';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const ownerId = process.env.ALLOWED_USER_ID!;
  const results: Array<{ runKey: string; status: 'finished' | 'failed' | 'skipped'; error?: string }> = [];

  try {
    const jobs = await findDueAdviceJobs(ownerId);
    for (const job of jobs) {
      const got = await tryStartCronRun('advice_catchup', job.runKey);
      if (!got) { results.push({ runKey: job.runKey, status: 'skipped' }); continue; }
      try {
        const r = await reconcileAdvicePeriod(job);
        await finishCronRun('advice_catchup', job.runKey, 'finished', { adviceId: r.adviceId });
        results.push({ runKey: job.runKey, status: 'finished' });
      } catch (e: unknown) {
        const err = e as { message?: string; stack?: string };
        await finishCronRun('advice_catchup', job.runKey, 'failed', { error: err.message });
        await writeAppError({ kind: 'cron', message: err.message, stack: err.stack, context: { runKey: job.runKey } });
        results.push({ runKey: job.runKey, status: 'failed', error: err.message });
      }
    }

    await checkBodyMetricsOverdue(ownerId);

    return NextResponse.json({ processed: results.length, results });
  } catch (e: unknown) {
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'cron', message: err.message, stack: err.stack });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export const maxDuration = 60;

async function checkBodyMetricsOverdue(userId: string): Promise<void> {
  const supa = supabaseAdmin();
  const { data: profile } = await supa.from('profiles').select('preferred_timezone').eq('user_id', userId).single();
  const tz = (profile as { preferred_timezone?: string } | null)?.preferred_timezone ?? 'Asia/Tokyo';
  const now = DateTime.now().setZone(tz);
  const localToday = now.toISODate();

  const { data: latest } = await supa.from('body_metrics').select('measured_at')
    .eq('user_id', userId).order('measured_at', { ascending: false }).limit(1).maybeSingle();
  const lastMeasured = (latest as { measured_at?: string } | null)?.measured_at ?? null;
  if (lastMeasured) {
    const diffH = now.diff(DateTime.fromISO(lastMeasured)).as('hours');
    if (diffH <= 72) return;
  }

  const refId = `body_metrics_overdue:${localToday}`;
  const { data: existing } = await supa.from('inbox').select('id')
    .eq('user_id', userId).eq('type', 'body_metrics_overdue').eq('ref_id', refId).maybeSingle();
  if (existing) return;

  await supa.from('inbox').insert({
    user_id: userId,
    type: 'body_metrics_overdue',
    ref_id: refId,
    title: '该称重了',
    body: '已经 3 天没记录体重',
    data: { type: 'body_metrics_overdue', lastMeasuredAt: lastMeasured },
  });

  await trySendPushOnce({
    userId, type: 'body_metrics_overdue', refId,
    title: '该称重了', body: '已经 3 天没记录体重', data: { lastMeasuredAt: lastMeasured ?? null },
  });
}
