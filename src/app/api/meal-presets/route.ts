import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

/**
 * 新建自定义菜单。AddMealSheet 的「+」與「拍照轉 preset」都走這個 endpoint。
 * 唯一冲突走 expression unique index（user_id + normalized name），返回 409。
 */
export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().trim().min(1).max(50),
  // category：空字符串 / 仅空白都规范化为 null（后端唯一允许的 falsy）
  category: z.string().trim().max(30).nullish().transform((v) => (v && v.length > 0 ? v : null)),
  kcal: z.number().min(0).max(5000),
  protein_g: z.number().min(0).max(500).default(0),
  carb_g: z.number().min(0).max(1000).default(0),
  fat_g: z.number().min(0).max(500).default(0),
  fiber_g: z.number().min(0).max(200).optional().default(0),
  source_meal_id: z.string().uuid().optional(),
}).strict();

const PRESET_SELECT = 'id, name, category, kcal, protein_g, carb_g, fat_g, fiber_g, created_at';

export async function POST(req: Request) {
  let userIdForLog: string | undefined;
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    userIdForLog = userId;

    const body = Body.parse(await req.json());
    const admin = supabaseAdmin();

    // source_meal_id 必須是當前用戶自己的 meal — route 用 service_role 绕 RLS，
    // FK 不夠擋 cross-user 注入，必須手動驗證 user_id。
    if (body.source_meal_id) {
      const { data: ownMeal, error: ownErr } = await admin
        .from('meals')
        .select('id')
        .eq('id', body.source_meal_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (ownErr) throw ownErr;
      if (!ownMeal) {
        return NextResponse.json({ error: 'source_meal_not_owned' }, { status: 400 });
      }
    }

    const { data, error } = await admin
      .from('user_meal_presets')
      .insert({
        user_id: userId,
        name: body.name,
        category: body.category,
        kcal: body.kcal,
        protein_g: body.protein_g,
        carb_g: body.carb_g,
        fat_g: body.fat_g,
        fiber_g: body.fiber_g,
        source_meal_id: body.source_meal_id ?? null,
      })
      .select(PRESET_SELECT)
      .single();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'duplicate_name' }, { status: 409 });
      }
      await writeAppError({
        kind: 'meal_presets_create',
        message: error.message,
        context: { userId },
      });
      return NextResponse.json({ error: 'create failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, preset: data });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof ZodError) return NextResponse.json({ error: 'bad request', issues: e.issues }, { status: 400 });

    const err = e as { message?: string; stack?: string };
    await writeAppError({
      kind: 'meal_presets_create',
      message: err.message,
      stack: err.stack,
      context: { userId: userIdForLog },
    });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
