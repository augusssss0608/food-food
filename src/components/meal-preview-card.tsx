'use client';
import { useState } from 'react';
import { AiMetaChip } from './ai-meta-chip';
import { Button } from './ui/button';
import { Card } from './ui/card';
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

export function MealPreviewCard({
  initial, onConfirm, onCancel, busy = false,
}: {
  initial: MealPreview;
  onConfirm: (edited: MealPreview, satiety: number | undefined) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [satiety, setSatiety] = useState<number | undefined>(undefined);

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
        {NUM_KEYS.map((k) => (
          <div key={k.key} className="flex items-center gap-3">
            <label htmlFor={`mp-${k.key}`} className="text-[12px] uppercase tracking-[0.14em] text-text-3 font-mono w-20 flex-shrink-0">
              {k.label}
            </label>
            <input
              id={`mp-${k.key}`}
              type="number"
              value={data[k.key as NumKey]}
              onChange={(e) =>
                setData({ ...data, [k.key as NumKey]: Number(e.target.value) })
              }
              className={[
                'flex-1 bg-surface-2 border border-hairline rounded-md px-3 outline-none',
                'focus:border-accent/60 transition-colors text-text tabular',
                k.big ? 'h-12 text-[20px] font-mono' : 'h-10 text-[14px]',
              ].join(' ')}
            />
            {k.suffix && (
              <span className="text-[12px] text-text-3 font-mono w-4">{k.suffix}</span>
            )}
          </div>
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
        <Button onClick={() => onConfirm(data, satiety)} loading={busy} className="flex-1">
          確認入庫
        </Button>
      </div>
    </Card>
  );
}
