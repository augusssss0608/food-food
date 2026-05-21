'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, MockSheet, PlusButton, MockToast, useMockTodayLog, useMockPresets } from '../_lib/mock-home';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import { MOCK_RECENT_PHOTO } from '../_lib/mock-presets';

type Tab = 'custom' | 'recent' | 'photo';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'custom', label: '自定義', icon: '⭐' },
  { key: 'recent', label: '近期', icon: '🕐' },
  { key: 'photo', label: '拍照', icon: '📷' },
];

type FormState = 'closed' | 'add' | { kind: 'edit'; id: string };

export default function TabsPage() {
  const { log, addEntry } = useMockTodayLog();
  const { presets, addPreset, updatePreset, deletePreset } = useMockPresets();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('custom');
  const [toast, setToast] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formState, setFormState] = useState<FormState>('closed');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const startX = useRef<number | null>(null);
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

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
    setOpen(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0]!.clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current == null) return;
    const dx = e.changedTouches[0]!.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = TABS.findIndex((t) => t.key === tab);
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1]!.key);
    if (dx > 0 && idx > 0) setTab(TABS[idx - 1]!.key);
  }

  return (
    <PrototypeShell title="2. 底部 Tab 切換">
      <MockHome log={log} rightAction={<PlusButton onClick={() => setOpen(true)} />} />

      <MockSheet open={open} onClose={() => setOpen(false)} title="新增餐" minHeight="75vh">
        <div className="h-full flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            {/* 用絕對定位避免 transform 影響 flex 高度計算 */}
            <div
              className="absolute inset-0 flex transition-transform duration-300 ease-out"
              style={{
                width: `${TABS.length * 100}%`,
                transform: `translateX(-${TABS.findIndex((t) => t.key === tab) * (100 / TABS.length)}%)`,
              }}
            >
              {TABS.map((t) => (
                <div key={t.key} className="overflow-y-auto" style={{ width: `${100 / TABS.length}%` }}>
                  <div className="px-4 py-4">
                    {t.key === 'custom' && (
                      formState !== 'closed' ? (
                        <div>
                          <h3 className="text-[14px] text-text font-medium mb-3">{formState === 'add' ? '新增菜單' : '編輯菜單'}</h3>
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
                          <div className="flex items-center justify-between mb-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono">{presets.length} 個菜單</p>
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
                          <div className="grid grid-cols-2 gap-2">
                            {presets.map((p, i) => {
                              const wiggle = editMode ? (i % 2 === 0 ? 'ff-wiggle-a 0.32s ease-in-out infinite' : 'ff-wiggle-b 0.32s ease-in-out infinite') : undefined;
                              return (
                                <div key={p.id} className="relative" style={{ animation: wiggle }}>
                                  <button
                                    type="button"
                                    onClick={() => editMode ? setFormState({ kind: 'edit', id: p.id }) : record(p.name, p.kcal)}
                                    onPointerDown={() => !editMode && startLongPress()}
                                    onPointerUp={cancelLongPress}
                                    onPointerCancel={cancelLongPress}
                                    onPointerLeave={cancelLongPress}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="w-full bg-surface border border-hairline rounded-xl p-3.5 text-left hover:border-hairline-strong active:scale-[0.98] transition-all"
                                  >
                                    <p className="text-[13px] text-text font-medium leading-tight truncate">{p.name}</p>
                                    <p className="text-[17px] font-mono text-accent tabular mt-1.5 leading-none">
                                      {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-1">kcal</span>
                                    </p>
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
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )
                    )}

                    {t.key === 'recent' && (
                      <>
                        <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-2.5">近 30 天拍照</p>
                        <ul className="space-y-1.5">
                          {MOCK_RECENT_PHOTO.map((m) => (
                            <li key={m.meal_id}>
                              <button
                                onClick={() => record(m.dish_name, m.kcal)}
                                className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between hover:border-hairline-strong active:scale-[0.99] transition-all"
                              >
                                <span className="text-[13px] text-text font-medium truncate">{m.dish_name}</span>
                                <span className="text-[12px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {t.key === 'photo' && (
                      <div className="flex items-center justify-center pt-4">
                        <button
                          onClick={() => record('拍照識別餐', 420)}
                          className="w-full aspect-square max-w-[260px] border-2 border-dashed border-hairline rounded-2xl flex flex-col items-center justify-center gap-3 text-text-3 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                        >
                          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                          <span className="text-[13px] font-mono uppercase tracking-wider">點擊模擬識別</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <nav
            className="flex-shrink-0 grid grid-cols-3 border-t border-hairline bg-surface-2/95 backdrop-blur"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={[
                    'py-2.5 flex flex-col items-center justify-center gap-0.5 transition-colors',
                    active ? 'text-accent' : 'text-text-3 hover:text-text-2',
                  ].join(' ')}
                >
                  <span className="text-[17px] leading-none">{t.icon}</span>
                  <span className="text-[9px] font-mono uppercase tracking-wider">{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
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
