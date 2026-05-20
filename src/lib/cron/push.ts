import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPushNotification } from '@/lib/push/send';
import { writeAppError } from '@/lib/errors/app-errors';

export async function trySendPushOnce(input: {
  userId: string;
  type: 'weekly_advice_ready' | 'monthly_advice_ready' | 'body_metrics_overdue';
  refId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}): Promise<{ sent: boolean; skipped: boolean }> {
  const supa = supabaseAdmin();
  const { error: insertErr } = await supa.from('notification_deliveries').insert({
    user_id: input.userId,
    channel: 'web_push',
    type: input.type,
    ref_id: input.refId,
    status: 'sending',
    attempts: 1,
  });
  if (insertErr && (insertErr as { code?: string }).code === '23505') return { sent: false, skipped: true };
  if (insertErr) throw insertErr;

  try {
    const r = await sendPushNotification({ userId: input.userId, title: input.title, body: input.body, data: input.data });
    await supa.from('notification_deliveries').update({
      status: r.sent > 0 ? 'sent' : 'failed', sent_at: new Date().toISOString(),
    }).eq('user_id', input.userId).eq('channel', 'web_push').eq('type', input.type).eq('ref_id', input.refId);
    return { sent: r.sent > 0, skipped: false };
  } catch (e: unknown) {
    const err = e as { message?: string };
    await supa.from('notification_deliveries').update({
      status: 'failed', last_error: err.message ?? 'unknown',
    }).eq('user_id', input.userId).eq('channel', 'web_push').eq('type', input.type).eq('ref_id', input.refId);
    await writeAppError({ kind: 'push_send', message: err.message, context: { ref_id: input.refId } });
    return { sent: false, skipped: false };
  }
}
