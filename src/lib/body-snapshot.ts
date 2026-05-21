import { cookies } from 'next/headers';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * /history/body 所需的 90 天 body_metrics snapshot。
 *
 * 被 history/body/page.tsx（RSC 初次渲染）和 /api/body/snapshot（SWR client revalidate）
 * 共用，保證兩條路徑同口徑。
 *
 * 走 PostgreSQL RPC load_body_snapshot，一次拿 timezone + rows，
 * 從 2 個 HTTP RT 壓到 1 個。
 */
export type BodyRow = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  skeletal_muscle_pct: number | null;
  visceral_fat: number | null;
  bmi: number | null;
};

export type BodySnapshot = {
  rows: BodyRow[];
  timezone: string;
  /** 90 天窗口起點（UTC ISO），client 端 patch 時用同一邊界判斷新 row 是否該插入 */
  windowStartUtc: string;
};

const BodyRowSchema = z.object({
  measured_at: z.string(),
  weight_kg: z.number().nullable(),
  body_fat_pct: z.number().nullable(),
  skeletal_muscle_pct: z.number().nullable(),
  visceral_fat: z.number().nullable(),
  bmi: z.number().nullable(),
}).strict();

const BodySnapshotSchema = z.object({
  rows: z.array(BodyRowSchema),
  timezone: z.string(),
  windowStartUtc: z.string(),
}).strict();

async function readCookieTz(): Promise<string | null> {
  try {
    return (await cookies()).get('ff_tz')?.value ?? null;
  } catch {
    return null;
  }
}

export async function loadBodySnapshot(
  supa: SupabaseClient,
  _userId: string,
): Promise<BodySnapshot> {
  const { data, error } = await supa.rpc('load_body_snapshot', {
    p_tz: await readCookieTz(),
  });
  if (error) throw error;
  if (data == null) throw new Error('load_body_snapshot returned null');
  return BodySnapshotSchema.parse(data) as BodySnapshot;
}
