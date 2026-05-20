'use client';
import { useState } from 'react';
import { AiMetaChip } from './ai-meta-chip';
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

const NUM_KEYS = ['kcal','protein_g','carb_g','fat_g','fiber_g'] as const;
type NumKey = typeof NUM_KEYS[number];

export function MealPreviewCard({
  initial, onConfirm, onCancel,
}: {
  initial: MealPreview;
  onConfirm: (edited: MealPreview, satiety: number | undefined) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState(initial);
  const [satiety, setSatiety] = useState<number | undefined>(undefined);

  return (
    <div className="border rounded p-4 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{data.dish_name}</h3>
        <AiMetaChip meta={data._meta} />
      </div>
      {NUM_KEYS.map((k) => (
        <label key={k} className="block text-sm">
          {k}:
          <input type="number" value={data[k]}
                 onChange={(e) => setData({ ...data, [k as NumKey]: Number(e.target.value) })}
                 className="ml-2 border px-2 py-1 w-24" />
        </label>
      ))}
      <label className="block text-sm">
        饱腹感 (1-5):
        <input type="number" min="1" max="5" value={satiety ?? ''}
               onChange={(e) => setSatiety(e.target.value ? Number(e.target.value) : undefined)}
               className="ml-2 border px-2 py-1 w-16" />
      </label>
      <p className="text-xs text-gray-500">ⓘ 本次拍摄仅用于估算，**确认后照片即删除不保留**</p>
      <div className="flex gap-2">
        <button onClick={() => onConfirm(data, satiety)} className="bg-black text-white px-4 py-2 rounded">确认入库</button>
        <button onClick={onCancel} className="px-4 py-2 rounded border">取消</button>
      </div>
    </div>
  );
}
