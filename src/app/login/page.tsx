'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const supa = createSupabaseBrowserClient();

  async function signIn() {
    setMsg(null);
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else location.href = '/';
  }

  return (
    <main className="p-4 max-w-md mx-auto space-y-3">
      <h1 className="text-2xl font-bold">登录</h1>
      <form onSubmit={(e) => { e.preventDefault(); signIn(); }} className="space-y-3">
        <input id="email" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border px-3 py-2 w-full" />
        <input id="password" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border px-3 py-2 w-full" />
        <button type="submit" className="bg-black text-white px-4 py-2 rounded w-full">登录</button>
      </form>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </main>
  );
}
