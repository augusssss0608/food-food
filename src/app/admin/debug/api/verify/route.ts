import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await requireAllowedUser({ fresh: true });

    const provided = req.headers.get('x-dev-secret') ?? '';
    const expected = process.env.DEV_SECRET ?? '';
    if (!expected) return new NextResponse('dev_secret_not_configured', { status: 500 });
    // 完全 constant-time：把 provided 填充/截断到 expected.length，无论长度都跑 timingSafeEqual
    const providedBuf = Buffer.alloc(expected.length);
    Buffer.from(provided).copy(providedBuf, 0, 0, Math.min(provided.length, expected.length));
    const eq = timingSafeEqual(providedBuf, Buffer.from(expected));
    if (!eq || provided.length !== expected.length) {
      return new NextResponse('forbidden', { status: 403 });
    }

    const res = new NextResponse(null, { status: 204 });
    res.cookies.set('food_food_dev_secret_ok', '1', {
      httpOnly: true,
      sameSite: 'strict',
      path: '/admin/debug',
      maxAge: 3600,
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (e: unknown) {
    if (e instanceof CsrfError) return new NextResponse('forbidden', { status: 403 });
    if (e instanceof AuthError) return new NextResponse('unauthorized', { status: 401 });
    if (e instanceof ForbiddenError) return new NextResponse('forbidden', { status: 403 });
    return new NextResponse('internal', { status: 500 });
  }
}
