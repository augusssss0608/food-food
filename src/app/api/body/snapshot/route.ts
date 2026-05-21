import { NextResponse } from 'next/server';
import { AuthError, ForbiddenError, requireAllowedUser } from '@/lib/auth/require-allowed-user';
import { loadBodySnapshot } from '@/lib/body-snapshot';
import { writeAppError } from '@/lib/errors/app-errors';

/**
 * SWR revalidate endpoint：用同一 loader 重查 90 天 body_metrics snapshot。
 * 主要供 reconnect / 手動 mutate(key) 場景；mutation 後 client 直接 patch cache，
 * 不必呼叫這裡。
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, userId } = await requireAllowedUser();
    const snapshot = await loadBodySnapshot(supabase, userId);
    return NextResponse.json(snapshot);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'body_snapshot', message: err.message, stack: err.stack });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
