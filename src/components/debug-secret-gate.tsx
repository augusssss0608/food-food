'use client';
import { useState } from 'react';

export function DebugSecretGate() {
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch('/admin/debug/api/verify', {
        method: 'POST',
        headers: { 'x-dev-secret': input, 'sec-fetch-site': 'same-origin' },
      });
      if (r.ok) location.reload();
      else setErr(r.status === 401 ? '未登录' : '错误的 secret');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold">维护面板鉴权</h1>
      <input type="password" value={input} onChange={(e) => setInput(e.target.value)}
             placeholder="DEV_SECRET" className="border px-3 py-2 w-full mt-3" />
      <button onClick={submit} disabled={busy || !input}
              className="bg-black text-white px-4 py-2 rounded mt-3 disabled:opacity-50">
        {busy ? '验证中…' : '进入'}
      </button>
      {err && <p className="text-red-500 mt-2">{err}</p>}
    </main>
  );
}
