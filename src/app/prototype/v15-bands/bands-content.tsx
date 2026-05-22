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
 * Time Bands — 主页结构保留。
 * 入口：屏底 4 行时段带（早午晚零并列），每行 3 chip 永远暴露。
 *
 * 关键设计：
 * - 一屏看到 12 个候选（4 band × 3 chip）。
 * - 当前时段那一行整行 lime 高亮。
 * - 长按 chip = swap 为同 band 未显示的下一个 preset。
 */
const BANDS: MealBand[] = ['morning', 'noon', 'evening', 'snack'];
const PER_BAND = 3;
const LONG_PRESS_MS = 420;

export function BandsContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [pinned, setPinned] = useState<Record<MealBand, string[]>>({
    morning: [], noon: [], evening: [], snack: [],
  });
  const [createOpen, setCreateOpen] = useState<MealBand | null>(null);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const nowBand = useMemo(() => currentBand(), []);

  // init pinned: 每个 band 前 3 个
  useEffect(() => {
    if (api.presets.length === 0) return;
    setPinned((prev) => {
      const next = { ...prev };
      BANDS.forEach((band) => {
        if (next[band].length === 0) {
          const inBand = presetsByBand(api.presets, band).slice(0, PER_BAND).map((p) => p.id);
          // 如果某 band 没有 preset，填空位
          next[band] = inBand.length > 0 ? inBand : [];
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
  function onChipPointerUp() {
    clearTimer();
  }
  async function onChipClick(chip: UserMealPreset | null, band: MealBand) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (!chip) {
      api.clearDuplicate();
      setCreateOpen(band);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    await api.recordCustomPreset(chip);
  }

  return (
    <PrototypeShell title="5. Time Bands">
      <RealHomeShell api={api} rightAction={null} />

      <div
        className="fixed left-0 right-0 z-[70] px-3 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="bands-wrap pointer-events-auto">
          <div className="bands-header">
            <span className="bands-tag">時段直選 · long-press 換</span>
            <span className="bands-now tabular">
              now · <span className="text-accent">{BAND_LABEL[nowBand]}</span>
            </span>
          </div>
          {BANDS.map((band) => {
            const ids = pinned[band] ?? [];
            const slots: (UserMealPreset | null)[] = [];
            for (let i = 0; i < PER_BAND; i++) {
              const id = ids[i];
              slots.push(id ? api.presets.find((p) => p.id === id) ?? null : null);
            }
            const isNow = band === nowBand;
            return (
              <div key={band} className={`band-row ${isNow ? 'band-row-now' : ''}`}>
                <div className="band-label">
                  <span className="band-glyph">{BAND_LABEL[band]}</span>
                  <span className="band-en">{BAND_LABEL_EN[band]}</span>
                  <span className="band-count tabular">{counts[band]}</span>
                </div>
                <div className="band-chips">
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
                      className={`band-chip ${chip ? '' : 'band-chip-empty'} ${api.recordingId === chip?.id ? 'band-chip-loading' : ''}`}
                    >
                      {chip ? (
                        <>
                          <span className="band-chip-name">{chip.name}</span>
                          <span className="band-chip-kcal tabular">{Math.round(chip.kcal)}</span>
                        </>
                      ) : (
                        <span className="band-chip-add">＋</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
.bands-wrap {
  max-width: 480px;
  margin: 0 auto;
  background: rgba(20, 20, 26, 0.88);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 16px;
  padding: 8px 10px 8px;
  box-shadow:
    0 16px 40px -12px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.05) inset;
}

.bands-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px 6px;
  border-bottom: 1px solid var(--color-hairline);
  margin-bottom: 6px;
}
.bands-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-text-3);
  text-transform: lowercase;
  letter-spacing: 0.06em;
}
.bands-now {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.band-row {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 6px;
  padding: 4px 2px;
  border-radius: 8px;
  transition: background 0.2s;
}
.band-row-now {
  background: rgba(200, 255, 0, 0.06);
  border: 1px solid rgba(200, 255, 0, 0.28);
  margin: -1px -1px;
}
.band-row:not(:last-child) { margin-bottom: 2px; }

.band-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 4px 0;
  color: var(--color-text-3);
}
.band-row-now .band-label { color: var(--color-accent); }
.band-glyph {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}
.band-row-now .band-glyph { font-weight: 700; }
.band-en {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-top: 1px;
}
.band-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  opacity: 0.55;
  margin-top: 1px;
}

.band-chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.band-chip {
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 9px;
  height: 46px;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  transition: transform 0.14s, border-color 0.14s, background 0.14s;
  min-width: 0;
}
.band-row-now .band-chip {
  background: rgba(28, 28, 34, 0.95);
  border-color: rgba(200, 255, 0, 0.25);
}
.band-chip:active {
  transform: scale(0.93);
  border-color: var(--color-accent);
  background: rgba(200,255,0,0.10);
}
.band-chip-loading {
  border-color: var(--color-accent);
  animation: ff-pulse-soft 1s ease-in-out infinite;
}
.band-chip-empty {
  background: transparent;
  border: 1.5px dashed var(--color-hairline-strong);
  color: var(--color-text-4);
}
.band-chip-empty:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.band-chip-add {
  font-size: 15px;
}
.band-chip-name {
  font-size: 11px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  line-height: 1.15;
}
.band-chip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--color-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
`;
