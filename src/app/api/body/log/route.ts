import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { extractIdempotencyKey, MissingIdempotencyKeyError } from '@/lib/auth/idempotency';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

const Body = z.object({
  measured_at: z.string(),
  weight_kg: z.number().min(20).max(300),
  body_fat_pct: z.number().optional(),
  skeletal_muscle_pct: z.number().optional(),
  visceral_fat: z.number().optional(),
  bmi: z.number().optional(),
  source: z.enum(['screenshot', 'manual']),
  ai_raw_json: z.unknown().optional(),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const mutationId = extractIdempotencyKey(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    const body = Body.parse(await req.json());

    const supa = supabaseAdmin();
    // 用 .select() 后才能区分"插入了新行" vs "幂等命中"：ignoreDuplicates 时冲突命中返回空数组
    const { data: inserted, error: insertErr } = await supa.from('body_metrics').upsert({
      user_id: userId,
      measured_at: body.measured_at,
      weight_kg: body.weight_kg,
      body_fat_pct: body.body_fat_pct,
      skeletal_muscle_pct: body.skeletal_muscle_pct,
      visceral_fat: body.visceral_fat,
      bmi: body.bmi,
      source: body.source,
      ai_raw_json: body.ai_raw_json ?? null,
      client_mutation_id: mutationId,
    }, { onConflict: 'user_id,client_mutation_id', ignoreDuplicates: true }).select('id');
    if (insertErr) throw insertErr;

    // 只在确实插入新 body_metrics 行时同步 profiles.current_weight_kg
    // 否则幂等重放 / 旧请求会用陈旧 weight 覆盖 profile
    if (inserted && inserted.length > 0) {
      const { error: profileErr } = await supa.from('profiles').update({
        current_weight_kg: body.weight_kg,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      if (profileErr) throw profileErr;
    }

    return NextResponse.json({ ok: true, idempotentSkip: !inserted || inserted.length === 0 });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof MissingIdempotencyKeyError) return NextResponse.json({ error: e.message }, { status: 400 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'ai_call', message: err.message, stack: err.stack });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
