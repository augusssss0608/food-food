import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { DateTime } from 'luxon';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

// upsert workout_days：用戶在主頁標記某天是訓練日 / 休息日。
// 觸發 mark_advice_stale_for_workout 自動把對應 period 的 advice 標 stale。
//
// date 驗證（codex review hardening）：
// - 必須 YYYY-MM-DD 格式
// - 必須是真實日歷日期（拒 2026-02-31 這種正則符合但 luxon parse fail 的）
// - 寫入窗口：UTC 今天 ± 寬鬆範圍（過去 2 年到未來 30 天）。防止表 bloat / 把
//   advice trigger 標到完全無意義的 period（mark_advice_stale_for_workout）
function isValidWriteDate(s: string): boolean {
  const dt = DateTime.fromISO(s, { zone: 'utc' });
  if (!dt.isValid) return false;
  const today = DateTime.utc().startOf('day');
  // 用 calendar year 語義，避免閏年 ±1 天偏差（codex round B 建議）
  const min = today.minus({ years: 2 });
  const max = today.plus({ days: 30 });
  return dt >= min && dt <= max;
}

const Body = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .refine(isValidWriteDate, 'date out of supported range or invalid calendar date'),
  is_workout: z.boolean(),
}).strict();

export async function POST(req: Request) {
  let userIdForLog: string | undefined;
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    userIdForLog = userId;
    const body = Body.parse(await req.json());

    const { error } = await supabaseAdmin()
      .from('workout_days')
      .upsert(
        {
          user_id: userId,
          date: body.date,
          is_workout: body.is_workout,
          marked_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id,date' },
      );

    if (error) {
      await writeAppError({
        kind: 'workout_day_set', message: error.message,
        context: { date: body.date, userId, is_workout: body.is_workout },
      });
      return NextResponse.json({ error: 'upsert failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof ZodError) return NextResponse.json({ error: 'bad request', issues: e.issues }, { status: 400 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({
      kind: 'workout_day_set', message: err.message, stack: err.stack,
      context: { userId: userIdForLog },
    });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
