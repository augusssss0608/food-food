'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, MockSheet, PlusButton, MockToast, useMockTodayLog, useMockPresets } from '../_lib/mock-home';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { MOCK_RECENT_PHOTO } from '../_lib/mock-presets';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

type FormState = 'closed' | 'add' | { kind: 'edit'; id: string };

export default function SpotlightPage() {
  const { log, addEntry } = useMockTodayLog();
  const { presets, addPreset, updatePreset, deletePreset } = useMockPresets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [section, setSection] = useState<'main' | 'photo' | 'recent'>('main');
  const [editMode, setEditMode] = useState(false);
  const [formState, setFormState] = useState<FormState>('closed');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  function startLongPress() {
    if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setEditMode(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 450);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }
  const editingPreset = typeof formState === 'object' && formState.kind === 'edit'
    ? presets.find((p) => p.id === formState.id) : undefined;

  useEffect(() => {
    if (!open) { setQ(''); setSection('main'); setEditMode(false); setFormState('closed'); }
  }, [open]);

  const trimmed = q.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return presets;
    const nq = norm(trimmed);
    return presets.filter((p) => norm(p.name).includes(nq));
  }, [trimmed, presets]);

  const noMatch = trimmed.length > 0 && filtered.length === 0;

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
    setOpen(false);
  }

  function recordAndCreate(name: string, kcal: number) {
    addPreset(name, kcal);
    record(name, kcal);
  }

  return (
    <PrototypeShell title="1. Spotlight 搜索">
      <MockHome log={log} rightAction={<PlusButton onClick={() => setOpen(true)} />} />

      <MockSheet open={open} onClose={() => setOpen(false)} title="新增餐" minHeight="80vh">
        {formState !== 'closed' ? (
          <div className="px-4 pt-4 pb-5">
            <h2 className="text-[16px] text-text font-medium mb-4">{formState === 'add' ? '新增菜單' : '編輯菜單'}</h2>
            <MockPresetForm
              initial={editingPreset ? { name: editingPreset.name, kcal: editingPreset.kcal } : undefined}
              submitLabel={formState === 'add' ? '新增' : '保存'}
              onSubmit={(name, kcal) => {
                if (formState === 'add') addPreset(name, kcal);
                else if (typeof formState === 'object') updatePreset(formState.id, name, kcal);
                setFormState('closed');
              }}
              onCancel={() => setFormState('closed')}
            />
          </div>
        ) : section === 'photo' ? (
          <PhotoSection onBack={() => setSection('main')} onPicked={record} />
        ) : section === 'recent' ? (
          <RecentSection onBack={() => setSection('main')} onPicked={record} />
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-4 pt-3 pb-3 flex-shrink-0">
              <label className="relative block">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜尋菜單或新建..."
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-surface border border-hairline text-[15px] text-text placeholder:text-text-4 outline-none focus:border-accent/60 transition-colors"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-2">
              {noMatch ? (
                <button
                  type="button"
                  onClick={() => recordAndCreate(trimmed, 0)}
                  className="w-full bg-accent/10 border border-accent/30 rounded-xl p-4 text-left hover:bg-accent/15 active:scale-[0.99] transition-all"
                >
                  <p className="text-[11px] uppercase tracking-wider text-accent font-mono mb-1">找不到？</p>
                  <p className="text-[14px] text-text font-medium">
                    ↵ 新建「<span className="text-accent">{trimmed}</span>」並加入今日
                  </p>
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono">
                      {trimmed ? `匹配 ${filtered.length} 個` : `建議 · 全部 ${presets.length} 個`}
                    </p>
                    {editMode ? (
                      <button onClick={() => setEditMode(false)} className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95">完成</button>
                    ) : (
                      <button
                        onClick={() => setFormState('add')}
                        aria-label="新增菜單"
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-surface border border-hairline text-text-2 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      </button>
                    )}
                  </div>
                  {!editMode && !trimmed && presets.length > 0 && (
                    <p className="text-[9px] text-text-4 font-mono mb-2">長按列表項進入編輯模式</p>
                  )}
                  <ul className="space-y-1.5">
                    {filtered.map((p, i) => {
                      const wiggle = editMode ? (i % 2 === 0 ? 'ff-wiggle-a 0.32s ease-in-out infinite' : 'ff-wiggle-b 0.32s ease-in-out infinite') : undefined;
                      return (
                        <li key={p.id} className="relative" style={{ animation: wiggle }}>
                          <button
                            type="button"
                            onClick={() => editMode ? setFormState({ kind: 'edit', id: p.id }) : record(p.name, p.kcal)}
                            onPointerDown={() => !editMode && startLongPress()}
                            onPointerUp={cancelLongPress}
                            onPointerCancel={cancelLongPress}
                            onPointerLeave={cancelLongPress}
                            onContextMenu={(e) => e.preventDefault()}
                            className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3 hover:border-hairline-strong active:scale-[0.99] transition-all"
                          >
                            <span className="text-[13px] text-text font-medium truncate">
                              {trimmed ? highlight(p.name, trimmed) : p.name}
                            </span>
                            <span className="text-[12px] font-mono text-accent tabular flex-shrink-0">
                              {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
                            </span>
                          </button>
                          {editMode && (
                            <button
                              onClick={() => setDeleteId(p.id)}
                              aria-label={`刪除 ${p.name}`}
                              className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            <div className="flex-shrink-0 px-4 pt-2 pb-3 border-t border-hairline flex gap-2">
              <button
                onClick={() => setSection('photo')}
                className="flex-1 bg-surface border border-hairline rounded-lg px-3 py-2.5 text-[12px] text-text-2 hover:border-hairline-strong active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>📷</span>
                <span>拍餐</span>
              </button>
              <button
                onClick={() => setSection('recent')}
                className="flex-1 bg-surface border border-hairline rounded-lg px-3 py-2.5 text-[12px] text-text-2 hover:border-hairline-strong active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>🕐</span>
                <span>近期 ({MOCK_RECENT_PHOTO.length})</span>
              </button>
            </div>
          </div>
        )}
      </MockSheet>

      <InlineConfirmDialog
        open={deleteId != null}
        title="刪除這個菜單？"
        body={deleteId ? <span>將永久移除「<span className="text-text font-medium">{presets.find((p) => p.id === deleteId)?.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deletePreset(deleteId); setDeleteId(null); }}
      />

      <MockToast text={toast} />
    </PrototypeShell>
  );
}

function PhotoSection({ onBack, onPicked }: { onBack: () => void; onPicked: (n: string, k: number) => void }) {
  return (
    <div className="p-5 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-text-3 hover:text-text active:scale-95 text-[12px] font-mono uppercase tracking-wider">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        返回
      </button>
      <div className="w-full aspect-square border-2 border-dashed border-hairline rounded-2xl flex flex-col items-center justify-center gap-3 text-text-3 hover:border-accent/60 hover:text-accent active:scale-[0.99] transition-all cursor-pointer"
        onClick={() => onPicked('拍照識別餐', 420)}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span className="text-[13px] font-mono uppercase tracking-wider">點擊模擬拍照識別</span>
      </div>
    </div>
  );
}

function RecentSection({ onBack, onPicked }: { onBack: () => void; onPicked: (n: string, k: number) => void }) {
  return (
    <div className="p-4 space-y-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-text-3 hover:text-text active:scale-95 text-[12px] font-mono uppercase tracking-wider">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        返回
      </button>
      <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono">近 30 天拍照</p>
      <ul className="space-y-1.5">
        {MOCK_RECENT_PHOTO.map((m) => (
          <li key={m.meal_id}>
            <button
              onClick={() => onPicked(m.dish_name, m.kcal)}
              className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between hover:border-hairline-strong active:scale-[0.99] transition-all"
            >
              <span className="text-[13px] text-text font-medium truncate">{m.dish_name}</span>
              <span className="text-[12px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function highlight(text: string, q: string) {
  const i = norm(text).indexOf(norm(q));
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}
