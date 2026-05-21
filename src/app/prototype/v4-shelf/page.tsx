'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MOCK_PRESETS } from '../_lib/mock-presets';

const PEEK_H = 68;       // 收起時露出
const HALF_H = 280;      // 短拉
const FULL_H = 0.85;     // 長拉佔屏比例

type State = 'peek' | 'half' | 'full';

export default function ShelfPage() {
  const [state, setState] = useState<State>('peek');
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ y: number; baseH: number } | null>(null);
  const [recordedName, setRecordedName] = useState<string | null>(null);

  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const baseH = state === 'peek' ? PEEK_H : state === 'half' ? HALF_H : winH * FULL_H;
  const currentH = Math.max(PEEK_H, Math.min(winH * FULL_H, baseH + dragOffset));

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    startRef.current = { y: e.touches[0]!.clientY, baseH };
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!startRef.current) return;
    const dy = startRef.current.y - e.touches[0]!.clientY; // 上拉 dy > 0
    setDragOffset(dy);
  }
  function onTouchEnd() {
    if (!startRef.current) return;
    const finalH = startRef.current.baseH + dragOffset;
    startRef.current = null;
    setDragging(false);
    setDragOffset(0);
    // 吸附到最近的狀態
    const distances = [
      { state: 'peek' as State, d: Math.abs(finalH - PEEK_H) },
      { state: 'half' as State, d: Math.abs(finalH - HALF_H) },
      { state: 'full' as State, d: Math.abs(finalH - winH * FULL_H) },
    ];
    distances.sort((a, b) => a.d - b.d);
    setState(distances[0]!.state);
  }

  function record(name: string) {
    setRecordedName(name);
    setTimeout(() => setRecordedName(null), 1500);
    setState('peek');
  }

  return (
    <PrototypeShell title="4. 餐盤架 Shelf" subtitle="Persistent bottom dock">
      <div className="h-full relative overflow-hidden bg-ink">
        {/* 模擬主頁（被 shelf 覆蓋一部分） */}
        <div className="h-full px-5 py-6 overflow-y-auto" style={{ paddingBottom: `${currentH + 16}px` }}>
          <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-2">today · 5/22</p>
          <h1 className="display-roman text-[34px] leading-none mb-6">food · food</h1>
          <div className="bg-surface border border-hairline rounded-xl p-4 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono mb-2">今日攝入</p>
            <p className="text-[24px] font-mono tabular text-text font-medium">1420 / 2200 kcal</p>
          </div>
          <div className="bg-surface border border-hairline rounded-xl p-4 mb-3 text-text-3 text-[12px]">
            （模擬今日記錄列表）
          </div>
        </div>

        {/* Shelf */}
        <aside
          className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-hairline rounded-t-2xl shadow-2xl shadow-black/50 flex flex-col z-10"
          style={{
            height: `${currentH}px`,
            transition: dragging ? 'none' : 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* 把手 + peek 顯示 */}
          <div
            className="flex-shrink-0 px-4 select-none cursor-grab active:cursor-grabbing"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            onClick={() => state === 'peek' && setState('half')}
          >
            <div className="w-10 h-1 bg-text-3/40 rounded-full mx-auto mt-2 mb-1.5" />
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {MOCK_PRESETS.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); record(p.name); }}
                    className="bg-surface border border-hairline rounded-lg px-3 py-1.5 flex items-center gap-2 hover:border-accent/60 active:scale-95 transition-all flex-shrink-0"
                  >
                    <span className="text-[12px] text-text font-medium truncate max-w-[80px]">{p.name}</span>
                    <span className="text-[11px] font-mono text-accent tabular">{p.kcal}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); alert('拍照 demo'); }}
                className="ml-2 flex-shrink-0 w-9 h-9 rounded-full bg-surface border border-hairline flex items-center justify-center hover:border-accent/60 active:scale-95 transition-all"
              >
                <span className="text-[16px]">📷</span>
              </button>
            </div>
          </div>

          {/* half / full：展開的菜單庫 */}
          {state !== 'peek' && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 border-t border-hairline">
              <div className="flex items-center justify-between py-3">
                <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono">
                  {state === 'full' ? '全部菜單' : '常用前 8 個'}
                </p>
                {state !== 'full' && (
                  <button
                    type="button"
                    onClick={() => setState('full')}
                    className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95"
                  >
                    展開全部
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(state === 'full' ? MOCK_PRESETS : MOCK_PRESETS.slice(0, 8)).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => record(p.name)}
                    className="bg-surface border border-hairline rounded-xl p-3 text-left hover:border-hairline-strong active:scale-[0.98] transition-all"
                  >
                    <p className="text-[13px] text-text font-medium truncate">{p.name}</p>
                    <p className="text-[15px] font-mono text-accent tabular mt-1">{p.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {recordedName && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg z-20">
            已記錄「{recordedName}」
          </div>
        )}
      </div>
    </PrototypeShell>
  );
}
