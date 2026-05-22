'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import { PresetDialSheet, pickAIRecommended } from '../_lib/preset-dial-sheet';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Smart Tray — 主页结构保留。
 * 入口：屏底常驻 3 chip rail + ⋯ 按钮。
 *
 * 设计原则：
 * - 3 chip = AI 智能推荐（按时间挑），tap 直接 record，零拉起。
 * - 长按 chip / ⋯ 按钮 → 拉起 PresetDialSheet（翻牌 + 搜索看全部）。
 * - 找特定 preset 不靠 grid 滚动，靠翻牌 + 搜索。
 */
export function TrayContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [dialOpen, setDialOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const recommended = useMemo(() => pickAIRecommended(api.presets), [api.presets]);
  const subtotal = Math.round(api.consumed.kcal);
  const target = Math.round(api.targets.kcal);

  function startLongPress() {
    longPressFiredRef.current = false;
    if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setDialOpen(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 420);
  }
  function cancelLongPress() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  async function chipClick(p: UserMealPreset) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([8, 30, 8]);
    await api.recordCustomPreset(p);
  }

  return (
    <PrototypeShell title="6. Smart Tray">
      <RealHomeShell api={api} rightAction={null} />

      {/* 屏底 tray */}
      <div
        className="fixed left-0 right-0 z-[70] px-3 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="tray pointer-events-auto">
          <div className="tray-header">
            <span className="tray-tag">
              <span className="tray-dot" /> 智能推薦
            </span>
            <span className="tray-meta tabular">
              <span className="text-accent">{subtotal}</span>
              <span className="opacity-50 mx-0.5">/</span>
              {target}
              <span className="opacity-60 ml-1">kcal</span>
            </span>
          </div>
          <div className="tray-chips">
            {recommended.length === 0 ? (
              <button
                onClick={() => { api.clearDuplicate(); setCreateOpen(true); }}
                className="tray-chip-empty"
              >
                ＋ 建立第一個 preset
              </button>
            ) : (
              <>
                {recommended.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => chipClick(p)}
                    onPointerDown={startLongPress}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={api.recordingId != null}
                    className={`tray-chip ${api.recordingId === p.id ? 'tray-chip-loading' : ''}`}
                  >
                    <span className="tray-chip-name">{p.name}</span>
                    <span className="tray-chip-kcal tabular">{Math.round(p.kcal)}</span>
                  </button>
                ))}
                <button
                  onClick={() => setDialOpen(true)}
                  className="tray-more"
                  aria-label={`view all ${api.presets.length}`}
                >
                  <span className="tray-more-dots">⋯</span>
                  <span className="tray-more-count tabular">{api.presets.length}</span>
                </button>
              </>
            )}
          </div>
          <p className="tray-hint">tap = 記錄 · long-press / ⋯ = 全部翻牌</p>
        </div>
      </div>

      {dialOpen && (
        <PresetDialSheet
          presets={api.presets}
          recordingId={api.recordingId}
          aiRecommended={recommended}
          headerTagline="all presets · flip · search"
          onPick={async (p) => { await api.recordCustomPreset(p); setDialOpen(false); }}
          onCreate={() => { api.clearDuplicate(); setDialOpen(false); setCreateOpen(true); }}
          onClose={() => setDialOpen(false)}
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

const styles = `
.tray {
  max-width: 480px;
  margin: 0 auto;
  background: rgba(20, 20, 26, 0.85);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 14px;
  padding: 10px 12px 8px;
  box-shadow:
    0 14px 36px -10px rgba(0,0,0,0.7),
    0 1px 0 rgba(255,255,255,0.04) inset;
}

.tray-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.tray-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  color: var(--color-accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tray-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(200,255,0,0.7);
  animation: ff-pulse-soft 1.8s ease-in-out infinite;
}
.tray-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
}

.tray-chips {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 6px;
}

.tray-chip {
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  padding: 8px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
  cursor: pointer;
  min-width: 0;
}
.tray-chip:active {
  transform: scale(0.95);
  border-color: var(--color-accent);
  background: rgba(200,255,0,0.10);
}
.tray-chip:disabled { opacity: 0.5; }
.tray-chip-loading {
  border-color: var(--color-accent);
  animation: ff-pulse-soft 1s ease-in-out infinite;
}
.tray-chip-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.tray-chip-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.tray-chip-empty {
  grid-column: 1 / -1;
  height: 56px;
  background: transparent;
  border: 1.5px dashed var(--color-hairline-strong);
  border-radius: 10px;
  color: var(--color-text-3);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
}
.tray-chip-empty:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.tray-more {
  background: var(--color-surface-2);
  border: 1px solid var(--color-hairline);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, background 0.15s;
  color: var(--color-text-2);
}
.tray-more:active {
  transform: scale(0.92);
  border-color: var(--color-accent);
  background: rgba(200,255,0,0.10);
  color: var(--color-accent);
}
.tray-more-dots {
  font-size: 14px;
  letter-spacing: 0.05em;
  font-weight: 700;
  line-height: 1;
}
.tray-more-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
}

.tray-hint {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px;
  color: var(--color-text-4);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  margin-top: 6px;
}
`;
