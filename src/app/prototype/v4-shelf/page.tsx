'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, MockToast, useMockTodayLog } from '../_lib/mock-home';
import { MOCK_PRESETS, MOCK_RECENT_PHOTO } from '../_lib/mock-presets';

const PEEK_H = 92;
const HALF_H = 320;
const FULL_RATIO = 0.85;

type State = 'peek' | 'half' | 'full';

/**
 * 餐盤架 Shelf：底部常駐 peek，顯示「向上拉」hint + 常用快捷 chip。
 * 拖動 / 點 chip 進入 half / full 狀態。half 顯示常用網格，full 顯示全部菜單庫。
 */
export default function ShelfPage() {
  const { log, addEntry } = useMockTodayLog();
  const [state, setState] = useState<State>('peek');
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [winH, setWinH] = useState(800);
  const startRef = useRef<{ y: number; baseH: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setWinH(window.innerHeight);
    const onResize = () => setWinH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
    setState('peek');
  }

  return (
    <PrototypeShell title="4. 餐盤架 Shelf">
      <div className="h-full relative overflow-hidden">
        <MockHome log={log} scrollPaddingBottom={currentH + 24} />

        <aside
          className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-hairline rounded-t-3xl shadow-2xl shadow-black/60 flex flex-col z-10"
          style={{
            height: `${currentH}px`,
            transition: dragging ? 'none' : 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* 把手 + peek 區（始終可拖） */}
          <div
            className="flex-shrink-0 select-none cursor-grab active:cursor-grabbing"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            onClick={() => state === 'peek' && setState('half')}
          >
            <div className="w-10 h-1 bg-text-3/40 rounded-full mx-auto mt-2.5 mb-2" />
            <div className="px-4 pb-3">
              {state === 'peek' ? (
                // peek 狀態：水平滾動的常用 chip + 拍照
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {MOCK_PRESETS.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); record(p.name, p.kcal); }}
                        className="bg-surface border border-hairline rounded-full pl-3 pr-2.5 py-1.5 flex items-center gap-2 hover:border-accent/60 active:scale-95 transition-all flex-shrink-0"
                      >
                        <span className="text-[12px] text-text font-medium truncate max-w-[90px]">{p.name}</span>
                        <span className="text-[10px] font-mono text-accent tabular">{p.kcal}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); record('拍照識別餐', 420); }}
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-surface border border-hairline flex items-center justify-center hover:border-accent/60 active:scale-95 transition-all"
                  >
                    <span className="text-[15px]">📷</span>
                  </button>
                </div>
              ) : (
                // half / full：header 切換
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono">
                    {state === 'full' ? `全部 ${MOCK_PRESETS.length} 個菜單` : '常用菜單'}
                  </p>
                  {state === 'half' ? (
                    <button onClick={(e) => { e.stopPropagation(); setState('full'); }} className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95">
                      展開全部 ↑
                    </button>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setState('half'); }} className="text-[11px] text-text-3 font-mono uppercase tracking-wider hover:text-text active:scale-95">
                      收起 ↓
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 展開後的內容區 */}
          {state !== 'peek' && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 border-t border-hairline">
              <div className="grid grid-cols-2 gap-2 pt-3">
                {(state === 'full' ? MOCK_PRESETS : MOCK_PRESETS.slice(0, 6)).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => record(p.name, p.kcal)}
                    className="bg-surface border border-hairline rounded-xl p-3.5 text-left hover:border-hairline-strong active:scale-[0.98] transition-all"
                  >
                    <p className="text-[13px] text-text font-medium truncate">{p.name}</p>
                    <p className="text-[16px] font-mono text-accent tabular mt-1">{p.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
                  </button>
                ))}
              </div>

              {state === 'full' && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mt-5 mb-2">近期拍照</p>
                  <ul className="space-y-1.5">
                    {MOCK_RECENT_PHOTO.map((m) => (
                      <li key={m.meal_id}>
                        <button
                          onClick={() => record(m.dish_name, m.kcal)}
                          className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2 flex items-center justify-between hover:border-hairline-strong active:scale-[0.99] transition-all"
                        >
                          <span className="text-[12px] text-text">{m.dish_name}</span>
                          <span className="text-[11px] font-mono text-accent tabular">{m.kcal}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </aside>

        <MockToast text={toast} />
      </div>
    </PrototypeShell>
  );
}
