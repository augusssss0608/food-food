'use client';
import { useState } from 'react';
import { AiMetaChip } from './ai-meta-chip';
import { Button } from './ui/button';
import { Card } from './ui/card';
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

const NUM_KEYS: { key: 'weight_kg' | 'body_fat_pct' | 'skeletal_muscle_pct' | 'visceral_fat' | 'bmi'; label: string; suffix: string; big?: boolean }[] = [
  { key: 'weight_kg', label: 'weight', suffix: 'kg', big: true },
  { key: 'body_fat_pct', label: 'body fat', suffix: '%' },
  { key: 'skeletal_muscle_pct', label: 'muscle', suffix: '%' },
  { key: 'visceral_fat', label: 'visceral', suffix: '' },
  { key: 'bmi', label: 'bmi', suffix: '' },
];

type NumKey = (typeof NUM_KEYS)[number]['key'];

export function BodyPreviewCard({
  initial, onConfirm, onCancel, busy = false,
}: {
  initial: BodyPreview;
  onConfirm: (edited: BodyPreview) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [data, setData] = useState(initial);
  return (
    <Card className="overflow-hidden anim-enter">
      <div className="px-5 pt-5 pb-3 border-b border-hairline flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-mono">body metrics</p>
        <AiMetaChip meta={data._meta} />
      </div>
      <div className="px-5 py-4 space-y-3">
        {NUM_KEYS.map((k) => (
          <div key={k.key} className="flex items-center gap-3">
            <label htmlFor={`bp-${k.key}`} className="text-[12px] uppercase tracking-[0.14em] text-text-3 font-mono w-24 flex-shrink-0">
              {k.label}
            </label>
            <input
              id={`bp-${k.key}`}
              type="number"
              step="0.1"
              value={(data[k.key as NumKey] ?? '') as number | string}
              onChange={(e) =>
                setData({
                  ...data,
                  [k.key as NumKey]: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={[
                'flex-1 bg-surface-2 border border-hairline rounded-md px-3 outline-none',
                'focus:border-accent/60 transition-colors text-text tabular',
                k.big ? 'h-12 text-[20px] font-mono' : 'h-10 text-[14px]',
              ].join(' ')}
            />
            {k.suffix && <span className="text-[12px] text-text-3 font-mono w-5">{k.suffix}</span>}
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-5 pb-5">
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">取消</Button>
        <Button onClick={() => onConfirm(data)} loading={busy} className="flex-1">
          确认入库
        </Button>
      </div>
    </Card>
  );
}
