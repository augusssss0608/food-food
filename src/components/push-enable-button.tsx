'use client';
import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'unsupported' | 'denied' | 'idle' | 'subscribed' | 'busy' | 'error';

export function PushEnableButton() {
  const [state, setState] = useState<State>('idle');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (sub) setState('subscribed'); })
      .catch(() => {});
  }, []);

  async function subscribe() {
    setState('busy'); setErr(null);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }
      const manifestRes = await fetch('/api/push/manifest');
      const { vapidPublicKey } = await manifestRes.json();
      if (!vapidPublicKey) throw new Error('VAPID public key not configured');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Uint8Array<ArrayBufferLike> 不能直接赋给 BufferSource（TS 5+ 严格了 generic）
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          userAgent: navigator.userAgent,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState('subscribed');
    } catch (e: unknown) {
      const error = e as { message?: string };
      setState('error');
      setErr(error.message ?? 'unknown');
    }
  }

  if (state === 'unsupported') return <p className="text-xs text-gray-500">本浏览器不支持 Web Push</p>;
  if (state === 'denied') return <p className="text-xs text-amber-700">通知权限被拒，无法订阅推送</p>;
  if (state === 'subscribed') return <p className="text-xs text-green-700">✓ 推送已开启</p>;
  return (
    <div className="text-sm">
      <button onClick={subscribe} disabled={state === 'busy'} className="border rounded px-3 py-1 disabled:opacity-50">
        {state === 'busy' ? '订阅中…' : '开启推送通知'}
      </button>
      {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
    </div>
  );
}
