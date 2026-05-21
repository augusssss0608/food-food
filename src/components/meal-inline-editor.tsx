'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineNumberInput } from '@/components/ui/inline-number-input';
import { isEmptyNum } from '@/components/ui/number-input';
import { useToast } from '@/components/ui/toast';
import type { TodayMeal } from './today-meals';

export type MealEditorVariant = 'a' | 'b' | 'c';

const NUM_KEYS: { key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g'; label: string; suffix: string }[] = [
  { key: 'kcal', label: 'kcal', suffix: '' },
  { key: 'protein_g', label: 'protein', suffix: 'g' },
  { key: 'carb_g', label: 'carb', suffix: 'g' },
  { key: 'fat_g', label: 'fat', suffix: 'g' },
  { key: 'fiber_g', label: 'fiber', suffix: 'g' },
];

const READONLY_LABELS: Record<string, { display: string; unit: string }> = {
  kcal: { display: 'KCAL', unit: '' },
  protein_g: { display: '蛋白', unit: 'g' },
  carb_g: { display: '碳水', unit: 'g' },
  fat_g: { display: '脂肪', unit: 'g' },
  fiber_g: { display: '纖維', unit: 'g' },
};

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

function fmt(v: number | ''): string {
  return v === '' ? '—' : String(v);
}

/**
 * TodayMeals 內聯展開的 meal 編輯區。
 *
 * 三個 variant 並存（用戶評估期，挑完留一個刪另外兩個）：
 * - a：默認只讀 2 列 + 編輯切換
 * - b：Apple Health 大號 kcal + 2 列 chip + 編輯切換
 * - c：緊湊 5 列網格 + 始終可編輯
 *
 * variant 從 TodayMeals 透傳，每個 variant 都共用 save / del / 飽腹感 / 刪除確認流。
 */
export function MealInlineEditor({
  meal,
  onDone,
  variant = 'a',
}: {
  meal: TodayMeal;
  onDone: () => void;
  variant?: MealEditorVariant;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [edit, setEdit] = useState<Editable>(() => mealToEditable(meal));
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  // a/b 默認只讀；c 始終編輯
  const [editing, setEditing] = useState(variant === 'c');
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

  // 編輯態：5 按鈕可改；只讀態：純展示（codex round A medium：A/B 只讀態按鈕可改但無 save → 數據丟）
  const satietyEdit = (
    <div className="flex items-center gap-3">
      <span
        className="text-[12px] uppercase tracking-[0.14em] text-text-2 font-mono w-20 flex-shrink-0"
      >
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
  );
  const satietyReadOnly = (
    <div className="flex items-center gap-3">
      <span className="text-[12px] uppercase tracking-[0.14em] text-text-2 font-mono w-20 flex-shrink-0">
        飽腹感
      </span>
      <span className="text-[13px] text-text font-mono tabular">
        {edit.satiety === '' ? <span className="text-text-3">未打分</span> : `飽 ${edit.satiety}`}
      </span>
    </div>
  );

  function cancelEdit() {
    // codex round A medium：取消必須 reset edit 到原始值，否則殘留會在下次編輯被保存
    setEdit(mealToEditable(meal));
    setEditing(false);
  }

  const deleteConfirmPanel = (
    <div className="bg-danger/10 border border-danger/40 rounded-lg px-4 py-3 mt-4">
      <p className="text-[13px] text-text">
        確定刪除 <span className="text-danger">「{meal.dish_name ?? '未命名'}」</span>？
      </p>
      <p className="text-[11px] text-text-3 mt-1">此操作不可撤銷</p>
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" size="sm" onClick={() => setConfirmDel(false)} disabled={busy != null} className="flex-1">取消</Button>
        <Button variant="danger" size="sm" onClick={del} loading={busy === 'delete'} className="flex-1">確認刪除</Button>
      </div>
    </div>
  );

  // ============ variant a: 只讀 2 列 + 編輯切換 ============
  if (variant === 'a' && !editing) {
    return (
      <div className="bg-surface-2 border border-hairline border-t-0 rounded-b-xl px-4 py-4 -mt-px">
        {edit.dish_name && (
          // line-clamp-2 防止超長菜名把卡片拉得很高（codex round B：版面取捨低優先級補上）
          <p className="text-[14px] text-text font-medium mb-3 line-clamp-2 break-words">{edit.dish_name}</p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
          {NUM_KEYS.map((k) => (
            <ReadOnlyMetric key={k.key} label={READONLY_LABELS[k.key]!.display} value={edit[k.key]} unit={READONLY_LABELS[k.key]!.unit} />
          ))}
        </div>
        {satietyReadOnly}
        {confirmDel ? deleteConfirmPanel : (
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDel(true)} disabled={busy != null} className="text-danger">
              刪除
            </Button>
            <Button variant="secondary" onClick={onDone} disabled={busy != null} className="flex-1">
              收起
            </Button>
            <Button onClick={() => setEditing(true)} disabled={busy != null} className="flex-1">
              編輯
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ============ variant b: Apple Health 大號 ============
  if (variant === 'b' && !editing) {
    const kcalNum = typeof edit.kcal === 'number' ? edit.kcal : 0;
    return (
      <div className="bg-surface-2 border border-hairline border-t-0 rounded-b-xl px-4 py-5 -mt-px">
        {edit.dish_name && (
          <p className="text-[14px] text-text font-medium mb-4 text-center line-clamp-2 break-words">{edit.dish_name}</p>
        )}
        <div className="text-center mb-5">
          <p className="font-mono tabular text-[44px] leading-none text-accent">
            {kcalNum > 0 ? kcalNum : '—'}
            <span className="text-[13px] text-text-3 ml-1.5 font-medium">kcal</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          <NutritionChip label="蛋白" value={edit.protein_g} unit="g" />
          <NutritionChip label="碳水" value={edit.carb_g} unit="g" />
          <NutritionChip label="脂肪" value={edit.fat_g} unit="g" />
          <NutritionChip label="纖維" value={edit.fiber_g} unit="g" />
        </div>
        {satietyReadOnly}
        {confirmDel ? deleteConfirmPanel : (
          <div className="flex gap-2 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDel(true)} disabled={busy != null} className="text-danger">
              刪除
            </Button>
            <Button variant="secondary" onClick={onDone} disabled={busy != null} className="flex-1">
              收起
            </Button>
            <Button onClick={() => setEditing(true)} disabled={busy != null} className="flex-1">
              編輯
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ============ variant c: 緊湊 5 列網格 + 始終可編輯 ============
  if (variant === 'c') {
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
              id={`mie-${meal.id}-c-${k.key}`}
              label={READONLY_LABELS[k.key]!.display}
              value={edit[k.key]}
              unit={READONLY_LABELS[k.key]!.unit}
              onChange={(v) => setEdit({ ...edit, [k.key]: v })}
            />
          ))}
        </div>
        {satietyEdit}
        {confirmDel ? deleteConfirmPanel : (
          <div className="flex gap-2 mt-4">
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

  // ============ variant a/b 的編輯態（共用垂直 form） ============
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
            suffix={k.suffix}
          />
        ))}
        {satietyEdit}
      </div>
      {confirmDel ? deleteConfirmPanel : (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setConfirmDel(true)} disabled={busy != null} className="text-danger">
            刪除
          </Button>
          <Button variant="secondary" onClick={cancelEdit} disabled={busy != null} className="flex-1">
            取消
          </Button>
          <Button onClick={save} loading={busy === 'save'} className="flex-1">
            儲存
          </Button>
        </div>
      )}
    </div>
  );
}

function ReadOnlyMetric({ label, value, unit }: { label: string; value: number | ''; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 border-b border-hairline/40">
      <span className="text-[11px] uppercase tracking-[0.12em] text-text-3 font-mono">{label}</span>
      <span className="text-[14px] text-text font-mono tabular">
        {fmt(value)}
        {value !== '' && <span className="text-[11px] text-text-3 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

function NutritionChip({ label, value, unit }: { label: string; value: number | ''; unit: string }) {
  return (
    <div className="bg-surface-3 border border-hairline rounded-lg px-3 py-2.5 flex items-baseline justify-between">
      <span className="text-[11px] text-text-3 font-mono">{label}</span>
      <span className="text-[15px] text-text font-mono tabular">
        {fmt(value)}
        {value !== '' && <span className="text-[10px] text-text-3 ml-0.5">{unit}</span>}
      </span>
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
