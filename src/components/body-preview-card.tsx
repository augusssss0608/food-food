'use client';
import { useState } from 'react';
import { AiMetaChip } from './ai-meta-chip';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { InlineNumberInput } from './ui/inline-number-input';
import { isEmptyNum } from './ui/number-input';
import { useToast } from './ui/toast';
import type { AiMeta } from '@/lib/ai-provider';

export type BodyPreview = {
  weight_kg: number;
  body_fat_pct?: number;
  skeletal_muscle_pct?: number;
  visceral_fat?: number;
  bmi?: number;
  measured_at?: string;
  _meta: AiMeta;
};

const NUM_KEYS: { key: 'weight_kg' | 'body_fat_pct' | 'skeletal_muscle_pct' | 'visceral_fat' | 'bmi'; label: string; suffix: string; big?: boolean; required?: boolean }[] = [
  { key: 'weight_kg', label: 'weight', suffix: 'kg', big: true, required: true },
  { key: 'body_fat_pct', label: 'body fat', suffix: '%' },
  { key: 'skeletal_muscle_pct', label: 'muscle', suffix: '%' },
  { key: 'visceral_fat', label: 'visceral', suffix: '' },
  { key: 'bmi', label: 'bmi', suffix: '' },
];

type NumKey = (typeof NUM_KEYS)[number]['key'];

// 编辑期所有字段都允许 ''；提交时只校验 required 字段（weight_kg）
type Editable = Omit<BodyPreview, 'weight_kg' | 'body_fat_pct' | 'skeletal_muscle_pct' | 'visceral_fat' | 'bmi'>
  & Record<NumKey, number | ''>;

export function BodyPreviewCard({
  initial, onConfirm, onCancel, busy = false,
}: {
  initial: BodyPreview;
  onConfirm: (edited: BodyPreview) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [data, setData] = useState<Editable>({
    ...initial,
    weight_kg: initial.weight_kg,
    body_fat_pct: initial.body_fat_pct ?? '',
    skeletal_muscle_pct: initial.skeletal_muscle_pct ?? '',
    visceral_fat: initial.visceral_fat ?? '',
    bmi: initial.bmi ?? '',
  });
  const toast = useToast();

  function handleConfirm() {
    if (isEmptyNum(data.weight_kg)) {
      toast.error('體重不能為空');
      return;
    }
    // 把 '' 转回 undefined（API 端只接受 number 或缺省）
    const payload: BodyPreview = {
      ...data,
      weight_kg: data.weight_kg,
      body_fat_pct: isEmptyNum(data.body_fat_pct) ? undefined : data.body_fat_pct,
      skeletal_muscle_pct: isEmptyNum(data.skeletal_muscle_pct) ? undefined : data.skeletal_muscle_pct,
      visceral_fat: isEmptyNum(data.visceral_fat) ? undefined : data.visceral_fat,
      bmi: isEmptyNum(data.bmi) ? undefined : data.bmi,
    };
    onConfirm(payload);
  }

  return (
    <Card className="overflow-hidden anim-enter">
      <div className="px-5 pt-5 pb-3 border-b border-hairline flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-mono">body metrics</p>
        <AiMetaChip meta={data._meta} />
      </div>
      <div className="px-5 py-4 space-y-3">
        {NUM_KEYS.map((k) => (
          <InlineNumberInput
            key={k.key}
            id={`bp-${k.key}`}
            label={k.label}
            value={data[k.key]}
            onValueChange={(v) => setData({ ...data, [k.key]: v })}
            big={k.big}
            suffix={k.suffix}
            step="0.1"
            labelWidth="w-24"
          />
        ))}
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
