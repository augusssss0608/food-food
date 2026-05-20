'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export function DebugSecretGate() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input) return;
    setBusy(true);
    try {
      const r = await fetch('/admin/debug/api/verify', {
        method: 'POST',
        headers: { 'x-dev-secret': input, 'sec-fetch-site': 'same-origin' },
      });
      if (r.ok) location.reload();
      else toast.error(r.status === 401 ? '会话已过期' : 'secret 错误');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center px-6 max-w-md mx-auto anim-enter">
      <div className="w-full">
        <header className="mb-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-warm font-mono mb-3">restricted</p>
          <h1 className="display-roman text-[36px] leading-tight">维护面板</h1>
          <p className="text-text-2 text-[13px] mt-3">输入 DEV_SECRET 进入</p>
        </header>
        <form onSubmit={submit} className="space-y-4">
          <Input
            id="dev-secret"
            type="password"
            label="DEV_SECRET"
            placeholder="••••••••••••"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
          />
          <Button type="submit" size="lg" loading={busy} disabled={!input} className="w-full">
            {busy ? '验证中…' : '进入'}
          </Button>
        </form>
      </div>
    </main>
  );
}
