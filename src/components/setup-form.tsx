'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { NumberInput, isEmptyNum } from '@/components/ui/number-input';
import { useToast } from '@/components/ui/toast';

const NUM_SECTIONS = [
  { key: 'height_cm', label: '身高', suffix: 'cm' },
  { key: 'current_weight_kg', label: '體重', suffix: 'kg' },
  { key: 'training_days_per_week', label: '每週訓練', suffix: '天 / 週' },
] as const;

type NumKey = (typeof NUM_SECTIONS)[number]['key'];

export type SetupInitial = {
  height_cm?: number | null;
  current_weight_kg?: number | null;
  birth_date?: string | null;
  sex?: 'male' | 'female' | null;
  training_days_per_week?: number | null;
  preferred_timezone?: string | null;
};

type State = {
  height_cm: number | '';
  current_weight_kg: number | '';
  birth_date: string;
  sex: 'male' | 'female';
  training_days_per_week: number | '';
  preferred_timezone: string;
};

export function SetupForm({ initial }: { initial?: SetupInitial } = {}) {
  const [profile, setProfile] = useState<State>({
    height_cm: initial?.height_cm ?? 175,
    current_weight_kg: initial?.current_weight_kg ?? 70,
    birth_date: initial?.birth_date ?? '1996-05-19',
    sex: (initial?.sex ?? 'male') as 'male' | 'female',
    training_days_per_week: initial?.training_days_per_week ?? 3,
    preferred_timezone: initial?.preferred_timezone ?? 'Asia/Tokyo',
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    if (isEmptyNum(profile.height_cm) || isEmptyNum(profile.current_weight_kg) || isEmptyNum(profile.training_days_per_week)) {
      toast.error('請填寫所有數值');
      return;
    }
    if (!profile.birth_date) {
      toast.error('請填寫生日');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'failed');
      toast.success('目標已生成', '即將進入主頁…');
      setTimeout(() => { location.href = '/'; }, 900);
    } catch (e: unknown) {
      toast.error('生成失敗', (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-6 py-10 max-w-md mx-auto">
      <div className="m-auto w-full">
        <header className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.28em] text-accent font-mono mb-2">step 01 / 01</p>
          <h1 className="display-roman text-[36px] leading-[0.95]">
            告訴我你的<span className="display">起點</span>
          </h1>
          <p className="text-text-2 text-[14px] mt-3 leading-relaxed">
            AI 會基於這些資料為你算出每日卡路里、蛋白、碳水、脂肪目標。
          </p>
        </header>

        <div className="space-y-4">
          {NUM_SECTIONS.map((s) => (
            <NumberInput
              key={s.key}
              id={s.key}
              label={s.label}
              value={profile[s.key]}
              onValueChange={(v) => setProfile({ ...profile, [s.key as NumKey]: v })}
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
            label="性別"
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
            {busy ? '正在生成你的目標…' : '生成初始目標'}
          </Button>
          <p className="text-[12px] text-text-3 mt-3 text-center">
            資料可在「修改目標」裡隨時調整
          </p>
        </div>
      </div>
    </main>
  );
}
