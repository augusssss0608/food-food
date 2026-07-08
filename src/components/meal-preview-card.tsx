'use client';
import { useState } from 'react';
import { AiMetaChip } from './ai-meta-chip';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { CategoryCombobox } from './category-combobox';
import { InlineNumberInput } from './ui/inline-number-input';
import { isEmptyNum } from './ui/number-input';
import { useToast } from './ui/toast';
import type { AiMeta } from '@/lib/ai-provider';

export type MealPreview = {
  dish_name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: string;
  _meta: AiMeta;
};

const NUM_KEYS: { key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g'; label: string; big?: boolean; suffix?: string }[] = [
  { key: 'kcal', label: 'kcal', big: true },
  { key: 'protein_g', label: 'protein', suffix: 'g' },
  { key: 'carb_g', label: 'carb', suffix: 'g' },
  { key: 'fat_g', label: 'fat', suffix: 'g' },
  { key: 'fiber_g', label: 'fiber', suffix: 'g' },
];

type NumKey = (typeof NUM_KEYS)[number]['key'];

type Editable = Omit<MealPreview, 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g'>
  & Record<NumKey, number | ''>;

export function MealPreviewCard({
  initial, existingCategories, onConfirm, onCancel, busy = false,
}: {
  initial: MealPreview;
  existingCategories: string[];
  onConfirm: (edited: MealPreview, satiety: number | undefined, category: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [data, setData] = useState<Editable>(initial);
  const [category, setCategory] = useState('');
  const [satiety, setSatiety] = useState<number | undefined>(undefined);
  const toast = useToast();

  function handleConfirm() {
    if (category.trim().length === 0) {
      toast.error('請填寫類別', '類別為必填');
      return;
    }
    const empty = NUM_KEYS.find((k) => isEmptyNum(data[k.key]));
    if (empty) {
      toast.error('請填寫所有數值', `${empty.label} 不能為空`);
      return;
    }
    onConfirm(data as MealPreview, satiety, category.trim());
  }

  return (
    <Card className="overflow-hidden anim-enter">
      <div className="px-5 pt-5 pb-4 border-b border-hairline">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="display-roman text-[22px] leading-tight text-text">{data.dish_name}</h3>
          <AiMetaChip meta={data._meta} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">
          confidence · {data.confidence}
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <CategoryCombobox
          value={category}
          onChange={setCategory}
          options={existingCategories}
          disabled={busy}
          label="類別 *"
        />
        {NUM_KEYS.map((k) => (
          <InlineNumberInput
            key={k.key}
            id={`mp-${k.key}`}
            label={k.label}
            value={data[k.key]}
            onValueChange={(v) => setData({ ...data, [k.key]: v })}
            big={k.big}
            suffix={k.suffix}
          />
        ))}

        <div className="flex items-center gap-3 pt-1">
          <label htmlFor="mp-sat" className="text-[12px] uppercase tracking-[0.14em] text-text-3 font-mono w-20 flex-shrink-0">
            飽腹感
          </label>
          <div className="flex-1 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSatiety(satiety === n ? undefined : n)}
                className={[
                  'flex-1 h-10 rounded-md text-[14px] font-mono transition-colors',
                  satiety === n
                    ? 'bg-accent text-accent-ink'
                    : 'bg-surface-2 border border-hairline text-text-2 hover:border-hairline-strong',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-text-4 mt-3">
          ⓘ 照片僅用於估算，確認後不保留。
        </p>
      </div>

      <div className="flex gap-2 px-5 pb-5">
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">取消</Button>
        <Button onClick={handleConfirm} loading={busy} className="flex-1">
          確認入庫
        </Button>
      </div>
    </Card>
  );
}
