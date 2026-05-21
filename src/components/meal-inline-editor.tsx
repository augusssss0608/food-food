'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineNumberInput } from '@/components/ui/inline-number-input';
import { isEmptyNum } from '@/components/ui/number-input';
import { useToast } from '@/components/ui/toast';
import type { TodayMeal } from './today-meals';

const NUM_KEYS: { key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g'; label: string; suffix: string; big?: boolean }[] = [
  { key: 'kcal', label: 'kcal', suffix: '', big: true },
  { key: 'protein_g', label: 'protein', suffix: 'g' },
  { key: 'carb_g', label: 'carb', suffix: 'g' },
  { key: 'fat_g', label: 'fat', suffix: 'g' },
  { key: 'fiber_g', label: 'fiber', suffix: 'g' },
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

/**
 * TodayMeals 內聯展開的 meal 編輯區（取代原 MealDetailSheet 半窗模式）。
 * 同一個 PATCH / DELETE API，同一個 inline confirm 刪除流程，純樣式從 sheet 改成 inline。
 *
 * router.refresh 用 useTransition 包，避免新增/編輯後立刻點 drawer 跳轉被卡住（用戶反饋的 2-3s 延遲）。
 */
export function MealInlineEditor({
  meal,
  onDone,
}: {
  meal: TodayMeal;
  onDone: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [edit, setEdit] = useState<Editable>(() => mealToEditable(meal));
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy('save');
    try {
      const payload: Record<string, unknown> = {
        dish_name: edit.dish_name || null,
        kcal: isEmptyNum(edit.kcal) ? null : edit.kcal,
        protein_g: isEmptyNum(edit.protein_g) ? null : edit.protein_g,
        carb_g: isEmptyNum(edit.carb_g) ? null : edit.carb_g,
        fat_g: isEmptyNum(edit.fat_g) ? null : edit.fat_g,
        fiber_g: isEmptyNum(edit.fiber_g) ? null : edit.fiber_g,
        satiety: isEmptyNum(edit.satiety) ? null : edit.satiety,
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
      startTransition(() => router.refresh());
      onDone();
    } catch (e: unknown) {
      toast.error('儲存失敗', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function del() {
    setBusy('delete');
    try {
      const r = await fetch(`/api/meals/${meal.id}`, {
        method: 'DELETE',
        headers: { 'sec-fetch-site': 'same-origin' },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      toast.success('已刪除');
      startTransition(() => router.refresh());
      onDone();
    } catch (e: unknown) {
      toast.error('刪除失敗', (e as Error).message);
    } finally {
      setBusy(null);
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

      <div className="space-y-3 mb-4">
        {NUM_KEYS.map((k) => (
          <InlineNumberInput
            key={k.key}
            id={`mie-${meal.id}-${k.key}`}
            label={k.label}
            value={edit[k.key]}
            onValueChange={(v) => setEdit({ ...edit, [k.key]: v })}
            big={k.big}
            suffix={k.suffix}
          />
        ))}

        {/* 飽腹感 5 按鈕 */}
        <div className="flex items-center gap-3 pt-1">
          <label
            htmlFor={`mie-${meal.id}-sat`}
            className="text-[12px] uppercase tracking-[0.14em] text-text-3 font-mono w-20 flex-shrink-0"
          >
            飽腹感
          </label>
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
      </div>

      {confirmDel ? (
        <div className="bg-danger/10 border border-danger/40 rounded-lg px-4 py-3">
          <p className="text-[13px] text-text">
            確定刪除 <span className="text-danger">「{meal.dish_name ?? '未命名'}」</span>？
          </p>
          <p className="text-[11px] text-text-3 mt-1">此操作不可撤銷</p>
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDel(false)} disabled={busy != null} className="flex-1">取消</Button>
            <Button variant="danger" size="sm" onClick={del} loading={busy === 'delete'} className="flex-1">確認刪除</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfirmDel(true)} disabled={busy != null} className="text-danger">
            刪除
          </Button>
          <Button variant="secondary" onClick={onDone} disabled={busy != null} className="flex-1">
            收起
          </Button>
          <Button onClick={save} loading={busy === 'save'} className="flex-1">
            儲存
          </Button>
        </div>
      )}
    </div>
  );
}
