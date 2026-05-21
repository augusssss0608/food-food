'use client';
import { useEffect, useState, useRef } from 'react';
import { MockSheet } from './mock-home';
import type { UserMealPreset } from '@/lib/home-snapshot';

/**
 * 共用「管理菜單」面板：每個 variant 點「⚙ 管理」按鈕都打開這個。
 * 含 list（長按抖動 + 點叉叉刪 + 點 cell 編輯）+ 新增/編輯表單。
 */
export function PresetManagerSheet({
  open,
  onClose,
  presets,
  onAdd,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  presets: UserMealPreset[];
  onAdd: (name: string, kcal: number) => void;
  onUpdate: (id: string, name: string, kcal: number) => void;
  onDelete: (id: string) => void;
}) {
  type View = 'list' | { mode: 'add' } | { mode: 'edit'; id: string };
  const [view, setView] = useState<View>('list');
  const [editingMode, setEditingMode] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setView('list');
      setEditingMode(false);
      setConfirmDeleteId(null);
      if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
    }
  }, [open]);

  function startLongPress() {
    if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setEditingMode(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 450);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  const editingPreset = typeof view === 'object' && view.mode === 'edit' ? presets.find((p) => p.id === view.id) : undefined;
  const isAdd = typeof view === 'object' && view.mode === 'add';
  const isEdit = typeof view === 'object' && view.mode === 'edit';

  const title = view === 'list' ? '管理菜單' : isAdd ? '新菜單' : '編輯菜單';

  return (
    <>
      <MockSheet open={open} onClose={onClose} title={title} minHeight="70vh">
        {view === 'list' ? (
          <div className="px-4 py-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono">{presets.length} 個菜單</p>
              {editingMode ? (
                <button
                  onClick={() => setEditingMode(false)}
                  className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95"
                >
                  完成
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setView({ mode: 'add' })}
                  aria-label="新增菜單"
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-hairline text-text-2 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
            </div>

            {presets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <p className="text-[13px] text-text-3 mb-2">還沒有自定義菜單</p>
                <button
                  onClick={() => setView({ mode: 'add' })}
                  className="text-[12px] text-accent font-mono uppercase tracking-wider active:scale-95"
                >
                  + 建立第一個
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto -mx-1 px-1 pb-2">
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((p, i) => {
                    const wiggleAnim = editingMode
                      ? (i % 2 === 0 ? 'ff-wiggle-a 0.32s ease-in-out infinite' : 'ff-wiggle-b 0.32s ease-in-out infinite')
                      : undefined;
                    return (
                      <div key={p.id} className="relative" style={{ animation: wiggleAnim }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingMode) setView({ mode: 'edit', id: p.id });
                          }}
                          onPointerDown={() => !editingMode && startLongPress()}
                          onPointerUp={cancelLongPress}
                          onPointerCancel={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onContextMenu={(e) => e.preventDefault()}
                          className={[
                            'w-full bg-surface border border-hairline rounded-xl p-3.5 text-left transition-colors',
                            'hover:border-hairline-strong active:scale-[0.98]',
                            editingMode ? '' : 'cursor-default',
                          ].join(' ')}
                          style={{ touchAction: editingMode ? 'auto' : 'manipulation' }}
                        >
                          <p className="text-[13px] text-text font-medium leading-tight truncate">{p.name}</p>
                          <p className="text-[16px] font-mono text-accent tabular mt-1 leading-none">
                            {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-1">kcal</span>
                          </p>
                        </button>
                        {editingMode && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                            aria-label={`刪除 ${p.name}`}
                            className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-danger text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!editingMode && presets.length > 0 && (
              <p className="text-[10px] text-text-4 font-mono mt-2 text-center flex-shrink-0">
                長按任一菜單進入編輯模式
              </p>
            )}
          </div>
        ) : (
          <div className="px-4 py-3 h-full flex flex-col">
            <button
              onClick={() => setView('list')}
              className="text-[12px] text-accent font-mono uppercase tracking-wider active:scale-95 self-start mb-3 flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              返回列表
            </button>
            <MockPresetForm
              initial={editingPreset ? { name: editingPreset.name, kcal: editingPreset.kcal } : undefined}
              submitLabel={isEdit ? '保存' : '新增'}
              onSubmit={(name, kcal) => {
                if (isAdd) onAdd(name, kcal);
                else if (isEdit) onUpdate(view.id, name, kcal);
                setView('list');
              }}
              onCancel={() => setView('list')}
            />
          </div>
        )}
      </MockSheet>

      {/* 刪除確認 inline dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-5" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={() => setConfirmDeleteId(null)}
          />
          <div className="relative w-full max-w-sm bg-surface-2 border border-hairline rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <h3 className="display-roman text-[20px] leading-tight text-text">刪除這個菜單？</h3>
              <p className="mt-2 text-[13px] text-text-2 leading-relaxed">
                將永久移除「<span className="text-text font-medium">{presets.find((p) => p.id === confirmDeleteId)?.name}</span>」。
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 h-11 rounded-lg bg-surface border border-hairline text-text text-[14px] font-medium active:scale-[0.99] transition-transform"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (confirmDeleteId) onDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 h-11 rounded-lg bg-danger text-white text-[14px] font-medium active:scale-[0.99] transition-transform"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 簡化的菜名 + 熱量 表單，用於新增 / 編輯。 */
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
          onClick={onCancel}
          className="flex-1 h-11 rounded-lg bg-surface border border-hairline text-text text-[14px] font-medium active:scale-[0.99] transition-transform"
        >
          取消
        </button>
        <button
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
