'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot } from '@/lib/home-snapshot';

const PEEK_H = 92;
const HALF_H = 320;
const FULL_RATIO = 0.85;

type State = 'peek' | 'half' | 'full';
type FormState = 'closed' | 'add' | { kind: 'edit'; id: string };

export function ShelfContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [state, setState] = useState<State>('peek');
  const [editMode, setEditMode] = useState(false);
  const [formState, setFormState] = useState<FormState>('closed');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [winH, setWinH] = useState(800);
  const startRef = useRef<{ y: number; baseH: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setWinH(window.innerHeight);
    const onResize = () => setWinH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    ? api.presets.find((p) => p.id === formState.id) : undefined;

  const baseH = state === 'peek' ? PEEK_H : state === 'half' ? HALF_H : winH * FULL_RATIO;
  const currentH = Math.max(PEEK_H, Math.min(winH * FULL_RATIO, baseH + dragOffset));

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    startRef.current = { y: e.touches[0]!.clientY, baseH };
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!startRef.current) return;
    const dy = startRef.current.y - e.touches[0]!.clientY;
    setDragOffset(dy);
  }
  function onTouchEnd() {
    if (!startRef.current) return;
    const finalH = startRef.current.baseH + dragOffset;
    startRef.current = null;
    setDragging(false);
    setDragOffset(0);
    const distances = [
      { state: 'peek' as State, d: Math.abs(finalH - PEEK_H) },
      { state: 'half' as State, d: Math.abs(finalH - HALF_H) },
      { state: 'full' as State, d: Math.abs(finalH - winH * FULL_RATIO) },
    ];
    distances.sort((a, b) => a.d - b.d);
    setState(distances[0]!.state);
  }

  async function pickPreset(presetId: string) {
    const preset = api.presets.find((p) => p.id === presetId);
    if (!preset) return;
    const ok = await api.recordCustomPreset(preset);
    if (ok) setState('peek');
  }

  return (
    <PrototypeShell title="2. 餐盤架 Shelf">
      <div className="h-full relative overflow-hidden">
        <RealHomeShell meals={api.meals} timezone={api.timezone} scrollPaddingBottom={currentH + 24} />

        <aside
          className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-hairline rounded-t-3xl shadow-2xl shadow-black/60 flex flex-col z-10"
          style={{
            height: `${currentH}px`,
            transition: dragging ? 'none' : 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div
            className="flex-shrink-0 select-none cursor-grab active:cursor-grabbing pt-2.5 pb-1"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            onClick={() => state === 'peek' && setState('half')}
            style={{ touchAction: 'none' }}
          >
            <div className="w-10 h-1 bg-text-3/40 rounded-full mx-auto" />
            <p className="text-[9px] text-text-4 font-mono uppercase tracking-wider text-center mt-1.5">
              {state === 'peek' ? '上拉展開' : state === 'half' ? '上拉看全部 / 下拉收起' : '下拉收起'}
            </p>
          </div>
          <div className="flex-shrink-0 px-4 pb-3">
            {state === 'peek' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                  {api.presets.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPreset(p.id)}
                      disabled={api.recordingId === p.id}
                      className="bg-surface border border-hairline rounded-full pl-3 pr-2.5 py-1.5 flex items-center gap-2 hover:border-accent/60 active:scale-95 transition-all flex-shrink-0 disabled:opacity-50"
                    >
                      <span className="text-[12px] text-text font-medium truncate max-w-[90px]">{p.name}</span>
                      <span className="text-[10px] font-mono text-accent tabular">{Math.round(p.kcal)}</span>
                    </button>
                  ))}
                  {api.presets.length === 0 && (
                    <p className="text-[11px] text-text-3 px-2 self-center">沒有菜單 · 上拉展開後新增</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono">
                  {state === 'full' ? `全部 ${api.presets.length} 個菜單` : '常用菜單'}
                </p>
                <div className="flex gap-3 items-center">
                  {editMode ? (
                    <button onClick={() => setEditMode(false)} className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95">完成</button>
                  ) : (
                    <button
                      onClick={() => { api.clearDuplicate(); setFormState('add'); }}
                      aria-label="新增菜單"
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-surface border border-hairline text-text-2 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  )}
                  <button onClick={() => setState('peek')} className="text-[11px] text-text-3 font-mono uppercase tracking-wider hover:text-text active:scale-95">收起</button>
                  {state === 'half' && (
                    <button onClick={() => setState('full')} className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95">展開全部 ↑</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {state !== 'peek' && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 border-t border-hairline">
              {formState !== 'closed' ? (
                <div className="pt-3 max-w-md mx-auto">
                  <h3 className="text-[14px] text-text font-medium mb-3">{formState === 'add' ? '新增菜單' : '編輯菜單'}</h3>
                  <MockPresetForm
                    initial={editingPreset ? { name: editingPreset.name, kcal: editingPreset.kcal } : undefined}
                    submitLabel={formState === 'add' ? '新增' : '保存'}
                    onSubmit={async (name, kcal) => {
                      const ok = formState === 'add'
                        ? await api.addPreset(name, kcal)
                        : (typeof formState === 'object' ? await api.updatePreset(formState.id, name, kcal) : false);
                      if (ok) setFormState('closed');
                    }}
                    onCancel={() => setFormState('closed')}
                  />
                  {api.duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名菜單，請改名</p>}
                </div>
              ) : (
                <>
                  {api.presets.length === 0 ? (
                    <div className="pt-6 text-center">
                      <p className="text-[13px] text-text-3 mb-2">還沒有自定義菜單</p>
                      <button
                        onClick={() => { api.clearDuplicate(); setFormState('add'); }}
                        className="text-[12px] text-accent font-mono uppercase tracking-wider active:scale-95"
                      >
                        + 建立第一個
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-3">
                      {(state === 'full' ? api.presets : api.presets.slice(0, 6)).map((p, i) => {
                        const wiggle = editMode ? (i % 2 === 0 ? 'ff-wiggle-a 0.32s ease-in-out infinite' : 'ff-wiggle-b 0.32s ease-in-out infinite') : undefined;
                        return (
                          <div key={p.id} className="relative" style={{ animation: wiggle }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (editMode) { api.clearDuplicate(); setFormState({ kind: 'edit', id: p.id }); }
                                else pickPreset(p.id);
                              }}
                              onPointerDown={() => !editMode && startLongPress()}
                              onPointerUp={cancelLongPress}
                              onPointerCancel={cancelLongPress}
                              onPointerLeave={cancelLongPress}
                              onContextMenu={(e) => e.preventDefault()}
                              disabled={api.recordingId === p.id}
                              className="w-full bg-surface border border-hairline rounded-xl p-3.5 text-left hover:border-hairline-strong active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              <p className="text-[13px] text-text font-medium truncate">{p.name}</p>
                              <p className="text-[16px] font-mono text-accent tabular mt-1">{Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
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
                  )}
                </>
              )}
            </div>
          )}
        </aside>

        <InlineConfirmDialog
          open={deleteId != null}
          title="刪除這個菜單？"
          body={deleteId ? <span>將永久移除「<span className="text-text font-medium">{api.presets.find((p) => p.id === deleteId)?.name}</span>」。</span> : null}
          confirmText="刪除"
          variant="danger"
          onCancel={() => setDeleteId(null)}
          onConfirm={async () => { if (deleteId) await api.deletePreset(deleteId); setDeleteId(null); }}
        />
      </div>
    </PrototypeShell>
  );
}
