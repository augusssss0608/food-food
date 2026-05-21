/**
 * 一次性：刪除 OWNER 今日的 workout_days 標記，讓主頁回到「未選擇」狀態。
 * 用法：npx tsx scripts/unmark-today.ts
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY_ADMIN;
const OWNER_UID = process.env.ALLOWED_USER_ID;

if (!SUPABASE_URL || !SECRET_KEY || !OWNER_UID) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY_ADMIN / ALLOWED_USER_ID');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function main() {
  // profiles 沒有 timezone 列；用 zh-TW 項目預設的 Asia/Taipei
  // 並同時嘗試 UTC 的「今日」以防漏刪
  const tz = 'Asia/Taipei';
  const todayLocal = DateTime.now().setZone(tz).toISODate()!;
  const todayUtc = DateTime.utc().toISODate()!;
  const candidates = Array.from(new Set([todayLocal, todayUtc]));
  console.log(`tz=${tz}, candidates=${candidates.join(', ')}`);

  // 看當前有沒有
  const { data: before, error: rErr } = await supa
    .from('workout_days')
    .select('user_id, date, is_workout')
    .eq('user_id', OWNER_UID)
    .in('date', candidates);
  if (rErr) {
    console.error('read workout_days failed:', rErr.message);
    process.exit(1);
  }
  console.log('before:', before);

  if (!before || before.length === 0) {
    console.log('nothing to delete, already unmarked.');
    return;
  }

  const { error: dErr } = await supa
    .from('workout_days')
    .delete()
    .eq('user_id', OWNER_UID)
    .in('date', candidates);
  if (dErr) {
    console.error('delete failed:', dErr.message);
    process.exit(1);
  }
  console.log(`deleted ${before.length} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
