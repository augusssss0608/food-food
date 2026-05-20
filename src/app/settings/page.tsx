'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

type ProfileRow = {
  user_id: string;
  kcal_workout_day: number | null;
  kcal_rest_day: number | null;
  protein_g: number | null;
  carb_workout_day: number | null;
  carb_rest_day: number | null;
  fat_g: number | null;
  fiber_g: number | null;
};

const FIELDS: { key: keyof Omit<ProfileRow, 'user_id'>; label: string; suffix: string; group: 'energy' | 'macro' }[] = [
  { key: 'kcal_workout_day', label: '訓練日卡路里', suffix: 'kcal', group: 'energy' },
  { key: 'kcal_rest_day', label: '休息日卡路里', suffix: 'kcal', group: 'energy' },
  { key: 'protein_g', label: '蛋白質', suffix: 'g', group: 'macro' },
  { key: 'carb_workout_day', label: '碳水(訓練日)', suffix: 'g', group: 'macro' },
  { key: 'carb_rest_day', label: '碳水(休息日)', suffix: 'g', group: 'macro' },
  { key: 'fat_g', label: '脂肪', suffix: 'g', group: 'macro' },
  { key: 'fiber_g', label: '膳食纖維', suffix: 'g', group: 'macro' },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supa = useMemo(() => createSupabaseBrowserClient(), []);
  const toast = useToast();

  useEffect(() => {
    supa.from('profiles').select('*').single().then(({ data, error }) => {
      if (error) { setLoadError(error.message); return; }
      setProfile(data as ProfileRow | null);
    });
  }, [supa]);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const r = await supa.from('profiles').update({
      ...profile,
      targets_source: 'user_override',
      targets_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never).eq('user_id', profile.user_id);
    setBusy(false);
    if (r.error) toast.error('儲存失敗', r.error.message);
    else toast.success('已儲存', '目標已更新');
  }

  if (loadError) {
    return (
      <main className="min-h-dvh flex flex-col px-6 py-16 max-w-md mx-auto">
        <Card className="m-auto p-5 w-full">
          <p className="text-danger text-[14px]">讀取 profile 失敗</p>
          <p className="text-text-3 text-[12px] mt-1">{loadError}</p>
        </Card>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="min-h-dvh flex flex-col px-5 py-8 max-w-md mx-auto">
        <div className="m-auto w-full">
          <Skeleton />
        </div>
      </main>
    );
  }

  const energy = FIELDS.filter((f) => f.group === 'energy');
  const macro = FIELDS.filter((f) => f.group === 'macro');

  return (
    <main className="min-h-dvh flex flex-col px-5 py-8 max-w-md mx-auto">
      <div className="m-auto w-full anim-enter">
        <header className="flex items-baseline justify-between mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">targets</p>
            <h1 className="display-roman text-[32px] leading-none">修改目標</h1>
          </div>
          <Link href="/" className="text-[13px] text-text-3 hover:text-text transition-colors">← 主頁</Link>
        </header>

        <Section title="能量">
          {energy.map((f) => (
            <Input
              key={f.key}
              id={f.key}
              label={f.label}
              type="number"
              value={profile[f.key] ?? 0}
              onChange={(e) =>
                setProfile({ ...profile, [f.key]: Number(e.target.value) })
              }
              suffix={f.suffix}
            />
          ))}
        </Section>

        <Section title="宏量營養">
          {macro.map((f) => (
            <Input
              key={f.key}
              id={f.key}
              label={f.label}
              type="number"
              value={profile[f.key] ?? 0}
              onChange={(e) =>
                setProfile({ ...profile, [f.key]: Number(e.target.value) })
              }
              suffix={f.suffix}
            />
          ))}
        </Section>

        <div className="mt-8">
          <Button size="lg" onClick={save} loading={busy} className="w-full">
            {busy ? '儲存中…' : '儲存目標'}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-mono mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Skeleton() {
  return (
    <>
      <div className="h-8 w-32 skeleton mb-8" />
      <div className="space-y-3">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-12 skeleton" />
        ))}
      </div>
    </>
  );
}
