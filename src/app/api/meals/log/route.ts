import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { extractIdempotencyKey, MissingIdempotencyKeyError } from '@/lib/auth/idempotency';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getFitnessMealPreset } from '@/lib/fitness-meals';
import { writeAppError } from '@/lib/errors/app-errors';

const Body = z.object({
  ate_at: z.string(),
  source: z.enum(['preset', 'photo_ai', 'manual']),
  preset_key: z.string().optional(),
  dish_name: z.string().optional(),
  kcal: z.number().optional(),
  protein_g: z.number().optional(),
  carb_g: z.number().optional(),
  fat_g: z.number().optional(),
  fiber_g: z.number().optional(),
  satiety: z.number().int().min(1).max(5).optional(),
  ai_raw_json: z.unknown().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // 顺序：csrf → idempotency-key 形式 → 鉴权（fresh）→ body
    // idempotency 提到 auth 前，让缺 header 一律 400（不被 401 抢先）
    assertSameOrigin(req);
    const mutationId = extractIdempotencyKey(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    const body = Body.parse(await req.json());

    let nutrients: { kcal?: number; protein_g?: number; carb_g?: number; fat_g?: number; fiber_g?: number; dish_name?: string } = {};
    if (body.source === 'preset') {
      if (!body.preset_key) return NextResponse.json({ error: 'preset_key required for source=preset' }, { status: 400 });
      const preset = getFitnessMealPreset(body.preset_key);
      if (!preset) return NextResponse.json({ error: 'unknown preset_key' }, { status: 400 });
      nutrients = {
        dish_name: preset.name, kcal: preset.kcal, protein_g: preset.protein,
        carb_g: preset.carb, fat_g: preset.fat, fiber_g: preset.fiber,
      };
    } else {
      nutrients = {
        dish_name: body.dish_name, kcal: body.kcal, protein_g: body.protein_g,
        carb_g: body.carb_g, fat_g: body.fat_g, fiber_g: body.fiber_g,
      };
    }

    const admin = supabaseAdmin();
    const { error: upsertError } = await admin.from('meals').upsert({
      user_id: userId,
      ate_at: body.ate_at,
      source: body.source,
      preset_key: body.preset_key,
      ...nutrients,
      satiety: body.satiety,
      ai_raw_json: body.ai_raw_json ?? null,
      notes: body.notes,
      client_mutation_id: mutationId,
    }, { onConflict: 'user_id,client_mutation_id', ignoreDuplicates: true });
    if (upsertError) throw upsertError;

    // 不管 upsert 是 insert 還是 idempotency replay（ignoreDuplicates 不返回 row），都用
    // client_mutation_id 查一次完整 row，client 收到後可直接 patch SWR cache，UI 立即更新。
    const { data: meal, error: selectError } = await admin.from('meals')
      .select('id, ate_at, source, dish_name, kcal, protein_g, carb_g, fat_g, fiber_g, satiety')
      .eq('user_id', userId)
      .eq('client_mutation_id', mutationId)
      .single();
    if (selectError) throw selectError;

    // 兼容性：保留 mealId 給離線 draft / 舊 callers，主要看 `meal`
    return NextResponse.json({ ok: true, meal, mealId: meal.id });
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
