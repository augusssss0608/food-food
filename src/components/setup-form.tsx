'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { NumberInput, isEmptyNum } from '@/components/ui/number-input';
import { PageShell } from '@/components/ui/page-shell';
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

// onboarding：/ 在沒 profile 時 inline render，首次填資料的流程，無返回；
// edit：drawer「個人資料」進 /setup 編輯既有 profile，有返回主頁按鈕。
type Mode = 'onboarding' | 'edit';

export function SetupForm({
  initial,
  mode,
}: {
  initial?: SetupInitial;
  mode?: Mode;
} = {}) {
  // 沒明確指定就按 initial 有沒有來判斷：有 initial（drawer 進來的編輯路徑）= edit
  const m: Mode = mode ?? (initial ? 'edit' : 'onboarding');

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
      toast.success(m === 'onboarding' ? '目標已生成' : '已儲存', m === 'onboarding' ? '即將進入主頁…' : '個人資料已更新');
      setTimeout(() => { location.replace('/'); }, 900);
    } catch (e: unknown) {
      toast.error(m === 'onboarding' ? '生成失敗' : '儲存失敗', (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <PageShell px="px-6">
        {m === 'edit' && (
          <Link
            href="/"
            prefetch
            replace
            className="inline-flex items-center text-[13px] text-text-3 hover:text-text transition-colors mb-4 -ml-1"
          >
            ← 主頁
          </Link>
        )}
        <header className="mb-8">
          {m === 'onboarding' ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.28em] text-accent font-mono mb-2">step 01 / 01</p>
              <h1 className="display-roman text-[36px] leading-[0.95]">
                告訴我你的<span className="display">起點</span>
              </h1>
              <p className="text-text-2 text-[14px] mt-3 leading-relaxed">
                AI 會基於這些資料為你算出每日卡路里、蛋白、碳水、脂肪目標。
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-[0.28em] text-text-3 font-mono mb-2">profile</p>
              <h1 className="display-roman text-[36px] leading-[0.95]">
                個人<span className="display">資料</span>
              </h1>
              <p className="text-text-2 text-[14px] mt-3 leading-relaxed">
                修改身高 / 體重 / 訓練頻率，會基於新值重新計算目標。
              </p>
            </>
          )}
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
            onValueChange={(v) =>
              setProfile({ ...profile, sex: v as 'male' | 'female' })
            }
            options={[
              { value: 'male', label: '男' },
              { value: 'female', label: '女' },
            ]}
          />
        </div>

        <div className="mt-10">
          <Button onClick={submit} size="lg" loading={busy} className="w-full">
            {busy
              ? (m === 'onboarding' ? '正在生成你的目標…' : '儲存中…')
              : (m === 'onboarding' ? '生成初始目標' : '儲存資料')}
          </Button>
          <p className="text-[12px] text-text-3 mt-3 text-center">
            {m === 'onboarding' ? '資料可在「個人資料」裡隨時調整' : '想單獨改卡路里 / 宏量目標，到「修改目標」'}
          </p>
        </div>
    </PageShell>
  );
}
