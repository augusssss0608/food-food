'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Pocket Deck — 主页结构保留不变。
 * 入口：右下角一副 preset 牌堆，4 张卡错位堆叠，永远露出顶张。
 *   - tap 顶张 = 直接记录该 preset
 *   - 上滑顶张 = 跳过，露出下一张
 *   - 长按顶张 = 弹出 menu（拍 / 自定義 / 全部 / 跳）
 * 牌堆是 always-on 入口，零点击成本，但又不抢主屏视线。
 */
const STACK_DEPTH = 4;
const SWIPE_DISMISS = 70;
const TAP_THRESHOLD = 8;

export function DeckContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [flyOut, setFlyOut] = useState<{ dir: 'up' | 'left' | 'right' } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const presets = api.presets;
  const visibleCards: { preset: UserMealPreset; depth: number }[] = [];
  for (let i = 0; i < STACK_DEPTH && i < presets.length; i++) {
    visibleCards.push({ preset: presets[(idx + i) % presets.length]!, depth: i });
  }
  // 顶张
  const top = visibleCards[0]?.preset;

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!top) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    longPressFiredRef.current = false;
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      setMenuOpen(true);
    }, 420);
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 4) clearTimer();
    setDrag({ dx, dy });
  }
  async function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - dragStartRef.current.t;
    dragStartRef.current = null;
    clearTimer();
    setDrag(null);

    if (longPressFiredRef.current) {
      // menu 已弹出，不做记录
      return;
    }

    if (r < TAP_THRESHOLD && elapsed < 280) {
      // tap = record
      if (top) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 30, 10]);
        await api.recordCustomPreset(top);
        nextCard();
      }
      return;
    }
    // swipe
    if (dy < -SWIPE_DISMISS) {
      setFlyOut({ dir: 'up' });
      setTimeout(() => { nextCard(); setFlyOut(null); }, 260);
    } else if (dx < -SWIPE_DISMISS) {
      setFlyOut({ dir: 'left' });
      setTimeout(() => { nextCard(); setFlyOut(null); }, 260);
    } else if (dx > SWIPE_DISMISS) {
      setFlyOut({ dir: 'right' });
      setTimeout(() => { nextCard(); setFlyOut(null); }, 260);
    }
  }
  function onPointerCancel() {
    dragStartRef.current = null;
    clearTimer();
    setDrag(null);
  }

  function nextCard() {
    if (presets.length === 0) return;
    setIdx((i) => (i + 1) % presets.length);
  }

  function ShuffleButton() {
    return (
      <button
        onClick={() => setAllOpen(true)}
        aria-label="full list"
        className="p-2 -mr-2 active:scale-95 transition-all rounded-md text-text-2 hover:text-accent"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 3h5v5" />
          <path d="M4 20L21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15l6 6" />
          <path d="M4 4l5 5" />
        </svg>
      </button>
    );
  }

  return (
    <PrototypeShell title="7. Pocket Deck">
      <RealHomeShell api={api} rightAction={<ShuffleButton />} />

      {/* 牌堆 */}
      <div
        className="fixed right-5 z-[70] select-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
          width: 168,
          height: 160,
        }}
      >
        {presets.length === 0 ? (
          <button
            onClick={() => { api.clearDuplicate(); setCreateOpen(true); }}
            className="deck-empty"
          >
            <span className="text-[12px] font-mono uppercase tracking-wider">＋ 第一張</span>
          </button>
        ) : (
          visibleCards
            .slice()
            .reverse()
            .map(({ preset, depth }) => {
              const isTop = depth === 0;
              const baseY = -depth * 5;
              const baseScale = 1 - depth * 0.04;
              const baseRot = (depth % 2 === 0 ? -1 : 1) * (depth * 0.8);

              let topTransform = `translateY(${baseY}px) scale(${baseScale}) rotate(${baseRot}deg)`;
              if (isTop && drag) {
                topTransform = `translate(${drag.dx}px, ${drag.dy + baseY}px) rotate(${baseRot + drag.dx * 0.05}deg) scale(1)`;
              }
              if (isTop && flyOut) {
                const tx = flyOut.dir === 'left' ? -300 : flyOut.dir === 'right' ? 300 : 0;
                const ty = flyOut.dir === 'up' ? -400 : 0;
                topTransform = `translate(${tx}px, ${ty}px) rotate(${tx * 0.05}deg) scale(0.9)`;
              }

              return (
                <button
                  key={`${preset.id}-${depth}`}
                  type="button"
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? onPointerCancel : undefined}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`deck-card ${isTop ? 'deck-card-top' : ''}`}
                  style={{
                    zIndex: STACK_DEPTH - depth,
                    transform: topTransform,
                    transition: isTop && (drag || flyOut)
                      ? (flyOut ? 'transform 0.26s cubic-bezier(0.4, 0, 1, 1)' : 'none')
                      : 'transform 0.32s var(--ease-spring)',
                    pointerEvents: isTop ? 'auto' : 'none',
                    opacity: flyOut && isTop ? 0 : 1,
                  }}
                >
                  <div className="deck-card-header">
                    <span className="deck-card-badge">
                      {STACK_DEPTH - depth} / {Math.min(presets.length, STACK_DEPTH)}
                    </span>
                  </div>
                  <div className="deck-card-body">
                    <p className="deck-card-name">{preset.name}</p>
                    <p className="deck-card-kcal tabular">
                      {Math.round(preset.kcal)}
                      <span className="deck-card-unit">kcal</span>
                    </p>
                  </div>
                  {isTop && (
                    <div className="deck-card-hint">
                      <span>tap · log</span>
                      <span className="opacity-50">↑ swipe · skip</span>
                    </div>
                  )}
                </button>
              );
            })
        )}
      </div>

      {/* 长按 menu */}
      {menuOpen && top && (
        <div
          className="fixed inset-0 z-[90]"
          onClick={() => setMenuOpen(false)}
          style={{ animation: 'ff-fade-in 0.16s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/65 backdrop-blur-sm" />
          <div
            className="absolute"
            style={{
              right: 20,
              bottom: 'calc(env(safe-area-inset-bottom) + 12rem)',
              animation: 'pop-in 0.2s var(--ease-spring) both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-surface-2 border border-accent/40 rounded-lg overflow-hidden min-w-[200px] shadow-2xl shadow-black/60">
              <MenuItem onClick={async () => { setMenuOpen(false); await api.recordCustomPreset(top); nextCard(); }}>
                <span className="text-accent">●</span>記錄「{top.name}」
              </MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); nextCard(); }}>
                <span className="text-text-3">○</span>跳過此張
              </MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); setAllOpen(true); }}>
                <span className="text-text-3">⋯</span>全部 preset
              </MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); api.clearDuplicate(); setCreateOpen(true); }}>
                <span className="text-text-3">＋</span>新建 preset
              </MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)} divider>
                <span className="text-text-3">×</span>取消
              </MenuItem>
            </div>
          </div>
        </div>
      )}

      {allOpen && (
        <AllPresetSheet
          presets={api.presets}
          recordingId={api.recordingId}
          onPick={async (p) => { await api.recordCustomPreset(p); setAllOpen(false); }}
          onCreate={() => { api.clearDuplicate(); setAllOpen(false); setCreateOpen(true); }}
          onClose={() => setAllOpen(false)}
        />
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center"
          style={{ animation: 'ff-fade-in 0.2s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div
            className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">＋ 新菜單</p>
            <MockPresetForm
              submitLabel="保存"
              onSubmit={async (name, kcal) => {
                const ok = await api.addPreset(name, kcal);
                if (ok) setCreateOpen(false);
              }}
              onCancel={() => setCreateOpen(false)}
            />
            {api.duplicateName && (
              <p className="text-[11px] text-danger mt-2 text-center">已存在同名菜單，請改名</p>
            )}
          </div>
        </div>
      )}

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function MenuItem({ children, onClick, divider }: { children: React.ReactNode; onClick: () => void; divider?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3.5 py-3 text-left text-[13px] text-text hover:bg-surface active:bg-surface flex items-center gap-2.5 ${
        divider ? 'border-t border-hairline' : 'border-b border-hairline last:border-b-0'
      }`}
    >
      {children}
    </button>
  );
}

function AllPresetSheet({
  presets, recordingId, onPick, onCreate, onClose,
}: {
  presets: UserMealPreset[];
  recordingId: string | null;
  onPick: (p: UserMealPreset) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 px-4 pt-4 rounded-t-2xl"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
          animation: 'drawer-up 0.28s var(--ease-out-soft) both',
          maxHeight: '65vh',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">all presets</p>
          <button onClick={onClose} className="text-[11px] text-text-3 font-mono active:scale-95">close</button>
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto" style={{ maxHeight: 'calc(65vh - 80px)' }}>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              disabled={recordingId != null}
              className="bg-surface border border-hairline px-3 py-2.5 text-left hover:border-accent/60 active:scale-95 transition-all disabled:opacity-50 rounded"
            >
              <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">
                {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
              </p>
            </button>
          ))}
          <button
            onClick={onCreate}
            className="bg-surface border-2 border-dashed border-hairline-strong text-text-3 hover:text-accent hover:border-accent/60 active:scale-95 transition-all py-3 text-[11px] font-mono uppercase tracking-wider rounded"
          >
            ＋ new
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
@keyframes drawer-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes pop-in { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.deck-card {
  position: absolute;
  inset: 0;
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  box-shadow:
    0 12px 28px -10px rgba(0,0,0,0.7),
    0 2px 4px rgba(0,0,0,0.3),
    0 1px 0 rgba(255,255,255,0.04) inset;
  transform-origin: bottom center;
  will-change: transform;
  backface-visibility: hidden;
}
.deck-card-top {
  background: linear-gradient(180deg, rgba(28,28,34,0.95) 0%, rgba(20,20,26,1) 100%);
  border-color: var(--color-accent);
  box-shadow:
    0 16px 36px -12px rgba(0,0,0,0.8),
    0 0 24px rgba(200,255,0,0.18),
    0 1px 0 rgba(200,255,0,0.15) inset;
}
.deck-card-header {
  display: flex;
  justify-content: flex-end;
}
.deck-card-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}
.deck-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.deck-card-name {
  font-size: 15px;
  color: var(--color-text);
  font-weight: 600;
  letter-spacing: -0.005em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.deck-card-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px;
  color: var(--color-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin-top: 4px;
}
.deck-card-unit {
  font-size: 9px;
  color: var(--color-text-3);
  margin-left: 4px;
  font-weight: 400;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.deck-card-hint {
  display: flex;
  justify-content: space-between;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: var(--color-text-3);
  text-transform: lowercase;
  letter-spacing: 0.06em;
}

.deck-empty {
  position: absolute;
  inset: 0;
  background: transparent;
  border: 1.5px dashed var(--color-hairline-strong);
  border-radius: 10px;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.deck-empty:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
`;
