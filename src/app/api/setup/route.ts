import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { reserveAiBudget } from '@/lib/ai-provider/budget';
import { getAiProvider, AIError } from '@/lib/ai-provider';
import { fallbackTdee } from '@/lib/ai-provider/fallback-tdee';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

const Body = z.object({
  height_cm: z.number().int().min(80).max(250),
  current_weight_kg: z.number().min(20).max(300),
  birth_date: z.string(),
  sex: z.enum(['male', 'female']),
  training_days_per_week: z.number().int().min(0).max(7),
  preferred_timezone: z.string().default('Asia/Tokyo'),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    const body = Body.parse(await req.json());

    const correlationId = crypto.randomUUID();
    const { usageDate } = await reserveAiBudget(userId, 'initial_targets');

    let targets;
    try {
      const provider = getAiProvider();
      targets = await provider.computeInitialTargets(
        {
          height_cm: body.height_cm,
          current_weight_kg: body.current_weight_kg,
          birth_date: body.birth_date,
          sex: body.sex,
          training_days_per_week: body.training_days_per_week,
        },
        { userId, trigger: 'user', correlationId, kind: 'initial_targets', usageDate },
      );
    } catch (e) {
      // 仅"AI 输出不合规"走 fallback；rate_limit / transport / auth_oauth 必须 rethrow
      // 注意：provider 内部 finally 已 settleAiBudget（actualCents=0），route 不再 settle 避免 double-settle
      if (e instanceof AIError && (e.category === 'schema_invalid' || e.category === 'unknown')) {
        await writeAppError({ kind: 'ai_call', correlationId, message: 'initial_targets fallback to fallbackTdee', context: { reason: e.category } });
        targets = fallbackTdee(body);
      } else {
        throw e;
      }
    }

    // provider 返回的 targets 带 _meta（AI 调用元数据），profiles 表没这列；剥离再 upsert
    const { _meta: _meta, ...targetsForDb } = targets as typeof targets & { _meta?: unknown };
    void _meta;
    const { error: upsertErr } = await supabaseAdmin().from('profiles').upsert({
      user_id: userId,
      ...body,
      ...targetsForDb,
      targets_source: 'ai_initial',
      targets_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (upsertErr) {
      await writeAppError({ kind: 'ai_call', correlationId, message: `profiles upsert failed: ${upsertErr.message}` });
      return NextResponse.json({ error: 'profile save failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, targets });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AIError && e.category === 'rate_limit') return NextResponse.json({ error: '今日 AI 预算已用完' }, { status: 429 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'ai_call', message: err.message, stack: err.stack });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export const maxDuration = 60;
