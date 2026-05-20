import { supabaseAdmin } from '@/lib/supabase/admin';
import type { InboxType } from '@/lib/types/inbox';

export async function ensureInboxForAdvice(
  adviceKind: 'weekly' | 'monthly',
  adviceId: string,
  userId: string,
  periodStart: string,
): Promise<void> {
  const inboxType: InboxType = adviceKind === 'weekly' ? 'weekly_advice_ready' : 'monthly_advice_ready';
  const { error } = await supabaseAdmin().from('inbox').upsert({
    user_id: userId,
    type: inboxType,
    ref_id: `${adviceKind}:${periodStart}`,
    title: adviceKind === 'weekly' ? '本周建议已生成' : '本月建议已生成',
    data: { type: inboxType, adviceId, periodStart },
  }, { onConflict: 'user_id,type,ref_id' });
  if (error) throw error;
}
