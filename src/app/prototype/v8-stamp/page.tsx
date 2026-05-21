'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockToast, useMockTodayLog, useMockPresets } from '../_lib/mock-home';
import { PresetManagerSheet } from '../_lib/preset-manager';

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

export default function StampPage() {
  const { log, addEntry } = useMockTodayLog();
  const { presets, addPreset, updatePreset, deletePreset } = useMockPresets();
  const [manageOpen, setManageOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [armingId, setArmingId] = useState<string | null>(null);
  const [hoverDrop, setHoverDrop] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

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
              <button
                onClick={() => setManageOpen(true)}
                className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95"
              >
                ⚙ 管理
              </button>
            </div>
            <p className="text-[10px] text-text-4 font-mono mb-3">
              ⓘ 長按 0.35 秒進入拖曳模式 · 短按可滾動列表
            </p>
            <div className="grid grid-cols-3 gap-3">
              {presets.map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => onPointerDown(e, p.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="select-none"
                  style={{ touchAction: drag?.presetId === p.id ? 'none' : 'pan-y' }}
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
              ))}
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
      <PresetManagerSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        presets={presets}
        onAdd={addPreset}
        onUpdate={updatePreset}
        onDelete={deletePreset}
      />

      <MockToast text={toast} />
    </PrototypeShell>
  );
}
