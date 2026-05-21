'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockToast, useMockTodayLog, useMockPresets } from '../_lib/mock-home';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Meal Stamp：印章盤 + drop zone。
 *
 * 關鍵設計：長按 250ms 才進入「拖曳模式」，這之前 touchAction 保持預設讓
 * 印章盤正常垂直滾動。長按後 navigator.vibrate 短震提示「進入拖曳」，
 * 再開始跟手 + 鎖滾。釋放或超範圍取消。
 */
type DragState = {
  presetId: string;
  x: number;
  y: number;
};

const LONG_PRESS_MS = 350;
const MOVE_CANCEL_PX = 10;

type FormState = 'closed' | 'add' | { kind: 'edit'; id: string };

export default function StampPage() {
  const { log, addEntry } = useMockTodayLog();
  const { presets, addPreset, updatePreset, deletePreset } = useMockPresets();
  const [editMode, setEditMode] = useState(false);
  const [formState, setFormState] = useState<FormState>('closed');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [armingId, setArmingId] = useState<string | null>(null);
  const [hoverDrop, setHoverDrop] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const editingPreset = typeof formState === 'object' && formState.kind === 'edit'
    ? presets.find((p) => p.id === formState.id) : undefined;

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([15, 30, 15]);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  useEffect(() => () => clearLongPressTimer(), []);

  function onPointerDown(e: React.PointerEvent, presetId: string) {
    startRef.current = { x: e.clientX, y: e.clientY };
    setArmingId(presetId);
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      // 進入 drag 模式：震動提示 + 開始跟手
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
      const last = startRef.current;
      if (last) {
        setDrag({ presetId, x: last.x, y: last.y });
      }
      setArmingId(null);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    // 還在 arming 階段：移動超過閾值取消長按，讓瀏覽器接管滾動
    if (armingId && startRef.current) {
      const moved = Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y);
      if (moved > MOVE_CANCEL_PX) {
        clearLongPressTimer();
        setArmingId(null);
        startRef.current = null;
        return;
      }
    }
    // 已進入 drag：跟手 + hit test drop zone
    if (drag) {
      e.preventDefault();
      setDrag({ ...drag, x: e.clientX, y: e.clientY });
      const el = dropRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        setHoverDrop(inside);
      }
    }
  }

  function onPointerUp() {
    clearLongPressTimer();
    if (drag) {
      const preset = presets.find((p) => p.id === drag.presetId);
      if (preset && hoverDrop) record(preset.name, preset.kcal);
    }
    setDrag(null);
    setArmingId(null);
    setHoverDrop(false);
    startRef.current = null;
  }

  const draggingPreset = drag ? presets.find((p) => p.id === drag.presetId) : null;

  return (
    <PrototypeShell title="7. Meal Stamp">
      <div className="h-full flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex-shrink-0 px-5 pt-2 pb-3 max-w-md mx-auto w-full">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3">今日 · {log.length} 筆</p>
          <ul className="space-y-1.5 mb-3 max-h-32 overflow-y-auto">
            {log.map((m) => (
              <li key={m.id} className="bg-surface border border-hairline rounded-lg px-3.5 py-2 flex items-center justify-between text-[12px]">
                <span className="text-text-3 font-mono">{fmtTime(m.ate_at)}</span>
                <span className="text-text font-medium flex-1 mx-3 truncate">{m.dish_name}</span>
                <span className="text-accent font-mono tabular">{m.kcal}</span>
              </li>
            ))}
          </ul>
          <div
            ref={dropRef}
            className={[
              'border-2 border-dashed rounded-xl px-4 py-5 text-center transition-all',
              hoverDrop ? 'border-accent bg-accent/20 scale-[1.02]' : 'border-hairline bg-surface/40',
            ].join(' ')}
          >
            <p className={`text-[12px] font-mono uppercase tracking-wider transition-colors ${hoverDrop ? 'text-accent' : 'text-text-3'}`}>
              {hoverDrop && draggingPreset ? `放開蓋章「${draggingPreset.name}」` : '把印章拖到這裡'}
            </p>
            {hoverDrop && draggingPreset && (
              <p className="text-[18px] font-mono text-accent tabular mt-1">{draggingPreset.kcal} kcal</p>
            )}
          </div>
        </div>

        {/* 印章盤：允許瀏覽器垂直 pan，只長按進 drag */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4 border-t border-hairline">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-2 mt-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">
                印章盤 · {presets.length} 個
              </p>
              <div className="flex gap-2 items-center">
                {editMode ? (
                  <button onClick={() => setEditMode(false)} className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95">完成</button>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="text-[11px] text-text-2 font-mono uppercase tracking-wider hover:text-accent active:scale-95"
                    >
                      ✏️ 編輯
                    </button>
                    <button
                      onClick={() => setFormState('add')}
                      aria-label="新增印章"
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-hairline text-text-2 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-[10px] text-text-4 font-mono mb-3">
              {editMode ? '✏️ 編輯模式：點印章編輯、點紅叉刪除' : 'ⓘ 長按印章 0.35 秒進入拖曳模式'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {presets.map((p, i) => {
                const wiggle = editMode ? (i % 2 === 0 ? 'ff-wiggle-a 0.32s ease-in-out infinite' : 'ff-wiggle-b 0.32s ease-in-out infinite') : undefined;
                return (
                  <div
                    key={p.id}
                    className="relative"
                    style={{ animation: wiggle }}
                  >
                    <div
                      onClick={editMode ? () => setFormState({ kind: 'edit', id: p.id }) : undefined}
                      onPointerDown={editMode ? undefined : (e) => onPointerDown(e, p.id)}
                      onPointerMove={editMode ? undefined : onPointerMove}
                      onPointerUp={editMode ? undefined : onPointerUp}
                      onPointerCancel={editMode ? undefined : onPointerUp}
                      className={[
                        'select-none',
                        editMode ? 'cursor-pointer active:scale-95 transition-transform' : '',
                      ].join(' ')}
                      style={{ touchAction: editMode ? 'auto' : (drag?.presetId === p.id ? 'none' : 'pan-y') }}
                    >
                      <div
                        className={[
                          'aspect-square rounded-full border-2 border-accent/40 bg-accent/5 flex flex-col items-center justify-center p-2 transition-all',
                          armingId === p.id ? 'scale-110 border-accent shadow-lg shadow-accent/40' : '',
                          drag && drag.presetId === p.id ? 'opacity-20' : '',
                          drag && drag.presetId !== p.id ? 'opacity-30' : '',
                        ].join(' ')}
                      >
                        <p className="text-[11px] text-text font-medium text-center leading-tight line-clamp-2">{p.name}</p>
                        <p className="text-[12px] font-mono text-accent tabular mt-1">{p.kcal}</p>
                      </div>
                    </div>
                    {editMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                        aria-label={`刪除 ${p.name}`}
                        className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-danger text-white flex items-center justify-center shadow-md active:scale-90 transition-transform z-10"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 拖曳中的 ghost */}
        {draggingPreset && drag && (
          <div className="fixed pointer-events-none z-[150] -translate-x-1/2 -translate-y-1/2" style={{ left: drag.x, top: drag.y }}>
            <div className="w-20 h-20 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl shadow-accent/50">
              <p className="text-[10px] text-text font-medium leading-tight text-center px-1 line-clamp-2">{draggingPreset.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{draggingPreset.kcal}</p>
            </div>
          </div>
        )}
      </div>
      {/* 表單 overlay */}
      {formState !== 'closed' && (
        <div className="fixed inset-0 z-[110] bg-ink/95 backdrop-blur-md flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
          <div className="px-5 py-5 max-w-md mx-auto w-full">
            <h2 className="text-[16px] text-text font-medium mb-4">{formState === 'add' ? '新增印章' : '編輯印章'}</h2>
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
        </div>
      )}

      <InlineConfirmDialog
        open={deleteId != null}
        title="刪除這個印章？"
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
