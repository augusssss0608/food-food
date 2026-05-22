'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Apothecary Counter — 主烧瓶按宏量分层显示一日吸收。
 * 长按试管 → 试管倾倒动画 + 液流飞入烧瓶 + 液面上升。
 * 美学：实验室白瓷台 + 玻璃高光 + 黄铜刻度 + lime/amber/purple 三色液体。
 */

const FAT_COLOR = '#7a4ddb';
const CARB_COLOR = '#f5a623';
const PROT_COLOR = '#c8ff00';

function presetTubeColor(p: number, c: number, f: number) {
  const total = p + c + f || 1;
  // 主导色为主，混合次色
  const r = (200 * p + 245 * c + 122 * f) / total;
  const g = (255 * p + 166 * c + 77 * f) / total;
  const b = (0 * p + 35 * c + 219 * f) / total;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function ApothecaryContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [createOpen, setCreateOpen] = useState(false);
  const [pouringId, setPouringId] = useState<string | null>(null);
  const [waveTick, setWaveTick] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  // 烧瓶液面波纹随时间动
  useEffect(() => {
    const t = setInterval(() => setWaveTick((v) => v + 1), 100);
    return () => clearInterval(t);
  }, []);

  const target = Math.max(1, api.targets.kcal);
  const subtotal = api.consumed.kcal;
  const fillPct = Math.min(100, (subtotal / target) * 100);

  const macroSum = api.meals.reduce(
    (acc, m) => ({
      p: acc.p + (m.protein_g ?? 0),
      c: acc.c + (m.carb_g ?? 0),
      f: acc.f + (m.fat_g ?? 0),
    }),
    { p: 0, c: 0, f: 0 },
  );
  const macroTotal = macroSum.p + macroSum.c + macroSum.f || 1;

  // 液体分层高度（基于 fillPct 总体高度，再按宏量分层）
  const layerFat = fillPct * (macroSum.f / macroTotal);
  const layerCarb = fillPct * (macroSum.c / macroTotal);
  const layerProt = fillPct * (macroSum.p / macroTotal);

  function startLongPressPour(preset: UserMealPreset) {
    cancelLongPressPour();
    longPressTimerRef.current = window.setTimeout(() => {
      doPour(preset);
    }, 400);
  }
  function cancelLongPressPour() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  async function doPour(preset: UserMealPreset) {
    setPouringId(preset.id);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([12, 40, 8]);
    // 闪一下烧瓶液面
    if (flashRef.current) {
      flashRef.current.classList.remove('flask-flash');
      void flashRef.current.offsetWidth;
      flashRef.current.classList.add('flask-flash');
    }
    await api.recordCustomPreset(preset);
    setTimeout(() => setPouringId(null), 700);
  }

  return (
    <PrototypeShell title="7. Apothecary Counter">
      <div
        className="h-full bg-ink flex flex-col relative overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 100% 70% at 50% 25%, rgba(200, 255, 0, 0.04) 0%, transparent 50%)',
        }}
      >
        <header
          className="flex-shrink-0 px-5 pt-3 pb-2 flex items-center justify-between relative z-10"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="ml-16">
            <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">formula</p>
            <p className="display-roman text-[18px] leading-none mt-0.5">{api.todayDate}</p>
          </div>
          <p className="text-[9px] font-mono uppercase tracking-[0.24em] text-text-3">
            CCXXVI · lab
          </p>
        </header>

        <div className="px-5 pb-1 relative z-10">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[9px] font-mono uppercase tracking-[0.24em] text-text-3">
              total titration
            </p>
            <p className="text-[10px] font-mono tabular text-text-3">
              <span className="text-accent">{Math.round(subtotal)}</span>
              <span className="mx-1">/</span>
              <span>{Math.round(target)}</span>
              <span className="ml-1">ml·kcal</span>
            </p>
          </div>
        </div>

        {/* 主烧瓶 */}
        <div className="flex-1 flex items-center justify-center relative z-10 px-5">
          <Flask
            fat={layerFat}
            carb={layerCarb}
            prot={layerProt}
            macros={macroSum}
            waveTick={waveTick}
            flashRef={flashRef}
          />
        </div>

        {/* 试管架 */}
        <TubeRack
          presets={api.presets}
          pouringId={pouringId}
          onStartPour={startLongPressPour}
          onCancelPour={cancelLongPressPour}
          onCreate={() => { api.clearDuplicate(); setCreateOpen(true); }}
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
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">＋ NEW REAGENT</p>
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

function Flask({
  fat, carb, prot, macros, waveTick, flashRef,
}: {
  fat: number; carb: number; prot: number;
  macros: { p: number; c: number; f: number };
  waveTick: number;
  flashRef: React.RefObject<HTMLDivElement | null>;
}) {
  const sway = Math.sin(waveTick / 5) * 0.6;
  const totalFill = fat + carb + prot;

  return (
    <div className="flask-wrap">
      {/* 刻度线 */}
      <div className="flask-scale" aria-hidden>
        {[100, 75, 50, 25].map((v) => (
          <div key={v} className="flask-scale-row">
            <span className="flask-scale-tick" />
            <span className="flask-scale-label">{v}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox="0 0 160 220"
        className="flask-svg"
        aria-label="dosing flask"
      >
        <defs>
          <clipPath id="flask-inner-clip">
            {/* 内部 cavity */}
            <path d="
              M 65 18 L 95 18
              L 95 55
              L 145 195
              L 145 205
              L 15 205
              L 15 195
              L 65 55
              Z
            " />
          </clipPath>
          <linearGradient id="glass-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.45)" />
          </linearGradient>
        </defs>

        {/* 液体层（clipped 在 flask 内部） */}
        <g clipPath="url(#flask-inner-clip)">
          {/* fat 层（底） */}
          <rect x="0" y={205 - fat * 1.85} width="160" height={fat * 1.85} fill={FAT_COLOR} opacity="0.92" />
          {/* carb 层 */}
          <rect x="0" y={205 - (fat + carb) * 1.85} width="160" height={carb * 1.85} fill={CARB_COLOR} opacity="0.92" />
          {/* protein 层（顶） */}
          <rect x="0" y={205 - (fat + carb + prot) * 1.85} width="160" height={prot * 1.85} fill={PROT_COLOR} opacity="0.92" />

          {/* 液面波纹（最顶层 wave） */}
          {totalFill > 0 && (
            <path
              d={`
                M 0 ${205 - totalFill * 1.85}
                Q 40 ${205 - totalFill * 1.85 + sway - 3} 80 ${205 - totalFill * 1.85 + sway}
                T 160 ${205 - totalFill * 1.85}
                L 160 ${205 - totalFill * 1.85 + 8}
                L 0 ${205 - totalFill * 1.85 + 8}
                Z
              `}
              fill="rgba(255,255,255,0.18)"
            />
          )}
          {/* 玻璃高光 */}
          <path
            d="M 25 50 L 32 50 L 75 195 L 68 195 Z"
            fill="rgba(255,255,255,0.15)"
          />
          <path
            d="M 130 80 L 134 80 L 138 130 L 134 130 Z"
            fill="rgba(255,255,255,0.08)"
          />
        </g>

        {/* 烧瓶外轮廓 */}
        <path
          d="
            M 65 18 L 95 18
            L 95 55
            L 145 195
            L 145 205
            L 15 205
            L 15 195
            L 65 55
            Z
          "
          fill="none"
          stroke="url(#glass-edge)"
          strokeWidth="2"
        />
        {/* 瓶口 */}
        <rect x="60" y="13" width="40" height="6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" rx="1" />
        {/* 瓶口标签 */}
        <text x="80" y="9" textAnchor="middle" fontSize="6" fill="rgba(200,200,210,0.8)" fontFamily="JetBrains Mono, monospace" letterSpacing="0.3">
          ERLENMEYER · 500mL
        </text>
      </svg>

      <div ref={flashRef} className="flask-flash-layer" aria-hidden />

      {/* 主烧瓶下方读数 */}
      <div className="flask-readout">
        <div className="flask-readout-row">
          <span className="flask-readout-swatch" style={{ background: PROT_COLOR }} />
          <span>protein</span>
          <span className="tabular">{Math.round(macros.p)}g</span>
        </div>
        <div className="flask-readout-row">
          <span className="flask-readout-swatch" style={{ background: CARB_COLOR }} />
          <span>carb</span>
          <span className="tabular">{Math.round(macros.c)}g</span>
        </div>
        <div className="flask-readout-row">
          <span className="flask-readout-swatch" style={{ background: FAT_COLOR }} />
          <span>fat</span>
          <span className="tabular">{Math.round(macros.f)}g</span>
        </div>
      </div>
    </div>
  );
}

function TubeRack({
  presets, pouringId, onStartPour, onCancelPour, onCreate,
}: {
  presets: UserMealPreset[];
  pouringId: string | null;
  onStartPour: (p: UserMealPreset) => void;
  onCancelPour: () => void;
  onCreate: () => void;
}) {
  return (
    <div
      className="flex-shrink-0 relative z-10 border-t border-hairline bg-ink-2 pt-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <div className="flex items-center justify-between px-5 mb-2">
        <p className="text-[10px] uppercase tracking-[0.24em] text-text-3 font-mono">reagent rack</p>
        <p className="text-[9px] font-mono text-text-4 uppercase tracking-wider">
          HOLD to pour
        </p>
      </div>
      <div className="overflow-x-auto px-4" style={{ scrollbarWidth: 'none' }}>
        <div className="tube-rack-bar" />
        <div className="flex gap-3 pb-2 pt-1 items-end">
          {presets.map((p) => {
            const color = presetTubeColor(p.protein_g ?? 0, p.carb_g ?? 0, p.fat_g ?? 0);
            return (
              <button
                key={p.id}
                onPointerDown={() => onStartPour(p)}
                onPointerUp={onCancelPour}
                onPointerCancel={onCancelPour}
                onPointerLeave={onCancelPour}
                onContextMenu={(e) => e.preventDefault()}
                disabled={pouringId != null && pouringId !== p.id}
                aria-label={`pour ${p.name}`}
                className={`tube-btn ${pouringId === p.id ? 'tube-pouring' : ''}`}
              >
                <span className="tube-glass">
                  <span className="tube-liquid" style={{ background: color }} />
                  <span className="tube-shine" />
                </span>
                <span className="tube-label">
                  <span className="tube-name">{p.name}</span>
                  <span className="tube-kcal tabular">{Math.round(p.kcal)}</span>
                </span>
              </button>
            );
          })}
          <button onClick={onCreate} className="tube-add" aria-label="new reagent">
            <span className="tube-add-cap">＋</span>
            <span className="tube-label">
              <span className="tube-name opacity-60">new</span>
              <span className="tube-kcal opacity-40 tabular">··</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
.flask-wrap {
  position: relative;
  width: min(280px, 75vw);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.flask-svg {
  width: 100%;
  height: auto;
  display: block;
  filter: drop-shadow(0 18px 30px rgba(0,0,0,0.6));
}
.flask-scale {
  position: absolute;
  top: 12%;
  right: -28px;
  bottom: 18%;
  width: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.flask-scale-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.flask-scale-tick {
  display: block;
  width: 8px;
  height: 1px;
  background: rgba(180, 160, 100, 0.55); /* 黄铜色 */
}
.flask-scale-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: rgba(180, 160, 100, 0.65);
  letter-spacing: 0.05em;
}
.flask-flash-layer {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 60%, rgba(200,255,0,0.6) 0%, transparent 60%);
  opacity: 0;
  pointer-events: none;
  mix-blend-mode: screen;
}
.flask-flash {
  animation: flash-in 0.5s ease-out both;
}
@keyframes flash-in {
  0% { opacity: 0; }
  30% { opacity: 1; }
  100% { opacity: 0; }
}

.flask-readout {
  margin-top: 12px;
  width: 200px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-text-2);
}
.flask-readout-row {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  border-bottom: 1px dashed var(--color-hairline);
}
.flask-readout-row:last-child { border-bottom: none; }
.flask-readout-swatch {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.15);
}

/* 试管架 */
.tube-rack-bar {
  height: 4px;
  background:
    linear-gradient(180deg, rgba(180,160,100,0.35) 0%, rgba(120,100,60,0.6) 100%);
  margin: 0 8px 8px;
  border-radius: 2px;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.1) inset,
    0 2px 4px rgba(0,0,0,0.4);
}
.tube-btn {
  position: relative;
  background: none;
  border: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transform-origin: top center;
  transition: transform 0.4s var(--ease-spring);
}
.tube-pouring {
  transform: rotate(-58deg) translate(8px, -22px);
}
.tube-glass {
  position: relative;
  width: 22px;
  height: 90px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.12) 100%);
  border: 1px solid rgba(255,255,255,0.18);
  border-bottom-left-radius: 11px;
  border-bottom-right-radius: 11px;
  overflow: hidden;
  box-shadow:
    0 2px 6px rgba(0,0,0,0.4),
    inset 0 0 8px rgba(255,255,255,0.04);
}
.tube-liquid {
  position: absolute;
  left: 1px;
  right: 1px;
  bottom: 1px;
  height: 62%;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.4) inset,
    0 -1px 2px rgba(0,0,0,0.25) inset;
}
.tube-shine {
  position: absolute;
  left: 3px;
  top: 4px;
  width: 2px;
  height: 70%;
  background: rgba(255,255,255,0.55);
  border-radius: 1px;
}
.tube-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 50px;
  text-align: center;
}
.tube-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  color: var(--color-text-2);
  text-transform: lowercase;
  letter-spacing: 0.02em;
  max-width: 50px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tube-kcal {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}
.tube-btn:disabled { opacity: 0.4; }

.tube-add {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.tube-add-cap {
  width: 22px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  color: var(--color-text-3);
  border: 1.5px dashed var(--color-hairline-strong);
  border-bottom-left-radius: 11px;
  border-bottom-right-radius: 11px;
}
.tube-add:hover .tube-add-cap {
  color: var(--color-accent);
  border-color: rgba(200, 255, 0, 0.5);
}
`;
