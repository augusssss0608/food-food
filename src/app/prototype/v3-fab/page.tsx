'use client';
import { useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, MockToast, useMockTodayLog, useMockPresets } from '../_lib/mock-home';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { MOCK_RECENT_PHOTO } from '../_lib/mock-presets';
import { useRef } from 'react';

type Mode = 'home' | 'open' | 'custom' | 'photo' | 'recent';

type FormState = 'closed' | 'add' | { kind: 'edit'; id: string };

export default function FabPage() {
  const { log, addEntry } = useMockTodayLog();
  const { presets, addPreset, updatePreset, deletePreset } = useMockPresets();
  const [mode, setMode] = useState<Mode>('home');
  const [toast, setToast] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formState, setFormState] = useState<FormState>('closed');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
    setMode('home');
  }

  function startLongPress() {
    if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setEditMode(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 450);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  const editingPreset = typeof formState === 'object' && formState.kind === 'edit'
    ? presets.find((p) => p.id === formState.id) : undefined;

  return (
    <PrototypeShell title="3. FAB Quick Actions">
      <div className="h-full relative overflow-hidden">
        <MockHome log={log} scrollPaddingBottom={120} />

        {/* 背景遮罩，open 時加深 */}
        <div
          className="absolute inset-0 bg-ink/55 backdrop-blur-sm transition-opacity z-10"
          style={{ opacity: mode === 'open' ? 1 : 0, pointerEvents: mode === 'open' ? 'auto' : 'none' }}
          onClick={() => setMode('home')}
        />

        {/* 3 個扇形子按鈕：往左上方扇出（不超出屏幕） */}
        <SubAction label="自定義" icon="⭐" open={mode === 'open'} delay={0.05} dx={-110} dy={-30} onClick={() => setMode('custom')} />
        <SubAction label="近期" icon="🕐" open={mode === 'open'} delay={0.10} dx={-95} dy={-95} onClick={() => setMode('recent')} />
        <SubAction label="拍照" icon="📷" open={mode === 'open'} delay={0.15} dx={-30} dy={-110} onClick={() => setMode('photo')} />

        {/* FAB 本身 */}
        <button
          type="button"
          onClick={() => setMode(mode === 'open' ? 'home' : mode === 'home' ? 'open' : 'home')}
          aria-label={mode === 'open' ? '收起' : '新增餐'}
          className="absolute right-6 w-14 h-14 rounded-full bg-accent text-accent-ink flex items-center justify-center shadow-2xl shadow-black/50 active:scale-90 z-20"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
            transform: mode === 'open' ? 'rotate(45deg)' : 'rotate(0)',
            transitionProperty: 'transform',
            transitionDuration: '0.2s',
            display: mode === 'home' || mode === 'open' ? 'flex' : 'none',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Sub pages — 模擬 push 一層，但用半屏 modal 從右滑入 */}
        {mode === 'custom' && (
          <SubPage title="自定義菜單" onBack={() => { setMode('home'); setEditMode(false); }}>
            {formState !== 'closed' ? (
              <div className="px-5 pt-4 pb-5">
                <h2 className="text-[16px] text-text font-medium mb-4">
                  {formState === 'add' ? '新增菜單' : '編輯菜單'}
                </h2>
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
            ) : (
              <>
                <div className="flex items-center justify-between px-5 pt-3 pb-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono">{presets.length} 個菜單</p>
                  {editMode ? (
                    <button onClick={() => setEditMode(false)} className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95">完成</button>
                  ) : (
                    <button
                      onClick={() => setFormState('add')}
                      aria-label="新增菜單"
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-hairline text-text-2 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  )}
                </div>
                {!editMode && presets.length > 0 && (
                  <p className="text-[10px] text-text-4 font-mono px-5 mb-2">長按任一菜單可進入編輯模式</p>
                )}
                <div className="grid grid-cols-2 gap-2.5 px-5 pb-5">
                  {presets.map((p, i) => {
                    const wiggle = editMode ? (i % 2 === 0 ? 'ff-wiggle-a 0.32s ease-in-out infinite' : 'ff-wiggle-b 0.32s ease-in-out infinite') : undefined;
                    return (
                      <div key={p.id} className="relative" style={{ animation: wiggle }}>
                        <button
                          onClick={() => editMode ? setFormState({ kind: 'edit', id: p.id }) : record(p.name, p.kcal)}
                          onPointerDown={() => !editMode && startLongPress()}
                          onPointerUp={cancelLongPress}
                          onPointerCancel={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onContextMenu={(e) => e.preventDefault()}
                          className="w-full bg-surface border border-hairline rounded-xl p-4 text-left hover:border-hairline-strong active:scale-[0.98] transition-all"
                        >
                          <p className="text-[14px] text-text font-medium truncate">{p.name}</p>
                          <p className="text-[18px] font-mono text-accent tabular mt-2">{Math.round(p.kcal)}<span className="text-[10px] text-text-3 ml-1">kcal</span></p>
                        </button>
                        {editMode && (
                          <button
                            onClick={() => setDeleteId(p.id)}
                            aria-label={`刪除 ${p.name}`}
                            className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-danger text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </SubPage>
        )}
        {mode === 'photo' && (
          <SubPage title="拍照識別" onBack={() => setMode('home')}>
            <div className="h-full flex items-center justify-center p-5">
              <button
                onClick={() => record('拍照識別餐', 420)}
                className="w-full max-w-xs aspect-square border-2 border-dashed border-hairline rounded-2xl flex flex-col items-center justify-center gap-3 text-text-3 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[14px] font-mono uppercase tracking-wider">點擊模擬識別</span>
              </button>
            </div>
          </SubPage>
        )}
        {mode === 'recent' && (
          <SubPage title="近期拍照" onBack={() => setMode('home')}>
            <ul className="p-5 space-y-1.5">
              {MOCK_RECENT_PHOTO.map((m) => (
                <li key={m.meal_id}>
                  <button
                    onClick={() => record(m.dish_name, m.kcal)}
                    className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-3 flex items-center justify-between hover:border-hairline-strong active:scale-[0.99] transition-all"
                  >
                    <span className="text-[14px] text-text font-medium">{m.dish_name}</span>
                    <span className="text-[12px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </SubPage>
        )}

        <MockToast text={toast} />

        <InlineConfirmDialog
          open={deleteId != null}
          title="刪除這個菜單？"
          body={
            deleteId ? (
              <span>將永久移除「<span className="text-text font-medium">{presets.find((p) => p.id === deleteId)?.name}</span>」。</span>
            ) : null
          }
          confirmText="刪除"
          variant="danger"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            if (deleteId) deletePreset(deleteId);
            setDeleteId(null);
          }}
        />
      </div>
    </PrototypeShell>
  );
}

function SubAction({
  label, icon, open, delay, dx, dy, onClick,
}: {
  label: string;
  icon: string;
  open: boolean;
  delay: number;
  dx: number;
  dy: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-6 w-14 h-14 rounded-full bg-surface-2 border border-hairline flex flex-col items-center justify-center gap-0.5 shadow-xl active:scale-90 z-20"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        transform: open ? `translate(${dx}px, ${dy}px) scale(1)` : 'translate(0, 0) scale(0)',
        opacity: open ? 1 : 0,
        transitionDelay: open ? `${delay}s` : '0s',
        transitionDuration: '0.28s',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionProperty: 'transform, opacity',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <span className="text-[18px] leading-none">{icon}</span>
      <span className="text-[9px] font-mono uppercase tracking-wider text-text-2">{label}</span>
    </button>
  );
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-ink z-[100] flex flex-col"
      style={{
        animation: 'ff-slide-right 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: '100dvh',
      }}
    >
      <header className="flex-shrink-0 px-4 h-12 flex items-center border-b border-hairline relative">
        <button onClick={onBack} className="flex items-center gap-1.5 text-accent hover:text-accent-press active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[12px] font-mono uppercase tracking-wider">返回主頁</span>
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium">{title}</p>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
