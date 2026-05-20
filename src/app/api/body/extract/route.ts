import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { reserveAiBudget } from '@/lib/ai-provider/budget';
import { getAiProvider, AIError } from '@/lib/ai-provider';
import { writeAppError } from '@/lib/errors/app-errors';

const Body = z.object({ image_base64: z.string().min(1) });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    const { image_base64 } = Body.parse(await req.json());

    const correlationId = crypto.randomUUID();
    const { usageDate } = await reserveAiBudget(userId, 'body_ocr');

    const provider = getAiProvider();
    const result = await provider.extractBodyMetrics(
      { imageBase64: image_base64 },
      { userId, trigger: 'user', correlationId, kind: 'body_ocr', usageDate },
    );
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof ZodError) return NextResponse.json({ error: 'bad request', issues: e.issues }, { status: 400 });
    if (e instanceof AIError) {
      if (e.category === 'rate_limit') return NextResponse.json({ error: '今日 AI 預算已用完' }, { status: 429 });
      if (e.category === 'schema_invalid') return NextResponse.json({ error: 'AI 估算無效，轉手動', category: 'schema_invalid' }, { status: 422 });
      return NextResponse.json({ error: 'AI 不可用，轉手動', category: e.category }, { status: 502 });
    }
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'ai_call', message: err.message, stack: err.stack });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

export const maxDuration = 60;
