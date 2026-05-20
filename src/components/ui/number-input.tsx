'use client';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Input } from './input';

/**
 * 包 `Input`，把 number input 的"删空 → state = ''"语义集中在一处。
 *
 * 业务侧 state 用 `number | ''`：
 *   - 用户编辑过程允许 ''（删空不强制变 0）
 *   - 提交 / 保存时业务侧判 `=== ''` 视为未填，要求非空再 send 出去
 *
 * 想用普通 number 输入框的所有页面都走这个组件，改 onChange 行为只改这里一处。
 */
export function NumberInput({
  value,
  onValueChange,
  ...rest
}: {
  value: number | '';
  onValueChange: (v: number | '') => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  label?: string;
  hint?: string;
  suffix?: ReactNode;
  invalid?: boolean;
}) {
  return (
    <Input
      {...rest}
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        onValueChange(raw === '' ? '' : Number(raw));
      }}
    />
  );
}

export const isEmptyNum = (v: number | '' | null | undefined): v is '' | null | undefined =>
  v === '' || v === null || v === undefined;
