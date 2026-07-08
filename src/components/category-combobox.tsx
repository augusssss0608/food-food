'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * 類別 combobox：
 * - 純文本輸入（可手填新類別，长度上限 30 char、trim 后视为空 = null）
 * - 聚焦時下拉显示已有類別（按当前 value 模糊过滤）
 * - 点击下拉项 = 把該值帶回 input；input 仍可繼續編輯
 * - 空白 = 無類別（null）
 *
 * 不依赖任何外部 UI 库；和 record-meal-sheet 的 dark/lime 風格一致。
 */
export function CategoryCombobox({
  value,
  onChange,
  options,
  disabled,
  label = '類別（可選）',
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  // 失焦延迟关闭，避免点击下拉项时 blur 先触发关闭导致 click 落空
  const closeTimerRef = useRef<number | null>(null);
  function scheduleClose() {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  }
  function cancelClose() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }
  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [value, options]);

  return (
    <label className="block relative">
      <span className="block text-[11px] uppercase tracking-[0.14em] text-text-3 mb-1.5 font-medium">
        {label}
      </span>
      <div
        className={[
          'flex items-center gap-2 h-12 px-3.5 rounded-lg bg-surface border transition-colors',
          'border-hairline focus-within:border-accent/60',
        ].join(' ')}
      >
        <input
          type="text"
          value={value}
          disabled={disabled}
          maxLength={30}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            cancelClose();
            setOpen(true);
          }}
          onBlur={scheduleClose}
          placeholder="例：健身餐 / 早餐"
          className="flex-1 bg-transparent outline-none text-[15px] text-text placeholder:text-text-4 tabular"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange('')}
            onMouseDown={(e) => e.preventDefault()}
            className="text-text-4 hover:text-text-2 text-[14px] leading-none px-1 py-0.5"
            aria-label="清空類別"
            tabIndex={-1}
          >
            ×
          </button>
        )}
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          className="text-text-3 pointer-events-none"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {open && filtered.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-hairline-strong bg-surface shadow-lg overflow-hidden max-h-44 overflow-y-auto"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => {
                // 阻止 input blur 先于 click 触发
                e.preventDefault();
              }}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={[
                'w-full text-left px-3.5 h-10 flex items-center text-[14px] text-text',
                'border-b border-hairline last:border-b-0 hover:bg-surface-2 active:bg-surface-2',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
