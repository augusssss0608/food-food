'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/page-header';
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
      else toast.error(r.status === 401 ? '工作階段已過期' : 'secret 錯誤');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell px="px-6">
        <PageHeader />
        <header className="mb-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-warm font-mono mb-3">restricted</p>
          <h1 className="display-roman text-[36px] leading-tight">維護面板</h1>
          <p className="text-text-2 text-[13px] mt-3">輸入 DEV_SECRET 進入</p>
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
            {busy ? '驗證中…' : '進入'}
          </Button>
        </form>
    </PageShell>
  );
}
