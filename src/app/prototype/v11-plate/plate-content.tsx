'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';
import type { TodayMeal } from '@/components/today-meals';

/**
 * Plate Composition — 一日 = 一幅向日葵餐盘构图。
 * 每条 meal 一个 disc，按宏量混合染色，按 phyllotaxis（黄金角螺旋）布局。
 * preset 横向滚动条，点 preset → disc 从底部"飞入"盘里，落点是 phyllotaxis 下一个位置。
 * 长按盘内 disc → 删除。
 * 美学：浅金属圆盘 + lime/amber/purple 三色混合 + 微弱投影 / 玻璃光泽。
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.39996 rad ≈ 137.5°
const PHYLLO_SCALE = 18;

// 色彩系统：P=lime, C=amber, F=purple
function macroColor(p: number, c: number, f: number): string {
  const total = p + c + f || 1;
  const r = (200 * p + 245 * c + 122 * f) / total;
  const g = (255 * p + 166 * c + 77 * f) / total;
  const b = (0 * p + 35 * c + 219 * f) / total;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
function macroLabel(p: number, c: number, f: number): string {
  if (p + c + f === 0) return '·';
  const max = Math.max(p, c, f);
  if (max === p) return 'P';
  if (max === c) return 'C';
  return 'F';
}
function discSize(kcal: number) {
  // 50 kcal → 22px, 700 kcal → 56px
  return Math.max(20, Math.min(58, 18 + Math.sqrt(kcal / 1.2)));
}

export function PlateContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const orderedMeals = [...api.meals].sort(
    (a, b) => new Date(a.ate_at).getTime() - new Date(b.ate_at).getTime(),
  );

  // 给每条 meal 算一个 phyllotaxis 位置
  const placedDiscs = useMemo(() => {
    return orderedMeals.map((m, i) => {
      const angle = i * GOLDEN_ANGLE;
      const r = PHYLLO_SCALE * Math.sqrt(i);
      return {
        meal: m,
        x: r * Math.cos(angle),
        y: r * Math.sin(angle),
        size: discSize(m.kcal ?? 100),
        color: macroColor(m.protein_g ?? 0, m.carb_g ?? 0, m.fat_g ?? 0),
        label: macroLabel(m.protein_g ?? 0, m.carb_g ?? 0, m.fat_g ?? 0),
      };
    });
  }, [orderedMeals]);

  const subtotal = Math.round(api.consumed.kcal);
  const target = Math.round(api.targets.kcal);
  const pct = Math.min(100, (subtotal / Math.max(1, target)) * 100);

  // 宏量总占比（饼图分布）
  const macroSum = orderedMeals.reduce(
    (acc, m) => ({
      p: acc.p + (m.protein_g ?? 0),
      c: acc.c + (m.carb_g ?? 0),
      f: acc.f + (m.fat_g ?? 0),
    }),
    { p: 0, c: 0, f: 0 },
  );

  function startLongPress(id: string) {
    if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setDeletingId(id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    }, 450);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  async function pickPreset(p: UserMealPreset) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
    await api.recordCustomPreset(p);
  }

  return (
    <PrototypeShell title="6. Plate Composition">
      <div
        className="h-full bg-ink flex flex-col relative overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04) 0%, transparent 55%)',
        }}
      >
        <header
          className="flex-shrink-0 px-5 pt-3 pb-1 flex items-center justify-between relative z-10"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="ml-16">
            <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">composition</p>
            <p className="display-roman text-[20px] leading-none mt-0.5">today&rsquo;s plate</p>
          </div>
          <p className="text-[10px] font-mono text-text-3 uppercase tracking-wider">
            <span className="text-accent tabular">{orderedMeals.length}</span>
            <span className="ml-0.5">discs</span>
          </p>
        </header>

        {/* 顶部 progress + macro bar */}
        <div className="px-5 pb-2 relative z-10">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-3">today</p>
            <p className="text-[12px] font-mono tabular">
              <span className="text-accent">{subtotal}</span>
              <span className="mx-1 text-text-3">/</span>
              <span className="text-text-2">{target}</span>
            </p>
          </div>
          <div className="h-[3px] bg-surface-2 overflow-hidden">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <MacroBar p={macroSum.p} c={macroSum.c} f={macroSum.f} />
        </div>

        {/* 大圆盘 */}
        <div className="flex-1 flex items-center justify-center relative z-10 px-5">
          <Plate discs={placedDiscs} onLongPressStart={startLongPress} onLongPressEnd={cancelLongPress} empty={orderedMeals.length === 0} />
        </div>

        {/* 底部 preset 横向滚动 */}
        <PresetRail
          presets={api.presets}
          onPick={pickPreset}
          onCreate={() => { api.clearDuplicate(); setCreateOpen(true); }}
          busyId={api.recordingId}
        />
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center"
          style={{ animation: 'ff-fade-in 0.2s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div
            className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">＋ NEW DISC</p>
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

      <InlineConfirmDialog
        open={deletingId != null}
        title="從盤中移除？"
        body={deletingId ? <span>這個 disc 將從構圖中移除，記錄也會被刪除。</span> : null}
        confirmText="移除"
        variant="danger"
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (deletingId) {
            try {
              await fetch(`/api/meals/${deletingId}`, { method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' } });
              api.onMealDeleted(deletingId);
            } catch {}
          }
          setDeletingId(null);
        }}
      />
    </PrototypeShell>
  );
}

function MacroBar({ p, c, f }: { p: number; c: number; f: number }) {
  const total = p + c + f;
  if (total === 0) {
    return (
      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-4 mt-2">
        macro · empty
      </p>
    );
  }
  const pp = (p / total) * 100;
  const pc = (c / total) * 100;
  const pf = (f / total) * 100;
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-[6px] flex overflow-hidden">
        <div style={{ width: `${pp}%`, background: '#c8ff00' }} />
        <div style={{ width: `${pc}%`, background: '#f5a623' }} />
        <div style={{ width: `${pf}%`, background: '#7a4ddb' }} />
      </div>
      <p className="text-[9px] font-mono uppercase tracking-wider text-text-3 tabular shrink-0">
        <span style={{ color: '#c8ff00' }}>{Math.round(p)}P</span>
        <span className="mx-1.5 text-text-4">·</span>
        <span style={{ color: '#f5a623' }}>{Math.round(c)}C</span>
        <span className="mx-1.5 text-text-4">·</span>
        <span style={{ color: '#7a4ddb' }}>{Math.round(f)}F</span>
      </p>
    </div>
  );
}

function Plate({
  discs, onLongPressStart, onLongPressEnd, empty,
}: {
  discs: { meal: TodayMeal; x: number; y: number; size: number; color: string; label: string }[];
  onLongPressStart: (id: string) => void;
  onLongPressEnd: () => void;
  empty: boolean;
}) {
  return (
    <div className="plate-wrap">
      <div className="plate">
        <div className="plate-inner">
          {empty && (
            <p className="absolute inset-0 flex items-center justify-center text-[11px] font-mono uppercase tracking-[0.3em] text-text-4 text-center px-8">
              empty plate · pick from the rail ↓
            </p>
          )}
          {discs.map((d, i) => (
            <button
              key={d.meal.id}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={() => onLongPressStart(d.meal.id)}
              onPointerUp={onLongPressEnd}
              onPointerCancel={onLongPressEnd}
              onPointerLeave={onLongPressEnd}
              className="disc"
              style={{
                left: `calc(50% + ${d.x}px - ${d.size / 2}px)`,
                top: `calc(50% + ${d.y}px - ${d.size / 2}px)`,
                width: d.size,
                height: d.size,
                background: d.color,
                animation: i === discs.length - 1
                  ? `disc-land 0.6s var(--ease-spring) both`
                  : `disc-fade-in 0.5s var(--ease-out-soft) ${i * 50}ms both`,
                zIndex: i + 1,
              }}
              aria-label={`${d.meal.dish_name ?? '—'} ${Math.round(d.meal.kcal ?? 0)} kcal`}
            >
              {d.size >= 28 && (
                <span className="disc-label" style={{ color: 'rgba(10,10,12,0.6)' }}>
                  {d.label}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <style>{plateStyles}</style>
    </div>
  );
}

function PresetRail({
  presets, onPick, onCreate, busyId,
}: {
  presets: UserMealPreset[];
  onPick: (p: UserMealPreset) => void;
  onCreate: () => void;
  busyId: string | null;
}) {
  return (
    <div
      className="flex-shrink-0 relative z-10 border-t border-hairline bg-ink-2 px-3 pt-2.5"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="flex items-center justify-between mb-1.5 px-2">
        <p className="text-[10px] uppercase tracking-[0.24em] text-text-3 font-mono">preset rail</p>
        <p className="text-[9px] font-mono text-text-4 uppercase tracking-wider">tap to place</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {presets.map((p) => {
          const color = macroColor(p.protein_g ?? 0, p.carb_g ?? 0, p.fat_g ?? 0);
          return (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              disabled={busyId != null}
              className="shrink-0 bg-surface border border-hairline hover:border-accent/60 active:scale-95 transition-all px-2.5 py-2 text-left flex items-center gap-2 disabled:opacity-50"
            >
              <span
                className="block w-3.5 h-3.5 shrink-0"
                style={{ background: color, borderRadius: 999, boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
              />
              <span>
                <span className="block text-[11px] font-medium text-text truncate max-w-[100px]">{p.name}</span>
                <span className="block text-[10px] font-mono text-text-3 tabular">{Math.round(p.kcal)} kcal</span>
              </span>
            </button>
          );
        })}
        <button
          onClick={onCreate}
          className="shrink-0 bg-surface border-2 border-dashed border-hairline-strong text-text-3 hover:text-accent hover:border-accent/60 active:scale-95 transition-all px-3 py-2 text-[11px] font-mono uppercase tracking-wider"
        >
          ＋ new
        </button>
      </div>
    </div>
  );
}

const plateStyles = `
.plate-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.plate {
  position: relative;
  width: min(320px, 90vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06) 0%, transparent 35%),
    radial-gradient(circle at 70% 80%, rgba(255,255,255,0.02) 0%, transparent 40%),
    conic-gradient(from 0deg, #18181d 0deg, #1f1f25 90deg, #18181d 180deg, #1f1f25 270deg, #18181d 360deg);
  box-shadow:
    0 30px 80px -20px rgba(0,0,0,0.9),
    0 1px 0 rgba(255,255,255,0.06) inset,
    0 -2px 4px rgba(0,0,0,0.4) inset;
  padding: 8px;
}
.plate::before {
  /* 外圈金属环 */
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: conic-gradient(from 90deg, #444, #222, #555, #1a1a1a, #444);
  z-index: -1;
}
.plate-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, rgba(255,255,255,0.04) 0%, transparent 50%),
    #0e0e12;
  overflow: hidden;
  box-shadow: inset 0 4px 14px rgba(0,0,0,0.7);
}
.disc {
  position: absolute;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.4) inset,
    0 -1px 1px rgba(0,0,0,0.2) inset,
    0 3px 6px rgba(0,0,0,0.4);
  transition: transform 0.18s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.disc:active { transform: scale(0.92); }
.disc-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
  user-select: none;
}

@keyframes disc-fade-in {
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes disc-land {
  0%   { opacity: 0; transform: translateY(140px) scale(0.4); }
  60%  { opacity: 1; transform: translateY(-6px)  scale(1.12); }
  78%  { transform: translateY(2px) scale(0.96); }
  100% { transform: translateY(0)   scale(1); }
}
`;
