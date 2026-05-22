'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import {
  type MealBand, BAND_LABEL, BAND_LABEL_EN, presetsByBand, currentBand, pickByBand,
} from '../_lib/preset-bands';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Dynamic Island — 主页保留。
 * 入口：顶部 safe-area 下方一个 morph 胶囊（28px 高）。
 *   - collapsed: 显示当前时段 + 推荐 1 个 preset 名
 *   - tap → morph 展开成大岛（4 tab + 3 chip）
 *   - tap chip = record + auto collapse
 *   - long-press chip = swap
 *
 * 灵感：iOS 17 Dynamic Island / Live Activity morph 动画。
 * 占用极小（28px 顶部条），不挡主屏内容。
 */
const BANDS: MealBand[] = ['morning', 'noon', 'evening', 'snack'];
const PER_BAND = 3;
const LONG_PRESS_MS = 420;

export function IslandContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const nowBand = useMemo(() => currentBand(), []);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<MealBand>(nowBand);
  const [pinned, setPinned] = useState<Record<MealBand, string[]>>({
    morning: [], noon: [], evening: [], snack: [],
  });
  const [createOpen, setCreateOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    if (api.presets.length === 0) return;
    setPinned((prev) => {
      const next = { ...prev };
      BANDS.forEach((band) => {
        if (next[band].length === 0) {
          next[band] = presetsByBand(api.presets, band).slice(0, PER_BAND).map((p) => p.id);
        }
      });
      return next;
    });
  }, [api.presets]);

  const headlinePreset = useMemo(() => {
    const id = pinned[nowBand]?.[0];
    if (id) return api.presets.find((p) => p.id === id);
    return pickByBand(api.presets, nowBand, 1)[0];
  }, [pinned, nowBand, api.presets]);

  const counts = useMemo(() => {
    const c: Record<MealBand, number> = { morning: 0, noon: 0, evening: 0, snack: 0 };
    BANDS.forEach((b) => { c[b] = presetsByBand(api.presets, b).length; });
    return c;
  }, [api.presets]);

  const activeChips: (UserMealPreset | null)[] = useMemo(() => {
    const ids = pinned[active] ?? [];
    const list: (UserMealPreset | null)[] = [];
    for (let i = 0; i < PER_BAND; i++) {
      const id = ids[i];
      list.push(id ? api.presets.find((p) => p.id === id) ?? null : null);
    }
    return list;
  }, [pinned, active, api.presets]);

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function swapAt(slot: number) {
    setPinned((prev) => {
      const arr = [...prev[active]];
      const currentId = arr[slot];
      const inBand = presetsByBand(api.presets, active);
      const used = new Set(arr);
      const next = inBand.find((p) => p.id !== currentId && !used.has(p.id))
        ?? inBand.find((p) => p.id !== currentId);
      if (!next) return prev;
      arr[slot] = next.id;
      return { ...prev, [active]: arr };
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  }

  function onChipPointerDown(slot: number) {
    longPressFiredRef.current = false;
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      swapAt(slot);
    }, LONG_PRESS_MS);
  }
  function onChipPointerUp() { clearTimer(); }

  async function onChipClick(chip: UserMealPreset | null) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (!chip) {
      api.clearDuplicate();
      setOpen(false);
      setCreateOpen(true);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    setOpen(false);
    await api.recordCustomPreset(chip);
  }

  return (
    <PrototypeShell title="5. Dynamic Island">
      <RealHomeShell api={api} rightAction={null} />

      {/* backdrop when open */}
      <div
        className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] transition-opacity"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={() => setOpen(false)}
      />

      {/* dynamic island */}
      <div
        className="fixed left-0 right-0 z-[70] flex justify-center pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top) + 6px)' }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`island pointer-events-auto ${open ? 'island-open' : ''}`}
          aria-label={open ? 'close' : 'expand'}
        >
          {/* collapsed content */}
          <div className={`island-collapsed ${open ? 'island-fade-out' : ''}`}>
            <span className="island-dot" aria-hidden />
            <span className="island-band">{BAND_LABEL[nowBand]}</span>
            <span className="island-name">
              {headlinePreset ? headlinePreset.name.slice(0, 6) : '尚無'}
            </span>
            {headlinePreset && (
              <span className="island-kcal tabular">{Math.round(headlinePreset.kcal)}</span>
            )}
          </div>

          {/* expanded content */}
          <div className={`island-expanded ${open ? 'island-fade-in' : ''}`}>
            {/* 4 band tabs */}
            <div className="island-tabs">
              {BANDS.map((b) => {
                const isActive = active === b;
                const isNow = b === nowBand;
                return (
                  <button
                    key={b}
                    onClick={(e) => { e.stopPropagation(); setActive(b); }}
                    className={`island-tab ${isActive ? 'island-tab-active' : ''}`}
                  >
                    <span className="island-tab-glyph">{BAND_LABEL[b]}</span>
                    <span className="island-tab-sub">{BAND_LABEL_EN[b]}</span>
                    <span className="island-tab-count tabular">{counts[b]}</span>
                    {!isActive && isNow && <span className="island-tab-now" aria-hidden />}
                  </button>
                );
              })}
            </div>
            {/* 3 chip */}
            <div className="island-chips">
              {activeChips.map((chip, i) => (
                <button
                  key={`${active}-${i}`}
                  onClick={(e) => { e.stopPropagation(); onChipClick(chip); }}
                  onPointerDown={(e) => { e.stopPropagation(); onChipPointerDown(i); }}
                  onPointerUp={onChipPointerUp}
                  onPointerCancel={onChipPointerUp}
                  onPointerLeave={onChipPointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={api.recordingId != null}
                  className={`island-chip ${chip ? '' : 'island-chip-empty'} ${api.recordingId === chip?.id ? 'island-chip-loading' : ''}`}
                >
                  {chip ? (
                    <>
                      <span className="island-chip-name">{chip.name}</span>
                      <span className="island-chip-kcal tabular">{Math.round(chip.kcal)}</span>
                    </>
                  ) : (
                    <span className="island-chip-add">＋</span>
                  )}
                </button>
              ))}
            </div>
            <p className="island-hint">tap = 記錄 · long-press = 換</p>
          </div>
        </button>
      </div>

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

const styles = `
.island {
  position: relative;
  background: rgba(8, 8, 12, 0.96);
  border: 1px solid rgba(60, 60, 72, 0.5);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  cursor: pointer;
  overflow: hidden;
  width: 200px;
  height: 30px;
  border-radius: 999px;
  padding: 0 12px;
  transition:
    width 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.42s cubic-bezier(0.32, 0.72, 0, 1),
    background 0.3s,
    border-color 0.3s;
  box-shadow:
    0 8px 22px -6px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.05) inset,
    0 0 0 1px rgba(0,0,0,0.4) inset;
  display: flex;
  align-items: center;
  justify-content: center;
}
.island-open {
  width: min(360px, 92vw);
  height: 156px;
  border-radius: 24px;
  border-color: var(--color-accent);
  padding: 10px 12px 8px;
  box-shadow:
    0 22px 50px -12px rgba(0,0,0,0.8),
    0 0 0 4px rgba(200,255,0,0.08),
    0 0 30px rgba(200,255,0,0.18);
}

.island-collapsed {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: opacity 0.18s ease 0.1s;
}
.island-fade-out { opacity: 0; transition-delay: 0s; pointer-events: none; }

.island-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 5px rgba(200,255,0,0.7);
  animation: ff-pulse-soft 2s ease-in-out infinite;
}
.island-band {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.island-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-text-2);
  letter-spacing: 0.02em;
}
.island-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.island-expanded {
  position: absolute;
  inset: 10px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.16s ease;
  pointer-events: none;
}
.island-fade-in {
  opacity: 1;
  transition-delay: 0.18s;
  pointer-events: auto;
}

.island-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.island-tab {
  position: relative;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 3px 0 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.16s;
  color: var(--color-text-3);
}
.island-tab-active {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border-color: var(--color-accent);
  box-shadow: 0 0 10px rgba(200,255,0,0.2);
}
.island-tab-glyph {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}
.island-tab-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-top: 1px;
}
.island-tab-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 7.5px;
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}
.island-tab-now {
  position: absolute;
  right: 3px;
  top: 3px;
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 4px rgba(200,255,0,0.7);
}

.island-chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.island-chip {
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  height: 44px;
  padding: 3px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  transition: transform 0.14s, border-color 0.14s, background 0.14s;
}
.island-chip:active {
  transform: scale(0.93);
  border-color: var(--color-accent);
  background: rgba(200,255,0,0.10);
}
.island-chip-loading {
  border-color: var(--color-accent);
  animation: ff-pulse-soft 1s ease-in-out infinite;
}
.island-chip-empty {
  background: transparent;
  border: 1.5px dashed var(--color-hairline-strong);
  color: var(--color-text-4);
}
.island-chip-add { font-size: 14px; }
.island-chip-name {
  font-size: 10.5px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  line-height: 1.1;
}
.island-chip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--color-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.island-hint {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: var(--color-text-4);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  margin-top: 1px;
}
`;
