'use client';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { NumberInput, isEmptyNum } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export type MealPresetFormInput = {
  name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  source_meal_id?: string;
};

export type MealPresetFormPrefill = Partial<MealPresetFormInput> & { source_meal_id?: string };

/**
 * 单屏滚动表单：6 个字段 + 取消/保存。
 * 复用场景：
 * 1. AddMealSheet 「+」新增自定义菜单（空初始值）
 * 2. 「近期新增」点击拍照餐 → 转 preset（prefill 拍照 macros，允许编辑）
 *
 * - 菜名 / 热量必填；其他默认 0；
 * - 数字输入允许临时为空（NumberInput 的 ''），保存时按 0 处理。
 * - duplicateError 由父层在 409 时设置，UI 上给行内提示。
 */
export function MealPresetForm({
  prefill,
  onCancel,
  onSubmit,
  busy,
  duplicateError,
  onClearDuplicate,
}: {
  prefill?: MealPresetFormPrefill;
  onCancel: () => void;
  onSubmit: (input: MealPresetFormInput) => Promise<void> | void;
  busy: boolean;
  duplicateError: boolean;
  onClearDuplicate?: () => void;
}) {
  const [name, setName] = useState<string>(prefill?.name ?? '');
  const [kcal, setKcal] = useState<number | ''>(prefill?.kcal ?? '');
  const [protein, setProtein] = useState<number | ''>(prefill?.protein_g ?? '');
  const [carb, setCarb] = useState<number | ''>(prefill?.carb_g ?? '');
  const [fat, setFat] = useState<number | ''>(prefill?.fat_g ?? '');
  const [fiber, setFiber] = useState<number | ''>(prefill?.fiber_g ?? '');

  // prefill 在 mount 后变化（不同 recent meal 点击）重置表单
  useEffect(() => {
    setName(prefill?.name ?? '');
    setKcal(prefill?.kcal ?? '');
    setProtein(prefill?.protein_g ?? '');
    setCarb(prefill?.carb_g ?? '');
    setFat(prefill?.fat_g ?? '');
    setFiber(prefill?.fiber_g ?? '');
  }, [prefill]);

  function onNameChange(v: string) {
    setName(v);
    if (duplicateError) onClearDuplicate?.();
  }

  const trimmedName = name.trim();
  const nameInvalid = trimmedName.length === 0 || trimmedName.length > 50;
  const kcalInvalid = isEmptyNum(kcal) || (typeof kcal === 'number' && (kcal < 0 || kcal > 5000));
  const proteinInvalid = typeof protein === 'number' && (protein < 0 || protein > 500);
  const carbInvalid = typeof carb === 'number' && (carb < 0 || carb > 1000);
  const fatInvalid = typeof fat === 'number' && (fat < 0 || fat > 500);
  const fiberInvalid = typeof fiber === 'number' && (fiber < 0 || fiber > 200);
  const canSubmit =
    !nameInvalid && !kcalInvalid &&
    !proteinInvalid && !carbInvalid && !fatInvalid && !fiberInvalid &&
    !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    await onSubmit({
      name: trimmedName,
      kcal: typeof kcal === 'number' ? kcal : 0,
      protein_g: typeof protein === 'number' ? protein : 0,
      carb_g: typeof carb === 'number' ? carb : 0,
      fat_g: typeof fat === 'number' ? fat : 0,
      fiber_g: typeof fiber === 'number' ? fiber : 0,
      source_meal_id: prefill?.source_meal_id,
    });
  }

  return (
    <div className="space-y-3">
      <Input
        label="菜名 *"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="如：雞胸糙米飯"
        maxLength={50}
        invalid={duplicateError || (name.length > 0 && nameInvalid)}
        hint={duplicateError ? '已存在同名菜單，請改名' : trimmedName.length > 0 ? `${trimmedName.length}/50` : undefined}
      />
      <NumberInput
        label="熱量 *"
        value={kcal}
        onValueChange={setKcal}
        suffix="kcal"
        min={0}
        max={5000}
        invalid={kcal !== '' && kcalInvalid}
      />
      <div className="grid grid-cols-3 gap-2">
        <NumberInput label="蛋白質" value={protein} onValueChange={setProtein} suffix="g" min={0} max={500} invalid={proteinInvalid} />
        <NumberInput label="碳水" value={carb} onValueChange={setCarb} suffix="g" min={0} max={1000} invalid={carbInvalid} />
        <NumberInput label="脂肪" value={fat} onValueChange={setFat} suffix="g" min={0} max={500} invalid={fatInvalid} />
      </div>
      <NumberInput label="纖維（可選）" value={fiber} onValueChange={setFiber} suffix="g" min={0} max={200} invalid={fiberInvalid} />
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">
          取消
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
          {busy ? <Spinner size={16} /> : '保存'}
        </Button>
      </div>
    </div>
  );
}
