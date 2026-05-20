import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { userId } = await requireAllowedUser({ fresh: true });
    const body = Body.parse(await req.json());

    await supabaseAdmin().from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: body.userAgent ?? null,
      last_used_at: new Date().toISOString(),
      fail_count: 0,
    }, { onConflict: 'endpoint' });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    const err = e as { message?: string };
    await writeAppError({ kind: 'push_send', message: err.message });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
