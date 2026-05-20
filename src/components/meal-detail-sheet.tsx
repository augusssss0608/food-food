'use client';
import { useEffect, useState } from 'react';
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

const SOURCE_LABEL: Record<TodayMeal['source'], string> = {
  preset: 'preset',
  photo_ai: 'AI 識別',
  manual: '手動',
};

type Editable = {
  dish_name: string;
  kcal: number | '';
  protein_g: number | '';
  carb_g: number | '';
  fat_g: number | '';
  fiber_g: number | '';
  satiety: number | '';
  notes: string;
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
    notes: '',  // notes 字段在 TodayMeal type 沒帶；可以 future 加，這裡先不顯示
  };
}

/**
 * 點今日 meal 列表的某條 → 彈這個面板（slide up from bottom）。
 * 可改 dish_name / kcal / 蛋白 / 碳水 / 脂肪 / 纖維 / 飽腹感，或刪除整筆。
 * 保存 → PATCH /api/meals/[id]；刪除 → DELETE /api/meals/[id]。
 * 完成後 router.refresh() 拉新 server 資料，今日摘要 + 列表同步更新。
 */
export function MealDetailSheet({
  meal,
  timezone,
  onClose,
}: {
  meal: TodayMeal | null;
  timezone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<Editable | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const toast = useToast();

  // meal 切換時把 edit 重置成那條 meal 的當前值
  useEffect(() => {
    setEdit(meal ? mealToEditable(meal) : null);
    setConfirmDel(false);
  }, [meal]);

  // ESC 關閉 + body 鎖滾
  useEffect(() => {
    if (!meal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [meal, onClose]);

  if (!meal || !edit) return null;

  async function save() {
    if (!meal || !edit) return;
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
      router.refresh();
      onClose();
    } catch (e: unknown) {
      toast.error('儲存失敗', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function del() {
    if (!meal) return;
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
      router.refresh();
      onClose();
    } catch (e: unknown) {
      toast.error('刪除失敗', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const ateAtLabel = new Date(meal.ate_at).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: timezone,
  });

  return (
    <>
      {/* overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 70,
          background: 'rgba(10,10,12,0.5)',
          transition: 'opacity 200ms ease-out',
        }}
      />
      {/* sheet — slide up from bottom */}
      <aside
        role="dialog"
        aria-label="meal detail"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 71,
          background: 'var(--color-surface-2)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--color-hairline)',
          maxHeight: 'calc(100dvh - 4rem)',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
        }}
      >
        {/* drag handle */}
        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
          <div
            style={{
              width: 36, height: 4,
              background: 'var(--color-hairline-strong)',
              borderRadius: 2,
            }}
          />
        </div>

        {/* scroll area */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-2">
          <header className="mb-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-mono mb-1">
              {ateAtLabel} · {SOURCE_LABEL[meal.source]}
            </p>
            <Input
              id="meal-dish_name"
              label="菜名"
              type="text"
              value={edit.dish_name}
              onChange={(e) => setEdit({ ...edit, dish_name: e.target.value })}
              placeholder="未命名"
            />
          </header>

          <div className="space-y-3 mb-5">
            {NUM_KEYS.map((k) => (
              <InlineNumberInput
                key={k.key}
                id={`meal-${k.key}`}
                label={k.label}
                value={edit[k.key]}
                onValueChange={(v) => setEdit({ ...edit, [k.key]: v })}
                big={k.big}
                suffix={k.suffix}
              />
            ))}

            {/* 飽腹感 — 5 個按鈕 */}
            <div className="flex items-center gap-3 pt-1">
              <label
                htmlFor="meal-satiety"
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

          {/* 刪除確認 */}
          {confirmDel && (
            <div className="bg-danger/10 border border-danger/40 rounded-lg px-4 py-3 mb-4">
              <p className="text-[13px] text-text">
                確定刪除 <span className="text-danger">「{meal.dish_name ?? '未命名'}」</span>？
              </p>
              <p className="text-[11px] text-text-3 mt-1">此操作不可撤銷</p>
              <div className="flex gap-2 mt-3">
                <Button variant="secondary" size="sm" onClick={() => setConfirmDel(false)} disabled={busy != null} className="flex-1">
                  取消
                </Button>
                <Button variant="danger" size="sm" onClick={del} loading={busy === 'delete'} className="flex-1">
                  確認刪除
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* footer buttons */}
        {!confirmDel && (
          <div className="flex-shrink-0 flex gap-2 px-5 pt-3 border-t border-hairline">
            <Button
              variant="ghost"
              onClick={() => setConfirmDel(true)}
              disabled={busy != null}
              className="text-danger"
            >
              刪除
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={busy != null} className="flex-1">
              取消
            </Button>
            <Button onClick={save} loading={busy === 'save'} className="flex-1">
              儲存
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
