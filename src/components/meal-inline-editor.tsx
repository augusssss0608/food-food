'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useDeferredRefresh } from '@/components/use-deferred-refresh';
import type { TodayMeal } from './today-meals';

const NUM_KEYS: { key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g'; label: string; unit: string }[] = [
  { key: 'kcal', label: 'KCAL', unit: '' },
  { key: 'protein_g', label: 'PROT', unit: 'g' },
  { key: 'carb_g', label: 'CARB', unit: 'g' },
  { key: 'fat_g', label: 'FAT', unit: 'g' },
  { key: 'fiber_g', label: 'FIBER', unit: 'g' },
];

type Editable = {
  dish_name: string;
  kcal: number | '';
  protein_g: number | '';
  carb_g: number | '';
  fat_g: number | '';
  fiber_g: number | '';
  satiety: number | '';
};

function mealToEditable(m: TodayMeal): Editable {
  return {
    dish_name: m.dish_name ?? '',
    kcal: m.kcal ?? '',
    protein_g: m.protein_g ?? '',
    carb_g: m.carb_g ?? '',
    fat_g: m.fat_g ?? '',
    fiber_g: m.fiber_g ?? '',
    satiety: m.satiety ?? '',
  };
}

const isEmpty = (v: number | '') => v === '' || Number.isNaN(v);

/**
 * 主頁餐點內聯展開編輯器。
 *
 * 評估期 3-variant（A/B/C）結束 → 定稿選 C：
 *   - 緊湊 5 列數值網格，始終可編輯
 *   - 刪除改走主頁 row 左滑揭示刪除按鈕（不在這裡）
 *   - 收起靠再次點主行（不在這裡放按鈕）
 *   - 編輯器只剩單一「儲存」按鈕
 */
export function MealInlineEditor({
  meal,
  onDone,
}: {
  meal: TodayMeal;
  onDone: () => void;
}) {
  const deferredRefresh = useDeferredRefresh();
  const [edit, setEdit] = useState<Editable>(() => mealToEditable(meal));
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        dish_name: edit.dish_name || null,
        kcal: isEmpty(edit.kcal) ? null : edit.kcal,
        protein_g: isEmpty(edit.protein_g) ? null : edit.protein_g,
        carb_g: isEmpty(edit.carb_g) ? null : edit.carb_g,
        fat_g: isEmpty(edit.fat_g) ? null : edit.fat_g,
        fiber_g: isEmpty(edit.fiber_g) ? null : edit.fiber_g,
        satiety: isEmpty(edit.satiety) ? null : edit.satiety,
      };
      const r = await fetch(`/api/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      toast.success('已儲存');
      deferredRefresh();
      onDone();
    } catch (e: unknown) {
      toast.error('儲存失敗', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface-2 border border-hairline border-t-0 rounded-b-xl px-4 py-4 -mt-px">
      <div className="mb-3">
        <Input
          id={`mie-${meal.id}-dish`}
          label="菜名"
          type="text"
          value={edit.dish_name}
          onChange={(e) => setEdit({ ...edit, dish_name: e.target.value })}
          placeholder="未命名"
        />
      </div>

      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {NUM_KEYS.map((k) => (
          <CompactNumberBox
            key={k.key}
            id={`mie-${meal.id}-${k.key}`}
            label={k.label}
            value={edit[k.key]}
            unit={k.unit}
            onChange={(v) => setEdit({ ...edit, [k.key]: v })}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-[12px] uppercase tracking-[0.14em] text-text-2 font-mono w-20 flex-shrink-0">
          飽腹感
        </span>
        <div className="flex-1 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEdit({ ...edit, satiety: edit.satiety === n ? '' : n })}
              className={[
                'flex-1 h-10 rounded-md text-[14px] font-mono transition-colors',
                edit.satiety === n
                  ? 'bg-accent text-accent-ink'
                  : 'bg-surface-3 border border-hairline text-text-2 hover:border-hairline-strong',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={save} loading={busy} className="w-full">
        儲存
      </Button>
    </div>
  );
}

function CompactNumberBox({
  id,
  label,
  value,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number | '';
  unit: string;
  onChange: (v: number | '') => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <label
        htmlFor={id}
        className="text-[9px] uppercase tracking-[0.1em] text-text-3 font-mono mb-1 leading-none"
      >
        {label}
      </label>
      <div className="relative w-full">
        <input
          id={id}
          name={id}
          aria-label={`${label}${unit ? ` (${unit})` : ''}`}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? '' : Number(raw));
          }}
          className="w-full h-11 bg-surface-3 border border-hairline rounded-md text-center font-mono tabular text-[13px] text-text outline-none focus:border-accent/60 transition-colors px-1"
        />
        {unit && (
          <span className="absolute right-1.5 bottom-1 text-[9px] text-text-4 font-mono pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
