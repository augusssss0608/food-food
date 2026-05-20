import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { reserveAiBudget, settleAiBudget } from '@/lib/ai-provider/budget';
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
      if (e instanceof AIError && (e.category === 'schema_invalid' || e.category === 'unknown')) {
        await writeAppError({ kind: 'ai_call', correlationId, message: 'initial_targets fallback to fallbackTdee', context: { reason: e.category } });
        targets = fallbackTdee(body);
      } else {
        await settleAiBudget(userId, 'initial_targets', usageDate, 0);
        throw e;
      }
    }

    await supabaseAdmin().from('profiles').upsert({
      user_id: userId,
      ...body,
      ...targets,
      targets_source: 'ai_initial',
      targets_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

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
