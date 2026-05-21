'use client';
import { useState } from 'react';

/** 共用的菜名 + 熱量 表單（新增 / 編輯都用這個），由 variant 自己決定怎麼 mount。 */
export function MockPresetForm({
  initial,
  submitLabel = '保存',
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; kcal: number };
  submitLabel?: string;
  onSubmit: (name: string, kcal: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState<string>(initial?.kcal != null ? String(initial.kcal) : '');

  const canSubmit = name.trim().length > 0 && kcal.length > 0 && Number.isFinite(Number(kcal)) && Number(kcal) >= 0 && Number(kcal) <= 5000;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(name.trim(), Number(kcal));
  }

  return (
    <div className="space-y-2">
      <input
        aria-label="菜名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="菜名（必填）"
        maxLength={50}
        className="w-full h-11 px-3 rounded-lg bg-surface border border-hairline text-[14px] text-text outline-none focus:border-accent/60 transition-colors"
      />
      <input
        aria-label="熱量"
        type="number"
        inputMode="numeric"
        value={kcal}
        onChange={(e) => setKcal(e.target.value)}
        placeholder="熱量 kcal（必填）"
        min={0}
        max={5000}
        className="w-full h-11 px-3 rounded-lg bg-surface border border-hairline text-[14px] text-text outline-none focus:border-accent/60 transition-colors"
      />
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-lg bg-surface border border-hairline text-text text-[14px] font-medium active:scale-[0.99] transition-transform"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 h-11 rounded-lg bg-accent text-accent-ink text-[14px] font-medium disabled:bg-surface-3 disabled:text-text-3 active:scale-[0.99] transition-transform"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/** 內聯刪除確認對話框，固定屏幕中央 z-50。 */
export function InlineConfirmDialog({
  open,
  title,
  body,
  confirmText = '確認',
  variant = 'default',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmText?: string;
  variant?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-5" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-surface-2 border border-hairline rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <h3 className="display-roman text-[20px] leading-tight text-text">{title}</h3>
          {body && <div className="mt-2 text-[13px] text-text-2 leading-relaxed">{body}</div>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-lg bg-surface border border-hairline text-text text-[14px] font-medium active:scale-[0.99] transition-transform"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={[
              'flex-1 h-11 rounded-lg text-[14px] font-medium active:scale-[0.99] transition-transform',
              variant === 'danger' ? 'bg-danger text-white' : 'bg-accent text-accent-ink',
            ].join(' ')}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
