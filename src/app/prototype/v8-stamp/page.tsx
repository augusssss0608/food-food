'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MOCK_PRESETS, MOCK_TODAY_LOG, type TodayLogEntry } from '../_lib/mock-presets';

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

type DragState = {
  presetId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

export default function StampPage() {
  const [log, setLog] = useState<TodayLogEntry[]>(MOCK_TODAY_LOG);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverDrop, setHoverDrop] = useState(false);
  const [stampPress, setStampPress] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function record(name: string, kcal: number) {
    setLog((prev) => [...prev, { id: `l-${Date.now()}`, ate_at: new Date().toISOString(), dish_name: name, kcal }]);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([15, 30, 15]);
  }

  function onPointerDown(e: React.PointerEvent, presetId: string) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setStampPress(presetId);
    setDrag({ presetId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    // hit test drop zone
    const el = dropRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      setHoverDrop(inside);
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
    setStampPress(null);
  }

  const draggingPreset = drag ? MOCK_PRESETS.find((p) => p.id === drag.presetId) : null;

  return (
    <PrototypeShell title="8. Meal Stamp">
      <div className="h-full flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
        <div className="flex-shrink-0 px-5 pt-3 pb-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3">今日</p>
          <ul className="space-y-1.5 mb-3">
            {log.map((m) => (
              <li
                key={m.id}
                className="bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between text-[13px]"
              >
                <span className="text-text-3 font-mono">{fmtTime(m.ate_at)}</span>
                <span className="text-text font-medium flex-1 mx-3 truncate">{m.dish_name}</span>
                <span className="text-accent font-mono tabular">{m.kcal}</span>
              </li>
            ))}
          </ul>
          <div
            ref={dropRef}
            className={[
              'border-2 border-dashed rounded-xl px-4 py-6 text-center transition-all',
              hoverDrop ? 'border-accent bg-accent/15 scale-[1.02]' : 'border-hairline bg-surface/30',
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

        {/* 印章盤 */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-6 border-t border-hairline">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3 mt-2">印章盤</p>
          <div className="grid grid-cols-3 gap-3">
            {MOCK_PRESETS.map((p) => (
              <div
                key={p.id}
                onPointerDown={(e) => onPointerDown(e, p.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="select-none touch-none cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
              >
                <div
                  className={[
                    'aspect-square rounded-full border-2 border-accent/40 bg-accent/5 flex flex-col items-center justify-center p-2 transition-all',
                    stampPress === p.id ? 'scale-110 border-accent bg-accent/20 shadow-xl shadow-accent/30' : '',
                    drag && drag.presetId !== p.id ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  <p className="text-[11px] text-text font-medium text-center leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-[12px] font-mono text-accent tabular mt-1">{p.kcal}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-4 font-mono mt-4 text-center">按住一枚印章，拖到上方藍框</p>
        </div>

        {/* 拖曳中的 ghost */}
        {drag && draggingPreset && (
          <div
            className="fixed pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2"
            style={{ left: drag.x, top: drag.y }}
          >
            <div className="w-20 h-20 rounded-full border-2 border-accent bg-accent/30 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl shadow-accent/50">
              <p className="text-[10px] text-text font-medium leading-tight text-center px-1 line-clamp-2">{draggingPreset.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">{draggingPreset.kcal}</p>
            </div>
          </div>
        )}
      </div>
    </PrototypeShell>
  );
}
