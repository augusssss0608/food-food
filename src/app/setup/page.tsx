'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

const SECTIONS = [
  { key: 'height_cm', label: '身高', suffix: 'cm', kind: 'number' as const },
  { key: 'current_weight_kg', label: '体重', suffix: 'kg', kind: 'number' as const },
  { key: 'training_days_per_week', label: '每周训练', suffix: '天 / 周', kind: 'number' as const },
];

export default function SetupPage() {
  const [profile, setProfile] = useState({
    height_cm: 175,
    current_weight_kg: 70,
    birth_date: '1996-05-19',
    sex: 'male' as 'male' | 'female',
    training_days_per_week: 3,
    preferred_timezone: 'Asia/Tokyo',
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'failed');
      toast.success('目标已生成', '即将进入主页…');
      setTimeout(() => { location.href = '/'; }, 900);
    } catch (e: unknown) {
      toast.error('生成失败', (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh px-6 py-10 max-w-md mx-auto anim-enter">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent font-mono mb-2">step 01 / 01</p>
        <h1 className="display-roman text-[36px] leading-[0.95]">
          告诉我你的<span className="display">起点</span>
        </h1>
        <p className="text-text-2 text-[14px] mt-3 leading-relaxed">
          AI 会基于这些数据为你算出每日卡路里、蛋白、碳水、脂肪目标。
        </p>
      </header>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <Input
            key={s.key}
            id={s.key}
            label={s.label}
            type="number"
            value={(profile as Record<string, string | number>)[s.key]}
            onChange={(e) =>
              setProfile({ ...profile, [s.key]: Number(e.target.value) })
            }
            suffix={s.suffix}
          />
        ))}
        <Input
          id="birth_date"
          label="生日"
          type="date"
          value={profile.birth_date}
          onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
        />
        <Select
          id="sex"
          label="性别"
          value={profile.sex}
          onChange={(e) =>
            setProfile({ ...profile, sex: (e.target as HTMLSelectElement).value as 'male' | 'female' })
          }
          options={[
            { value: 'male', label: '男' },
            { value: 'female', label: '女' },
          ]}
        />
      </div>

      <div className="mt-10">
        <Button onClick={submit} size="lg" loading={busy} className="w-full">
          {busy ? '正在生成你的目标…' : '生成初始目标'}
        </Button>
        <p className="text-[12px] text-text-3 mt-3 text-center">
          数据可在「修改目标」里随时调整
        </p>
      </div>
    </main>
  );
}
