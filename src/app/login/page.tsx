'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const supa = createSupabaseBrowserClient();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('請填郵箱和密碼');
      return;
    }
    setBusy(true);
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('登入失敗', error.message);
      setBusy(false);
      return;
    }
    location.href = '/';
  }

  return (
    <main className="min-h-dvh flex flex-col px-6 py-12 max-w-md mx-auto">
      <div className="m-auto w-full anim-enter">
        <header className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.32em] text-accent font-mono mb-3">FOOD · FOOD</p>
          <h1 className="display-roman text-[44px] leading-[0.95] tracking-tight">
            Your private
            <br />
            <span className="display">fitness lab.</span>
          </h1>
          <p className="text-text-2 text-[14px] mt-4 leading-relaxed">
            登入追蹤每一餐、每一次稱重、每一週的進展。
          </p>
        </header>

        <form onSubmit={signIn} className="space-y-3">
          <Input
            id="email"
            type="email"
            label="郵箱"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
          />
          <Input
            id="password"
            type="password"
            label="密碼"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="pt-3">
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {busy ? '驗證中…' : '進入'}
            </Button>
          </div>
        </form>
      </div>

      <footer className="text-[11px] uppercase tracking-[0.16em] text-text-4 font-mono text-center">
        v0.1 · single-user beta
      </footer>
    </main>
  );
}
