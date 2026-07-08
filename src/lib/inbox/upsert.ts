import { supabaseAdmin } from '@/lib/supabase/admin';
import type { InboxType } from '@/lib/types/inbox';

function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function adviceReadyTitle(
  adviceKind: 'weekly' | 'monthly',
  periodStart: string,
  periodEnd: string,
): string {
  return adviceKind === 'weekly'
    ? `${shortDate(periodStart)}-${shortDate(periodEnd)} 週建議已生成`
    : '本月建議已生成';
}

export async function ensureInboxForAdvice(
  adviceKind: 'weekly' | 'monthly',
  adviceId: string,
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  const inboxType: InboxType = adviceKind === 'weekly' ? 'weekly_advice_ready' : 'monthly_advice_ready';
  const { error } = await supabaseAdmin().from('inbox').upsert({
    user_id: userId,
    type: inboxType,
    ref_id: `${adviceKind}:${periodStart}`,
    title: adviceReadyTitle(adviceKind, periodStart, periodEnd),
    data: { type: inboxType, adviceId, periodStart },
  }, { onConflict: 'user_id,type,ref_id' });
  if (error) throw error;
}
