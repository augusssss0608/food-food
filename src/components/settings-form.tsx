'use client';
import { useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { NumberInput, isEmptyNum } from '@/components/ui/number-input';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/components/ui/toast';

type NumKey =
  | 'kcal_workout_day'
  | 'kcal_rest_day'
  | 'protein_g'
  | 'carb_workout_day'
  | 'carb_rest_day'
  | 'fat_g'
  | 'fiber_g';

export type SettingsInitial = {
  user_id: string;
  kcal_workout_day: number | null;
  kcal_rest_day: number | null;
  protein_g: number | null;
  carb_workout_day: number | null;
  carb_rest_day: number | null;
  fat_g: number | null;
  fiber_g: number | null;
};

type DisplayProfile = { user_id: string } & Record<NumKey, number | ''>;

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

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  // null → '' 給 NumberInput 顯示空（允許清空後重輸）
  const [profile, setProfile] = useState<DisplayProfile>(() => ({
    user_id: initial.user_id,
    kcal_workout_day: initial.kcal_workout_day ?? '',
    kcal_rest_day: initial.kcal_rest_day ?? '',
    protein_g: initial.protein_g ?? '',
    carb_workout_day: initial.carb_workout_day ?? '',
    carb_rest_day: initial.carb_rest_day ?? '',
    fat_g: initial.fat_g ?? '',
    fiber_g: initial.fiber_g ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const supa = useMemo(() => createSupabaseBrowserClient(), []);
  const toast = useToast();

  async function save() {
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

  const energy = FIELDS.filter((f) => f.group === 'energy');
  const macro = FIELDS.filter((f) => f.group === 'macro');

  return (
    <PageShell>
      <PageHeader>
        <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">targets</p>
        <h1 className="display-roman text-[32px] leading-none">修改目標</h1>
      </PageHeader>

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

      <FormulaNote />

      <div className="mt-8">
        <Button size="lg" onClick={save} loading={busy} className="w-full">
          {busy ? '儲存中…' : '儲存目標'}
        </Button>
      </div>
    </PageShell>
  );
}

/**
 * 計算依據說明（從 src/lib/ai-provider/fallback-tdee.ts 對齊）。
 * 首次設定時用這套公式生成預設值；用戶在這頁手動改任意數字後 targets_source = 'user_override'，
 * 不再自動跟著體重 / 訓練天數變化。
 */
function FormulaNote() {
  return (
    <details className="mb-2 bg-surface border border-hairline rounded-xl overflow-hidden">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[12px] uppercase tracking-[0.18em] text-text-2 font-mono">計算依據</span>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-3 transition-transform [details[open]>summary>&]:rotate-90">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-1 text-[13px] text-text-2 leading-relaxed space-y-3 border-t border-hairline">
        <FormulaBlock
          step="1"
          title="基礎代謝率 BMR"
          formula={[
            '男：10×體重 + 6.25×身高 − 5×年齡 + 5',
            '女：10×體重 + 6.25×身高 − 5×年齡 − 161',
          ]}
          note="Mifflin-St Jeor 公式，估算靜止時每日消耗"
        />
        <FormulaBlock
          step="2"
          title="活動係數"
          formula={['1.2 + 0.175 × min(每週訓練天數, 6)']}
          note="坐辦公基線 1.2，每週訓練 1 天 +0.175，最多 6 天封頂"
        />
        <FormulaBlock
          step="3"
          title="每日總熱量 TDEE"
          formula={['TDEE = BMR × 活動係數']}
        />
        <FormulaBlock
          step="4"
          title="訓練 / 休息日卡路里"
          formula={[
            '訓練日 = TDEE × 1.05（運動補回 +5%）',
            '休息日 = TDEE × 0.85（熱量赤字 −15%）',
          ]}
        />
        <FormulaBlock
          step="5"
          title="宏量營養"
          formula={[
            '蛋白質 = 體重 × 2.0 g/kg',
            '脂肪 = TDEE × 25% ÷ 9 kcal/g',
            '碳水 = (當日卡路里 − 蛋白質×4 − 脂肪×9) ÷ 4',
            '纖維 = 28 g（固定建議）',
          ]}
        />
        <p className="text-[11px] text-text-3 pt-2 border-t border-hairline/60">
          首次設定按此公式生成；在這頁手改任意數字後，目標來源切到「手動覆蓋」，
          不再自動跟體重 / 訓練天數變化。
        </p>
      </div>
    </details>
  );
}

function FormulaBlock({ step, title, formula, note }: { step: string; title: string; formula: string[]; note?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-text-3 font-mono mb-1">
        步驟 {step} · {title}
      </p>
      <ul className="font-mono text-[12px] text-text space-y-0.5 tabular">
        {formula.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
      {note && <p className="text-[11px] text-text-3 mt-1.5">{note}</p>}
    </div>
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
