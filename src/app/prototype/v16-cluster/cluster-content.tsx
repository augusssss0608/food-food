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
 * Cluster Map — 主页结构保留。
 * 入口：屏底 4 圆形 cluster（早午晚零），当前 active cluster 居中放大显示 5 chip 圆周分布。
 *
 * 关键设计：
 * - cluster 空间布局 = spatial memory：用户记得"煎蛋在午餐时段下方"等位置感。
 * - tap 顶部 tab = 切换 active cluster。
 * - tap 圆周 chip = record。
 * - 长按 chip = swap 为同 cluster 未显示的下一个 preset。
 */
const BANDS: MealBand[] = ['morning', 'noon', 'evening', 'snack'];
const PER_CLUSTER = 5;
const CHIP_RADIUS = 92;
const LONG_PRESS_MS = 420;

export function ClusterContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const nowBand = useMemo(() => currentBand(), []);
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
          next[band] = presetsByBand(api.presets, band).slice(0, PER_CLUSTER).map((p) => p.id);
        }
      });
      return next;
    });
  }, [api.presets]);

  const counts = useMemo(() => {
    const c: Record<MealBand, number> = { morning: 0, noon: 0, evening: 0, snack: 0 };
    BANDS.forEach((b) => { c[b] = presetsByBand(api.presets, b).length; });
    return c;
  }, [api.presets]);

  const visibleIds = pinned[active] ?? [];
  const visibleChips: (UserMealPreset | null)[] = useMemo(() => {
    const list: (UserMealPreset | null)[] = [];
    for (let i = 0; i < PER_CLUSTER; i++) {
      const id = visibleIds[i];
      list.push(id ? api.presets.find((p) => p.id === id) ?? null : null);
    }
    return list;
  }, [visibleIds, api.presets]);

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
      setCreateOpen(true);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    await api.recordCustomPreset(chip);
  }

  // chip 位置（按圆周分布，从顶部开始）
  function chipPos(i: number) {
    const angle = (i / PER_CLUSTER) * 2 * Math.PI - Math.PI / 2;
    return { x: Math.cos(angle) * CHIP_RADIUS, y: Math.sin(angle) * CHIP_RADIUS };
  }

  return (
    <PrototypeShell title="6. Cluster Map">
      <RealHomeShell api={api} rightAction={null} />

      <div
        className="fixed left-0 right-0 z-[70] px-3 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="cluster-wrap pointer-events-auto">
          {/* mini tabs (4 cluster) */}
          <div className="cluster-tabs">
            {BANDS.map((band) => {
              const isActive = active === band;
              const isNow = band === nowBand;
              return (
                <button
                  key={band}
                  onClick={() => setActive(band)}
                  className={`cluster-tab ${isActive ? 'cluster-tab-active' : ''}`}
                >
                  <span className="cluster-tab-glyph">{BAND_LABEL[band]}</span>
                  <span className="cluster-tab-sub">{BAND_LABEL_EN[band]}</span>
                  <span className="cluster-tab-count tabular">{counts[band]}</span>
                  {!isActive && isNow && <span className="cluster-tab-now" aria-hidden />}
                </button>
              );
            })}
          </div>

          {/* main arena */}
          <div className="cluster-arena">
            {/* connecting lines SVG */}
            <svg className="cluster-lines" viewBox="-130 -130 260 260" aria-hidden>
              {visibleChips.map((_, i) => {
                const { x, y } = chipPos(i);
                return (
                  <line
                    key={`l-${i}`}
                    x1="0" y1="0"
                    x2={x} y2={y}
                    stroke="var(--color-hairline-strong)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity="0.5"
                  />
                );
              })}
              <circle cx="0" cy="0" r={CHIP_RADIUS} fill="none" stroke="var(--color-hairline)" strokeWidth="1" opacity="0.4" />
            </svg>

            {/* center glyph */}
            <div className="cluster-center">
              <span className="cluster-center-glyph">{BAND_LABEL[active]}</span>
              <span className="cluster-center-sub">{BAND_LABEL_EN[active]}</span>
              <span className="cluster-center-count tabular">{counts[active]}</span>
            </div>

            {/* chips around */}
            {visibleChips.map((chip, i) => {
              const { x, y } = chipPos(i);
              return (
                <button
                  key={`${active}-${i}`}
                  onClick={() => onChipClick(chip)}
                  onPointerDown={() => onChipPointerDown(i)}
                  onPointerUp={onChipPointerUp}
                  onPointerCancel={onChipPointerUp}
                  onPointerLeave={onChipPointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={api.recordingId != null}
                  className={`cluster-chip ${chip ? '' : 'cluster-chip-empty'} ${api.recordingId === chip?.id ? 'cluster-chip-loading' : ''}`}
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                  }}
                >
                  {chip ? (
                    <>
                      <span className="cluster-chip-name">{chip.name}</span>
                      <span className="cluster-chip-kcal tabular">{Math.round(chip.kcal)}</span>
                    </>
                  ) : (
                    <span className="cluster-chip-add">＋</span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="cluster-hint">tap = 記錄 · long-press = 換成另一個</p>
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
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">
              ＋ 新菜單 · {BAND_LABEL[active]} 時段
            </p>
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
.cluster-wrap {
  max-width: 480px;
  margin: 0 auto;
  background: rgba(20, 20, 26, 0.88);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 18px;
  padding: 8px 8px 6px;
  box-shadow:
    0 16px 40px -12px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.05) inset;
}

.cluster-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}
.cluster-tab {
  position: relative;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 0 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.16s;
  color: var(--color-text-3);
}
.cluster-tab-active {
  background: var(--color-accent);
  color: var(--color-accent-ink);
  border-color: var(--color-accent);
  box-shadow: 0 0 14px rgba(200,255,0,0.25);
}
.cluster-tab-glyph {
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
}
.cluster-tab-active .cluster-tab-glyph { font-weight: 700; }
.cluster-tab-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-top: 1px;
}
.cluster-tab-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  opacity: 0.65;
  margin-top: 0;
}
.cluster-tab-now {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 5px rgba(200,255,0,0.7);
}

.cluster-arena {
  position: relative;
  width: 100%;
  height: 260px;
  margin: 0 auto;
}
.cluster-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.cluster-center {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 78px; height: 78px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08) 0%, transparent 60%),
    rgba(36, 36, 44, 0.95);
  border: 1.5px solid var(--color-accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: var(--color-accent);
  box-shadow:
    0 0 0 4px rgba(200,255,0,0.10),
    0 0 24px rgba(200,255,0,0.18),
    inset 0 1px 0 rgba(255,255,255,0.06);
  pointer-events: none;
  z-index: 2;
}
.cluster-center-glyph {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.cluster-center-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.8;
  margin-top: 1px;
}
.cluster-center-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
  margin-top: 1px;
}

.cluster-chip {
  position: absolute;
  width: 64px; height: 64px;
  margin-left: -32px;
  margin-top: -32px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06) 0%, transparent 60%),
    var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 4px;
  cursor: pointer;
  transition: transform 0.14s, border-color 0.14s, background 0.14s;
  z-index: 3;
}
.cluster-chip:active {
  transform: scale(0.92);
  border-color: var(--color-accent);
  background: rgba(200,255,0,0.10);
}
.cluster-chip-loading {
  border-color: var(--color-accent);
  animation: ff-pulse-soft 1s ease-in-out infinite;
}
.cluster-chip-empty {
  background: transparent;
  border: 1.5px dashed var(--color-hairline-strong);
  color: var(--color-text-4);
}
.cluster-chip-empty:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.cluster-chip-add {
  font-size: 18px;
}
.cluster-chip-name {
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
.cluster-chip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--color-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.cluster-hint {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  color: var(--color-text-4);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  margin-top: 2px;
  margin-bottom: 2px;
}
`;
