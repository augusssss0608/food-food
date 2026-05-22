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
 * Dock Grid — 主页结构保留。
 * 入口：屏底 fixed dock，5 tab（★/早/午/晚/零）+ 3×3 chip grid。
 *
 * 关键设计：
 * - 永远 9 个 chip 可见，tap = record。
 * - 自定义多了不滑列表 → 长按 chip = swap 为该 band 未显示的下一个 preset，连续长按可循环。
 * - 当前时段 tab 自动高亮，但默认选中 ★（用户收藏）。
 */
type TabKey = MealBand | 'favorite';

const TABS: { key: TabKey; label: string; sub: string }[] = [
  { key: 'favorite', label: '★', sub: 'fav' },
  { key: 'morning',  label: BAND_LABEL.morning, sub: BAND_LABEL_EN.morning },
  { key: 'noon',     label: BAND_LABEL.noon,    sub: BAND_LABEL_EN.noon },
  { key: 'evening',  label: BAND_LABEL.evening, sub: BAND_LABEL_EN.evening },
  { key: 'snack',    label: BAND_LABEL.snack,   sub: BAND_LABEL_EN.snack },
];

const GRID_SIZE = 9;
const LONG_PRESS_MS = 420;

export function DockContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [active, setActive] = useState<TabKey>('favorite');
  const [pinnedIds, setPinnedIds] = useState<Record<TabKey, string[]>>({
    favorite: [], morning: [], noon: [], evening: [], snack: [],
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const nowBand = useMemo(() => currentBand(), []);

  // 初始化每个 tab 的 pinned（首次加载 + presets 变化时填充未初始化的 tab）
  useEffect(() => {
    if (api.presets.length === 0) return;
    setPinnedIds((prev) => {
      const next = { ...prev };
      (['morning', 'noon', 'evening', 'snack'] as MealBand[]).forEach((band) => {
        if (next[band].length === 0) {
          next[band] = presetsByBand(api.presets, band).slice(0, GRID_SIZE).map((p) => p.id);
        }
      });
      if (next.favorite.length === 0) {
        next.favorite = api.presets.slice(0, GRID_SIZE).map((p) => p.id);
      }
      return next;
    });
  }, [api.presets]);

  const visibleIds = pinnedIds[active] ?? [];
  const visibleChips: (UserMealPreset | null)[] = useMemo(() => {
    const list: (UserMealPreset | null)[] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      const id = visibleIds[i];
      list.push(id ? api.presets.find((p) => p.id === id) ?? null : null);
    }
    return list;
  }, [visibleIds, api.presets]);

  const sourcePool: UserMealPreset[] = useMemo(() => {
    if (active === 'favorite') return api.presets;
    return presetsByBand(api.presets, active);
  }, [active, api.presets]);

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function swapChipAt(slotIdx: number) {
    setPinnedIds((prev) => {
      const arr = [...prev[active]];
      const currentId = arr[slotIdx];
      const used = new Set(arr);
      // 找下一个未在窗口里的 preset
      const candidates = sourcePool.filter((p) => p.id !== currentId);
      const next = candidates.find((p) => !used.has(p.id))
        ?? candidates[0]; // pool 用完了就拿第一个不同的
      if (!next) return prev;
      arr[slotIdx] = next.id;
      return { ...prev, [active]: arr };
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  }

  function onChipPointerDown(slotIdx: number) {
    longPressFiredRef.current = false;
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      swapChipAt(slotIdx);
    }, LONG_PRESS_MS);
  }
  function onChipPointerUp() {
    clearTimer();
  }
  async function onChipClick(slotIdx: number) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    setHint(false);
    const chip = visibleChips[slotIdx];
    if (!chip) {
      api.clearDuplicate();
      setCreateOpen(true);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    await api.recordCustomPreset(chip);
  }

  const counts: Record<TabKey, number> = useMemo(() => ({
    favorite: api.presets.length,
    morning: presetsByBand(api.presets, 'morning').length,
    noon: presetsByBand(api.presets, 'noon').length,
    evening: presetsByBand(api.presets, 'evening').length,
    snack: presetsByBand(api.presets, 'snack').length,
  }), [api.presets]);

  return (
    <PrototypeShell title="4. Dock Grid">
      <RealHomeShell api={api} rightAction={null} />

      <div
        className="fixed left-0 right-0 z-[70] px-3 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="dock pointer-events-auto">
          {/* tabs */}
          <div className="dock-tabs">
            {TABS.map((t) => {
              const isActive = active === t.key;
              const isCurrentBand = t.key === nowBand;
              return (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className={`dock-tab ${isActive ? 'dock-tab-active' : ''}`}
                >
                  <span className="dock-tab-label">{t.label}</span>
                  <span className="dock-tab-sub">{t.sub}</span>
                  {!isActive && isCurrentBand && <span className="dock-tab-now" aria-hidden />}
                  <span className="dock-tab-count tabular">{counts[t.key]}</span>
                </button>
              );
            })}
          </div>

          {/* 3×3 grid */}
          <div className="dock-grid">
            {visibleChips.map((chip, i) => (
              <button
                key={`${active}-${i}`}
                onClick={() => onChipClick(i)}
                onPointerDown={() => onChipPointerDown(i)}
                onPointerUp={onChipPointerUp}
                onPointerCancel={onChipPointerUp}
                onPointerLeave={onChipPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={api.recordingId != null}
                className={`dock-chip ${chip ? '' : 'dock-chip-empty'} ${api.recordingId === chip?.id ? 'dock-chip-loading' : ''}`}
              >
                {chip ? (
                  <>
                    <span className="dock-chip-name">{chip.name}</span>
                    <span className="dock-chip-kcal tabular">{Math.round(chip.kcal)}</span>
                  </>
                ) : (
                  <span className="dock-chip-add">＋</span>
                )}
              </button>
            ))}
          </div>

          <p className="dock-hint">
            {hint
              ? 'tap = 記錄 · long-press = 換成另一個'
              : `${counts[active]} 個 preset 在「${active === 'favorite' ? '★' : BAND_LABEL[active]}」 · long-press 輪換`}
          </p>
        </div>
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
.dock {
  max-width: 480px;
  margin: 0 auto;
  background: rgba(20, 20, 26, 0.88);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 18px;
  padding: 8px 10px 6px;
  box-shadow:
    0 16px 40px -12px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.05) inset;
}

.dock-tabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}
.dock-tab {
  position: relative;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 0 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  cursor: pointer;
  transition: all 0.16s;
  color: var(--color-text-3);
}
.dock-tab-active {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border-color: var(--color-accent);
  box-shadow: 0 0 14px rgba(200,255,0,0.25);
}
.dock-tab:not(.dock-tab-active):hover { color: var(--color-text); }
.dock-tab-label {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}
.dock-tab-active .dock-tab-label { font-weight: 700; }
.dock-tab-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-top: 1px;
}
.dock-tab-active .dock-tab-sub { opacity: 0.85; }
.dock-tab-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  opacity: 0.65;
  margin-top: 1px;
}
.dock-tab-now {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 5px rgba(200,255,0,0.7);
}

.dock-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.dock-chip {
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  height: 52px;
  padding: 6px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  transition: transform 0.14s, border-color 0.14s, background 0.14s;
  min-width: 0;
}
.dock-chip:active {
  transform: scale(0.94);
  border-color: var(--color-accent);
  background: rgba(200,255,0,0.10);
}
.dock-chip-loading {
  border-color: var(--color-accent);
  animation: ff-pulse-soft 1s ease-in-out infinite;
}
.dock-chip-empty {
  background: transparent;
  border: 1.5px dashed var(--color-hairline-strong);
  color: var(--color-text-4);
}
.dock-chip-empty:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.dock-chip-add {
  font-size: 16px;
  font-weight: 400;
}
.dock-chip-name {
  font-size: 11.5px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  line-height: 1.15;
}
.dock-chip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.dock-hint {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  color: var(--color-text-4);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  margin-top: 6px;
  margin-bottom: 2px;
}
`;
