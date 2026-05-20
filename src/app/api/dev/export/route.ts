import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { supabaseAdmin } from '@/lib/supabase/admin';

function timingSafeStringEq(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

export async function GET(req: Request) {
  try {
    // 第一道：owner session（middleware 已挡，这里 fresh 验证）
    const { userId } = await requireAllowedUser({ fresh: true });

    // 第二道：DEV_SECRET（timing-safe compare）
    const provided = req.headers.get('x-dev-secret') ?? '';
    const expected = process.env.DEV_SECRET ?? '';
    if (!expected || !timingSafeStringEq(provided, expected)) {
      return new NextResponse('forbidden (dev_secret)', { status: 403 });
    }

    const supa = supabaseAdmin();
    const [meals, body_metrics, workout_days, advice, profiles] = await Promise.all([
      supa.from('meals').select('*').eq('user_id', userId),
      supa.from('body_metrics').select('*').eq('user_id', userId),
      supa.from('workout_days').select('*').eq('user_id', userId),
      supa.from('advice').select('*').eq('user_id', userId),
      supa.from('profiles').select('*').eq('user_id', userId),
    ]);

    // 任一表查询失败必须显式报错，避免 "查询失败" 与 "表为空" 混淆造成假成功导出
    const errors = [meals.error, body_metrics.error, workout_days.error, advice.error, profiles.error].filter(Boolean);
    if (errors.length > 0) {
      return NextResponse.json({
        error: 'partial export failed',
        details: errors.map((e) => e!.message),
      }, { status: 500 });
    }

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      user_id: userId,
      tables: {
        meals: meals.data ?? [],
        body_metrics: body_metrics.data ?? [],
        workout_days: workout_days.data ?? [],
        advice: advice.data ?? [],
        profiles: profiles.data ?? [],
      },
    });
  } catch (e: unknown) {
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden (owner)', { status: 403 });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
