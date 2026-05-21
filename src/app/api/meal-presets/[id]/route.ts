import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

/**
 * PATCH / DELETE 单个自定义菜单。
 *
 * 鉴权 + ownership：req scope 限定 user_id = userId，service_role 显式过滤。
 * DELETE 走物理删除（meals 不存 preset_id，无残留 reference）。
 * PATCH 唯一冲突走 23505 → 409 duplicate_name。
 */
export const dynamic = 'force-dynamic';

const PatchBody = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  kcal: z.number().min(0).max(5000).optional(),
  protein_g: z.number().min(0).max(500).optional(),
  carb_g: z.number().min(0).max(1000).optional(),
  fat_g: z.number().min(0).max(500).optional(),
  fiber_g: z.number().min(0).max(200).optional(),
}).strict();

const PRESET_SELECT = 'id, name, kcal, protein_g, carb_g, fat_g, fiber_g, created_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userIdForLog: string | undefined;
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    userIdForLog = userId;
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

    const body = PatchBody.parse(await req.json());
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('user_meal_presets')
      .update(body)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select(PRESET_SELECT)
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });
      }
      await writeAppError({ kind: 'meal_presets_create', message: error.message, context: { userId, id } });
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, preset: data });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof ZodError) return NextResponse.json({ error: 'bad request', issues: e.issues }, { status: 400 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'meal_presets_create', message: err.message, stack: err.stack, context: { userId: userIdForLog } });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let userIdForLog: string | undefined;
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    userIdForLog = userId;
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('user_meal_presets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      await writeAppError({ kind: 'meal_presets_create', message: error.message, context: { userId, id } });
      return NextResponse.json({ error: 'delete failed' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'meal_presets_create', message: err.message, stack: err.stack, context: { userId: userIdForLog } });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
