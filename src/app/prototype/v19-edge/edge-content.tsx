'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import {
  type MealBand, BAND_LABEL, BAND_LABEL_EN, presetsByBand, currentBand,
} from '../_lib/preset-bands';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Edge Swipe — 主页完全保留。
 * 入口：左右屏幕边缘各一条 3px lime 细线（旁边小标签）。
 *   - 左边缘 = 早 + 午
 *   - 右边缘 = 晚 + 零
 * 触发：tap edge 线 / 从 edge 向内拖动 → drawer 滑入
 *   含对应 2 个时段、每个 3 chip
 * tap chip = record + drawer 自动收回
 * long-press chip = swap
 */
type SideKey = 'left' | 'right';
const SIDE_BANDS: Record<SideKey, [MealBand, MealBand]> = {
  left: ['morning', 'noon'],
  right: ['evening', 'snack'],
};
const PER_BAND = 3;
const LONG_PRESS_MS = 420;
const SWIPE_OPEN_PX = 60;
const DRAWER_WIDTH = 220;

export function EdgeContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const nowBand = useMemo(() => currentBand(), []);
  const [openSide, setOpenSide] = useState<SideKey | null>(null);
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef<{ side: SideKey; startX: number } | null>(null);
  const [pinned, setPinned] = useState<Record<MealBand, string[]>>({
    morning: [], noon: [], evening: [], snack: [],
  });
  const [createOpen, setCreateOpen] = useState<MealBand | null>(null);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    if (api.presets.length === 0) return;
    setPinned((prev) => {
      const next = { ...prev };
      (['morning', 'noon', 'evening', 'snack'] as MealBand[]).forEach((band) => {
        if (next[band].length === 0) {
          next[band] = presetsByBand(api.presets, band).slice(0, PER_BAND).map((p) => p.id);
        }
      });
      return next;
    });
  }, [api.presets]);

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function swapAt(band: MealBand, slot: number) {
    setPinned((prev) => {
      const arr = [...prev[band]];
      const currentId = arr[slot];
      const inBand = presetsByBand(api.presets, band);
      const used = new Set(arr);
      const next = inBand.find((p) => p.id !== currentId && !used.has(p.id))
        ?? inBand.find((p) => p.id !== currentId);
      if (!next) return prev;
      arr[slot] = next.id;
      return { ...prev, [band]: arr };
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  }

  function onChipPointerDown(band: MealBand, slot: number) {
    longPressFiredRef.current = false;
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      swapAt(band, slot);
    }, LONG_PRESS_MS);
  }
  function onChipPointerUp() { clearTimer(); }

  async function onChipClick(chip: UserMealPreset | null, band: MealBand) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (!chip) {
      api.clearDuplicate();
      setOpenSide(null);
      setCreateOpen(band);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    setOpenSide(null);
    await api.recordCustomPreset(chip);
  }

  function onEdgePointerDown(side: SideKey, e: React.PointerEvent) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { side, startX: e.clientX };
    setDragX(0);
  }
  function onEdgePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    if (dragRef.current.side === 'left' && dx > 0) {
      setDragX(Math.min(dx, DRAWER_WIDTH));
    } else if (dragRef.current.side === 'right' && dx < 0) {
      setDragX(-Math.min(-dx, DRAWER_WIDTH));
    }
  }
  function onEdgePointerUp() {
    if (!dragRef.current) return;
    const side = dragRef.current.side;
    const distance = Math.abs(dragX);
    if (distance > SWIPE_OPEN_PX) {
      setOpenSide(side);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    } else if (distance < 6) {
      // tap
      setOpenSide(side);
    }
    setDragX(0);
    dragRef.current = null;
  }

  function renderEdgeBar(side: SideKey) {
    const [b1, b2] = SIDE_BANDS[side];
    const isNowSide = b1 === nowBand || b2 === nowBand;
    return (
      <button
        type="button"
        onPointerDown={(e) => onEdgePointerDown(side, e)}
        onPointerMove={onEdgePointerMove}
        onPointerUp={onEdgePointerUp}
        onPointerCancel={onEdgePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`open ${BAND_LABEL[b1]}${BAND_LABEL[b2]} drawer`}
        className={`edge-bar edge-bar-${side} ${isNowSide ? 'edge-bar-now' : ''}`}
      >
        <span className="edge-line" />
        <span className="edge-label">
          <span>{BAND_LABEL[b1]}</span>
          <span>·</span>
          <span>{BAND_LABEL[b2]}</span>
        </span>
        <span className="edge-arrow">{side === 'left' ? '›' : '‹'}</span>
      </button>
    );
  }

  function renderDrawer(side: SideKey) {
    const [b1, b2] = SIDE_BANDS[side];
    const isOpen = openSide === side;
    const dragOffset = openSide === null && dragRef.current?.side === side ? dragX : 0;
    let transform = '';
    if (isOpen) {
      transform = 'translateX(0)';
    } else if (dragOffset !== 0) {
      transform = `translateX(${side === 'left' ? dragOffset - DRAWER_WIDTH : DRAWER_WIDTH + dragOffset}px)`;
    } else {
      transform = `translateX(${side === 'left' ? -DRAWER_WIDTH - 12 : DRAWER_WIDTH + 12}px)`;
    }

    return (
      <div
        className={`drawer drawer-${side}`}
        style={{
          transform,
          transition: dragOffset !== 0 ? 'none' : 'transform 0.34s var(--ease-spring)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <div className="drawer-header">
          <p className="drawer-tag">{side === 'left' ? '上半天' : '下半天'}</p>
          <button onClick={() => setOpenSide(null)} className="drawer-close" aria-label="close">×</button>
        </div>
        {[b1, b2].map((band) => {
          const ids = pinned[band] ?? [];
          const slots: (UserMealPreset | null)[] = [];
          for (let i = 0; i < PER_BAND; i++) {
            const id = ids[i];
            slots.push(id ? api.presets.find((p) => p.id === id) ?? null : null);
          }
          const isNow = band === nowBand;
          return (
            <div key={band} className={`drawer-section ${isNow ? 'drawer-section-now' : ''}`}>
              <div className="drawer-band-label">
                <span className="drawer-band-glyph">{BAND_LABEL[band]}</span>
                <span className="drawer-band-en">{BAND_LABEL_EN[band]}</span>
                <span className="drawer-band-count tabular">
                  {presetsByBand(api.presets, band).length}
                </span>
              </div>
              <div className="drawer-chips">
                {slots.map((chip, i) => (
                  <button
                    key={`${band}-${i}`}
                    onClick={() => onChipClick(chip, band)}
                    onPointerDown={() => onChipPointerDown(band, i)}
                    onPointerUp={onChipPointerUp}
                    onPointerCancel={onChipPointerUp}
                    onPointerLeave={onChipPointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={api.recordingId != null}
                    className={`drawer-chip ${chip ? '' : 'drawer-chip-empty'} ${api.recordingId === chip?.id ? 'drawer-chip-loading' : ''}`}
                  >
                    {chip ? (
                      <>
                        <span className="drawer-chip-name">{chip.name}</span>
                        <span className="drawer-chip-kcal tabular">{Math.round(chip.kcal)}</span>
                      </>
                    ) : (
                      <span className="drawer-chip-add">＋</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="drawer-hint">tap = 記錄 · long-press = 換</p>
      </div>
    );
  }

  return (
    <PrototypeShell title="6. Edge Swipe">
      <RealHomeShell api={api} rightAction={null} />

      {/* backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] transition-opacity"
        style={{
          opacity: openSide ? 1 : 0,
          pointerEvents: openSide ? 'auto' : 'none',
        }}
        onClick={() => setOpenSide(null)}
      />

      {/* edge bars */}
      {renderEdgeBar('left')}
      {renderEdgeBar('right')}

      {/* drawers */}
      {renderDrawer('left')}
      {renderDrawer('right')}

      {createOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center"
          style={{ animation: 'ff-fade-in 0.2s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={() => setCreateOpen(null)} />
          <div
            className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">
              ＋ 新菜單 · {BAND_LABEL[createOpen]} 時段
            </p>
            <MockPresetForm
              submitLabel="保存"
              onSubmit={async (name, kcal) => {
                const ok = await api.addPreset(name, kcal);
                if (ok) setCreateOpen(null);
              }}
              onCancel={() => setCreateOpen(null)}
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

const styles = `
.edge-bar {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 65;
  background: transparent;
  border: none;
  width: 22px;
  height: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  padding: 0;
  touch-action: pan-y;
}
.edge-bar-left { left: 0; }
.edge-bar-right { right: 0; }

.edge-line {
  width: 3px;
  height: 80px;
  background: var(--color-accent);
  border-radius: 999px;
  box-shadow:
    0 0 6px rgba(200,255,0,0.5),
    0 0 12px rgba(200,255,0,0.2);
  opacity: 0.65;
  transition: opacity 0.18s, transform 0.18s;
}
.edge-bar-now .edge-line {
  opacity: 1;
  animation: ff-pulse-soft 2.4s ease-in-out infinite;
}
.edge-bar:active .edge-line {
  opacity: 1;
  transform: scaleX(1.8);
}

.edge-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-text-3);
  letter-spacing: 0.04em;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  writing-mode: vertical-rl;
  text-orientation: upright;
  line-height: 1.1;
}
.edge-bar-now .edge-label { color: var(--color-accent); }

.edge-arrow {
  font-size: 14px;
  color: var(--color-text-3);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
  font-weight: 700;
}
.edge-bar-now .edge-arrow { color: var(--color-accent); }

.drawer {
  position: fixed;
  top: 50%;
  width: ${DRAWER_WIDTH}px;
  max-height: 70vh;
  transform: translate(0, -50%);
  z-index: 75;
  background: rgba(20, 20, 26, 0.95);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--color-hairline-strong);
  padding: 10px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow:
    0 18px 40px -12px rgba(0,0,0,0.8),
    0 1px 0 rgba(255,255,255,0.04) inset;
}
.drawer-left {
  left: 0;
  top: 50%;
  transform: translate(-100%, -50%);
  border-left: none;
  border-top-right-radius: 18px;
  border-bottom-right-radius: 18px;
  border-right-color: var(--color-accent);
}
.drawer-right {
  right: 0;
  top: 50%;
  transform: translate(100%, -50%);
  border-right: none;
  border-top-left-radius: 18px;
  border-bottom-left-radius: 18px;
  border-left-color: var(--color-accent);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-hairline);
}
.drawer-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.drawer-close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--color-text-3);
  cursor: pointer;
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
}

.drawer-section {
  padding: 4px 2px;
  border-radius: 8px;
  border: 1px solid transparent;
}
.drawer-section-now {
  background: rgba(200, 255, 0, 0.06);
  border-color: rgba(200, 255, 0, 0.25);
}
.drawer-band-label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
  padding: 0 4px;
}
.drawer-band-glyph {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.drawer-section-now .drawer-band-glyph { color: var(--color-accent); }
.drawer-band-en {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-text-3);
}
.drawer-band-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: var(--color-text-4);
  margin-left: auto;
}

.drawer-chips {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3px;
}
.drawer-chip {
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.14s, border-color 0.14s, background 0.14s;
  text-align: left;
}
.drawer-chip:active {
  transform: scale(0.97);
  border-color: var(--color-accent);
  background: rgba(200,255,0,0.10);
}
.drawer-chip-loading {
  border-color: var(--color-accent);
  animation: ff-pulse-soft 1s ease-in-out infinite;
}
.drawer-chip-empty {
  background: transparent;
  border: 1.5px dashed var(--color-hairline-strong);
  color: var(--color-text-4);
  justify-content: center;
}
.drawer-chip-add { font-size: 14px; }
.drawer-chip-name {
  font-size: 12px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.drawer-chip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--color-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.drawer-hint {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: var(--color-text-4);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  margin-top: 2px;
}
`;
