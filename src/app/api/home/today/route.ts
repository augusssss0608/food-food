import { NextResponse } from 'next/server';
import { AuthError, ForbiddenError, requireAllowedUser } from '@/lib/auth/require-allowed-user';
import { loadHomeSnapshot } from '@/lib/home-snapshot';
import { writeAppError } from '@/lib/errors/app-errors';

/**
 * SWR revalidate endpoint：用同一個 loader 重查主頁 snapshot。
 * 客戶端在 mutation 後不需要呼叫這裡（cache patch 即時更新 UI），
 * 主要供 reconnect / 手動 mutate(key) 場景。
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabase, userId } = await requireAllowedUser();
    const snapshot = await loadHomeSnapshot(supabase, userId);
    if (!snapshot) return NextResponse.json({ error: 'no_profile' }, { status: 404 });
    return NextResponse.json(snapshot);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    // 通用 500 也用 JSON shape（codex round D low：保持 endpoint response shape 一致）
    const err = e as { message?: string; stack?: string };
    await writeAppError({ kind: 'home_snapshot', message: err.message, stack: err.stack });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
