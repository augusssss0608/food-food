'use client';
import { useEffect, useState } from 'react';
import { Spinner } from './ui/spinner';
import { useToast } from './ui/toast';

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
  const toast = useToast();

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
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }
      const manifestRes = await fetch('/api/push/manifest');
      const { vapidPublicKey } = await manifestRes.json();
      if (!vapidPublicKey) throw new Error('VAPID public key not configured');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
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
      toast.success('已订阅推送', '建议生成时会主动提醒');
    } catch (e: unknown) {
      setState('error');
      toast.error('订阅失败', (e as Error).message);
    }
  }

  if (state === 'unsupported') {
    return (
      <p className="text-[11px] uppercase tracking-[0.14em] text-text-4 font-mono">
        本浏览器不支持推送
      </p>
    );
  }
  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 text-[12px] text-warm">
        <span className="w-1.5 h-1.5 rounded-full bg-warm anim-pulse-soft" />
        通知权限被拒，无法订阅推送
      </div>
    );
  }
  if (state === 'subscribed') {
    return (
      <div className="flex items-center gap-2 text-[12px] text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        推送已开启
      </div>
    );
  }
  return (
    <button
      onClick={subscribe}
      disabled={state === 'busy'}
      className={[
        'inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] font-mono',
        'text-text-2 hover:text-text transition-colors',
      ].join(' ')}
    >
      {state === 'busy' ? (
        <>
          <Spinner size={12} className="text-accent" />
          订阅中…
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          开启推送
        </>
      )}
    </button>
  );
}
