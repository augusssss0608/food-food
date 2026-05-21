/**
 * 給 OWNER 造 10 筆假 body_metrics，方便 /history/body 折線圖可視化。
 *
 * 用法：
 *   1. 確認 .env.local 有 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY_ADMIN / ALLOWED_USER_ID
 *   2. npx tsx scripts/seed-body-fake.ts
 *
 * 安全：直接打 production，建議跑完看完數據就刪 / 用 DELETE 清掉。
 *
 * 用 @next/env 而不是 dotenv（後者沒裝），按 Next.js 標準順序載入
 * .env.local → .env，跟 next dev / build 一致。
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';

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

// 10 筆按時間從遠到近，模擬「3 天測一次、體重逐步下降、體脂略降、肌肉略升」的訓練軌跡
const now = DateTime.utc();
const rows = Array.from({ length: 10 }, (_, i) => {
  const daysAgo = (9 - i) * 3; // 0, 3, 6, ..., 27
  const measuredAt = now.minus({ days: daysAgo, hours: 7 }); // 大概早上 7am 量測
  // 線性下降 + 小幅噪聲
  const t = i / 9; // 0 .. 1
  const weight = 72.5 - t * 2.4 + (Math.random() - 0.5) * 0.4;
  const bodyFat = 17.0 - t * 2.5 + (Math.random() - 0.5) * 0.3;
  const muscle = 42.0 + t * 1.2 + (Math.random() - 0.5) * 0.2;
  const visceral = 8.0 - t * 1.2 + (Math.random() - 0.5) * 0.2;
  const bmi = 22.5 - t * 0.7 + (Math.random() - 0.5) * 0.1;
  return {
    user_id: OWNER_UID,
    measured_at: measuredAt.toISO(),
    weight_kg: round1(weight),
    body_fat_pct: round1(bodyFat),
    skeletal_muscle_pct: round1(muscle),
    visceral_fat: round1(visceral),
    bmi: round1(bmi),
    source: 'manual',
    client_mutation_id: randomUUID(),
  };
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const { error } = await supa.from('body_metrics').insert(rows);
if (error) {
  console.error('insert failed:', error.message);
  process.exit(1);
}
console.log(`Seeded ${rows.length} body_metrics rows for ${OWNER_UID}.`);
console.log('Range:', rows[0]!.measured_at, '→', rows[rows.length - 1]!.measured_at);
