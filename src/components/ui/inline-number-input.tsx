'use client';
import type { ReactNode } from 'react';

/**
 * preview card 专用的横排数字输入：左 label / 中 input / 右 suffix。
 * 和 NumberInput 一样允许 state 为 ''（删空），业务侧自己判空。
 *
 * meal-preview-card / body-preview-card 都用这个，行为统一。
 */
export function InlineNumberInput({
  id,
  label,
  value,
  onValueChange,
  suffix,
  big = false,
  labelWidth = 'w-20',
  step,
}: {
  id: string;
  label: string;
  value: number | '';
  onValueChange: (v: number | '') => void;
  suffix?: ReactNode;
  big?: boolean;
  labelWidth?: 'w-20' | 'w-24';
  step?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor={id}
        className={`text-[12px] uppercase tracking-[0.14em] text-text-3 font-mono ${labelWidth} flex-shrink-0`}
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          onValueChange(raw === '' ? '' : Number(raw));
        }}
        className={[
          'flex-1 bg-surface-2 border border-hairline rounded-md px-3 outline-none',
          'focus:border-accent/60 transition-colors text-text tabular',
          big ? 'h-12 text-[20px] font-mono' : 'h-10 text-[14px]',
        ].join(' ')}
      />
      {suffix !== undefined && (
        <span className="text-[12px] text-text-3 font-mono w-5">{suffix}</span>
      )}
    </div>
  );
}
