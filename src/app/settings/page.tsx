'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { NumberInput, isEmptyNum } from '@/components/ui/number-input';
import { Card } from '@/components/ui/card';
import { PageShell } from '@/components/ui/page-shell';
import { useToast } from '@/components/ui/toast';

type NumKey =
  | 'kcal_workout_day'
  | 'kcal_rest_day'
  | 'protein_g'
  | 'carb_workout_day'
  | 'carb_rest_day'
  | 'fat_g'
  | 'fiber_g';

type DisplayProfile = {
  user_id: string;
} & Record<NumKey, number | ''>;

const FIELDS: { key: NumKey; label: string; suffix: string; group: 'energy' | 'macro' }[] = [
  { key: 'kcal_workout_day', label: '訓練日卡路里', suffix: 'kcal', group: 'energy' },
  { key: 'kcal_rest_day', label: '休息日卡路里', suffix: 'kcal', group: 'energy' },
  { key: 'protein_g', label: '蛋白質', suffix: 'g', group: 'macro' },
  { key: 'carb_workout_day', label: '碳水(訓練日)', suffix: 'g', group: 'macro' },
  { key: 'carb_rest_day', label: '碳水(休息日)', suffix: 'g', group: 'macro' },
  { key: 'fat_g', label: '脂肪', suffix: 'g', group: 'macro' },
  { key: 'fiber_g', label: '膳食纖維', suffix: 'g', group: 'macro' },
];

const NUM_KEYS: NumKey[] = FIELDS.map((f) => f.key);

export default function SettingsPage() {
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supa = useMemo(() => createSupabaseBrowserClient(), []);
  const toast = useToast();

  useEffect(() => {
    supa.from('profiles').select('*').single().then(({ data, error }) => {
      if (error) { setLoadError(error.message); return; }
      const row = data as Record<NumKey, number | null> & { user_id: string };
      setProfile({
        user_id: row.user_id,
        kcal_workout_day: row.kcal_workout_day ?? '',
        kcal_rest_day: row.kcal_rest_day ?? '',
        protein_g: row.protein_g ?? '',
        carb_workout_day: row.carb_workout_day ?? '',
        carb_rest_day: row.carb_rest_day ?? '',
        fat_g: row.fat_g ?? '',
        fiber_g: row.fiber_g ?? '',
      });
    });
  }, [supa]);

  async function save() {
    if (!profile) return;
    const empty = NUM_KEYS.find((k) => isEmptyNum(profile[k]));
    if (empty) {
      toast.error('請填寫所有欄位', `${empty} 不能為空`);
      return;
    }
    setBusy(true);
    const payload = Object.fromEntries(NUM_KEYS.map((k) => [k, profile[k] as number])) as Record<NumKey, number>;
    const r = await supa.from('profiles').update({
      ...payload,
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
      <PageShell px="px-6">
        <Card className="p-5 w-full">
          <p className="text-danger text-[14px]">讀取 profile 失敗</p>
          <p className="text-text-3 text-[12px] mt-1">{loadError}</p>
        </Card>
      </PageShell>
    );
  }
  if (!profile) {
    return (
      <PageShell>
        <Skeleton />
      </PageShell>
    );
  }

  const energy = FIELDS.filter((f) => f.group === 'energy');
  const macro = FIELDS.filter((f) => f.group === 'macro');

  return (
    <PageShell>
        <header className="flex items-baseline justify-between mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">targets</p>
            <h1 className="display-roman text-[32px] leading-none">修改目標</h1>
          </div>
          <Link href="/" className="text-[13px] text-text-3 hover:text-text transition-colors">← 主頁</Link>
        </header>

        <Section title="能量">
          {energy.map((f) => (
            <NumberInput
              key={f.key}
              id={f.key}
              label={f.label}
              value={profile[f.key]}
              onValueChange={(v) => setProfile({ ...profile, [f.key]: v })}
              suffix={f.suffix}
            />
          ))}
        </Section>

        <Section title="宏量營養">
          {macro.map((f) => (
            <NumberInput
              key={f.key}
              id={f.key}
              label={f.label}
              value={profile[f.key]}
              onValueChange={(v) => setProfile({ ...profile, [f.key]: v })}
              suffix={f.suffix}
            />
          ))}
        </Section>

        <div className="mt-8">
          <Button size="lg" onClick={save} loading={busy} className="w-full">
            {busy ? '儲存中…' : '儲存目標'}
          </Button>
        </div>
    </PageShell>
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
