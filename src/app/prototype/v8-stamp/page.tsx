'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockToast, useMockTodayLog } from '../_lib/mock-home';
import { MOCK_PRESETS } from '../_lib/mock-presets';

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

type DragState = {
  presetId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  movedPx: number;  // 累積位移；超過閾值才算「拖曳」進入跟手狀態
};

const DRAG_THRESHOLD = 8;

export default function StampPage() {
  const { log, addEntry } = useMockTodayLog();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverDrop, setHoverDrop] = useState(false);
  const [pressId, setPressId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([15, 30, 15]);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
  }

  function onPointerDown(e: React.PointerEvent, presetId: string) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setPressId(presetId);
    setDrag({ presetId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, movedPx: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    setDrag({ ...drag, x: e.clientX, y: e.clientY, movedPx: moved });
    if (moved > DRAG_THRESHOLD) {
      const el = dropRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        setHoverDrop(inside);
      }
    }
  }
  function onPointerUp() {
    if (drag) {
      const preset = MOCK_PRESETS.find((p) => p.id === drag.presetId);
      if (preset && hoverDrop) {
        record(preset.name, preset.kcal);
      }
    }
    setDrag(null);
    setHoverDrop(false);
    setPressId(null);
  }

  const draggingPreset = drag && drag.movedPx > DRAG_THRESHOLD ? MOCK_PRESETS.find((p) => p.id === drag.presetId) : null;

  return (
    <PrototypeShell title="7. Meal Stamp">
      <div className="h-full flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
        {/* 今日 + drop zone */}
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
              {hoverDrop && draggingPreset
                ? `放開蓋章「${draggingPreset.name}」`
                : '把印章拖到這裡'}
            </p>
            {hoverDrop && draggingPreset && (
              <p className="text-[18px] font-mono text-accent tabular mt-1">{draggingPreset.kcal} kcal</p>
            )}
          </div>
        </div>

        {/* 印章盤 — 可滾動 */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-6 border-t border-hairline">
          <div className="max-w-md mx-auto">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3 mt-2">
              印章盤 · {MOCK_PRESETS.length} 個
            </p>
            <div className="grid grid-cols-3 gap-3">
              {MOCK_PRESETS.map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => onPointerDown(e, p.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="select-none cursor-grab active:cursor-grabbing"
                  style={{ touchAction: 'none' }}
                >
                  <div
                    className={[
                      'aspect-square rounded-full border-2 border-accent/40 bg-accent/5 flex flex-col items-center justify-center p-2 transition-all',
                      pressId === p.id && !drag?.movedPx ? 'scale-105 border-accent' : '',
                      drag && drag.presetId !== p.id && drag.movedPx > DRAG_THRESHOLD ? 'opacity-30' : '',
                      drag && drag.presetId === p.id && drag.movedPx > DRAG_THRESHOLD ? 'opacity-20' : '',
                    ].join(' ')}
                  >
                    <p className="text-[11px] text-text font-medium text-center leading-tight line-clamp-2">{p.name}</p>
                    <p className="text-[12px] font-mono text-accent tabular mt-1">{p.kcal}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-4 font-mono mt-4 text-center">
              按住一枚印章，拖到上方藍框 · 連續拖可以連續蓋
            </p>
          </div>
        </div>

        {/* 拖曳中的 ghost */}
        {draggingPreset && drag && (
          <div
            className="fixed pointer-events-none z-[150] -translate-x-1/2 -translate-y-1/2"
            style={{ left: drag.x, top: drag.y }}
          >
            <div className="w-20 h-20 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl shadow-accent/50">
              <p className="text-[10px] text-text font-medium leading-tight text-center px-1 line-clamp-2">{draggingPreset.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{draggingPreset.kcal}</p>
            </div>
          </div>
        )}
      </div>
      <MockToast text={toast} />
    </PrototypeShell>
  );
}
