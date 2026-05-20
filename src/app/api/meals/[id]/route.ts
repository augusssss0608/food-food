import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

// 編輯允許改的欄位（不允許改 user_id / ate_at / source / preset_key / client_mutation_id）
// 數值欄位限 0 ~ 合理上限，避免負值或誇張值落庫；dish_name 限長度 100。
// notes 暫不在這條 API 開放（UI 沒入口）；若未來要支持先加 UI 再開 schema。
const PatchBody = z.object({
  dish_name: z.string().trim().max(100).nullable().optional(),
  kcal: z.number().nonnegative().max(10000).nullable().optional(),
  protein_g: z.number().nonnegative().max(1000).nullable().optional(),
  carb_g: z.number().nonnegative().max(2000).nullable().optional(),
  fat_g: z.number().nonnegative().max(1000).nullable().optional(),
  fiber_g: z.number().nonnegative().max(200).nullable().optional(),
  satiety: z.number().int().min(1).max(5).nullable().optional(),
}).strict();

const IdParam = z.string().uuid();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userIdForLog: string | undefined;
  let idForLog: string | undefined;
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    userIdForLog = userId;
    const { id } = await ctx.params;
    idForLog = id;
    IdParam.parse(id);
    const body = PatchBody.parse(await req.json());

    // 雙條件 .eq('id', id).eq('user_id', userId) 確保只能改自己的 meal
    const { data, error } = await supabaseAdmin()
      .from('meals')
      .update(body)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      await writeAppError({ kind: 'meals_patch', message: error.message, context: { mealId: id, userId } });
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof ZodError) return NextResponse.json({ error: 'bad request', issues: e.issues }, { status: 400 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({
      kind: 'meals_patch', message: err.message, stack: err.stack,
      context: { mealId: idForLog, userId: userIdForLog },
    });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userIdForLog: string | undefined;
  let idForLog: string | undefined;
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    userIdForLog = userId;
    const { id } = await ctx.params;
    idForLog = id;
    IdParam.parse(id);

    const { data, error } = await supabaseAdmin()
      .from('meals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      await writeAppError({ kind: 'meals_delete', message: error.message, context: { mealId: id, userId } });
      return NextResponse.json({ error: 'delete failed' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof ZodError) return NextResponse.json({ error: 'bad request', issues: e.issues }, { status: 400 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({
      kind: 'meals_delete', message: err.message, stack: err.stack,
      context: { mealId: idForLog, userId: userIdForLog },
    });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
