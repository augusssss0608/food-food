'use client';
import { useState } from 'react';
import { AiMetaChip } from './ai-meta-chip';
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

const NUM_KEYS = ['weight_kg','body_fat_pct','skeletal_muscle_pct','visceral_fat','bmi'] as const;
type NumKey = typeof NUM_KEYS[number];

export function BodyPreviewCard({
  initial, onConfirm, onCancel,
}: {
  initial: BodyPreview;
  onConfirm: (edited: BodyPreview) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState(initial);
  return (
    <div className="border rounded p-4 space-y-2">
      <AiMetaChip meta={data._meta} />
      {NUM_KEYS.map((k) => (
        <label key={k} className="block text-sm">
          {k}:
          <input type="number" step="0.1" value={data[k] ?? ''}
                 onChange={(e) => setData({ ...data, [k as NumKey]: e.target.value ? Number(e.target.value) : undefined })}
                 className="ml-2 border px-2 py-1 w-24" />
        </label>
      ))}
      <div className="flex gap-2">
        <button onClick={() => onConfirm(data)} className="bg-black text-white px-4 py-2 rounded">确认入库</button>
        <button onClick={onCancel} className="px-4 py-2 rounded border">取消</button>
      </div>
    </div>
  );
}
