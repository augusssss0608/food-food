import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

let vapidInited = false;
function ensureVapid(): void {
  if (vapidInited) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured');
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:none@example.com',
    pub, priv,
  );
  vapidInited = true;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; fail_count?: number };

export async function sendPushNotification(input: {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}): Promise<{ sent: number; failed: number }> {
  const supa = supabaseAdmin();
  const { data: subs } = await supa.from('push_subscriptions').select('*').eq('user_id', input.userId);
  const subList = (subs ?? []) as Sub[];
  if (subList.length === 0) return { sent: 0, failed: 0 };
  ensureVapid();

  let sent = 0, failed = 0;
  for (const s of subList) {
    try {
      await webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: input.title, body: input.body, data: input.data }),
      );
      sent++;
      await supa.from('push_subscriptions').update({ last_used_at: new Date().toISOString(), fail_count: 0 }).eq('id', s.id);
    } catch (e: unknown) {
      failed++;
      const err = e as { statusCode?: number; message?: string };
      const statusCode = err.statusCode ?? 0;
      if (statusCode === 410 || statusCode === 404) {
        await supa.from('push_subscriptions').delete().eq('id', s.id);
      } else if (statusCode === 401 || statusCode === 403) {
        await writeAppError({ kind: 'push_send', message: 'VAPID auth error', context: { statusCode, endpoint: s.endpoint.slice(0, 100) } });
      } else {
        await supa.from('push_subscriptions').update({ fail_count: (s.fail_count ?? 0) + 1 }).eq('id', s.id);
        await writeAppError({ kind: 'push_send', message: err.message ?? 'unknown', context: { statusCode } });
      }
    }
  }
  return { sent, failed };
}
