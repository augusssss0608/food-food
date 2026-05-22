'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Thermal Receipt — 整屏一张"被照亮的实体小票"。
 * 新增 = 点 NEXT ORDER → 抽屉选 preset → 那一行 typewriter 印出来。
 * 美学：暖白小票纸 #f3ede0 + JetBrains Mono + lime 印章戳 + zigzag 撕纸边。
 */
export function ReceiptContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [printingPreset, setPrintingPreset] = useState<UserMealPreset | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedMeals = [...api.meals].sort(
    (a, b) => new Date(a.ate_at).getTime() - new Date(b.ate_at).getTime(),
  );

  const subtotal = Math.round(api.consumed.kcal);
  const target = Math.round(api.targets.kcal);
  const remain = Math.max(0, target - subtotal);
  const pct = Math.min(100, (subtotal / Math.max(1, target)) * 100);

  function fmtTime(s: string) {
    const d = new Date(s);
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: api.timezone,
    });
  }
  function nowHM() {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: api.timezone,
    });
  }
  const dateOrderId = api.todayDate.replaceAll('-', '');

  async function selectPreset(p: UserMealPreset) {
    setDrawerOpen(false);
    setPrintingPreset(p);
    // 让 "printing row" 显示 + scroll 到底部
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
    const ok = await api.recordCustomPreset(p);
    // 让 typewriter 动画播完（~600ms）再清除占位
    setTimeout(() => setPrintingPreset(null), ok ? 700 : 300);
  }

  return (
    <PrototypeShell title="4. Thermal Receipt">
      <div
        className="h-full bg-ink flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-12 pb-4">
          <div className="receipt-paper mx-auto" style={{ maxWidth: 360 }}>
            <ZigzagEdge position="top" />
            <div className="receipt-body">
              <ReceiptHeader date={api.todayDate} dateOrderId={dateOrderId} timezone={api.timezone} isWorkout={!!api.isWorkoutDay} />
              <Dashes />
              <ColHeader />
              <Dashes spaced />
              {sortedMeals.length === 0 && !printingPreset && (
                <p className="receipt-row text-center opacity-60">··· no orders yet ···</p>
              )}
              {sortedMeals.map((m) => (
                <MealRow
                  key={m.id}
                  time={fmtTime(m.ate_at)}
                  name={m.dish_name ?? '—'}
                  kcal={Math.round(m.kcal ?? 0)}
                />
              ))}
              {printingPreset && (
                <PrintingRow
                  time={nowHM()}
                  name={printingPreset.name}
                  kcal={Math.round(printingPreset.kcal)}
                />
              )}
              <Dashes spaced />
              <SubtotalBlock subtotal={subtotal} target={target} remain={remain} pct={pct} />
              <Dashes />
              <ThankYouStamp />
              <Dashes />
              <Footer />
            </div>
            <ZigzagEdge position="bottom" />
          </div>
        </div>

        <div
          className="px-4 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            disabled={api.recordingId != null}
            className="w-full max-w-[360px] mx-auto h-12 bg-accent text-accent-ink font-mono uppercase tracking-[0.22em] text-[11px] font-semibold active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span aria-hidden>▼</span>
            <span>{api.recordingId ? 'Printing…' : 'Next Order'}</span>
            <span aria-hidden>▼</span>
          </button>
        </div>
      </div>

      {drawerOpen && (
        <PresetDrawer
          presets={api.presets}
          onPick={selectPreset}
          onClose={() => setDrawerOpen(false)}
          onCreate={() => {
            api.clearDuplicate();
            setDrawerOpen(false);
            setCreateOpen(true);
          }}
        />
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center"
          style={{ animation: 'ff-fade-in 0.2s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5 pb-7"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">＋ NEW MENU ITEM</p>
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

function ReceiptHeader({ date, dateOrderId, timezone, isWorkout }: { date: string; dateOrderId: string; timezone: string; isWorkout: boolean }) {
  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: timezone,
  }).toUpperCase();
  return (
    <>
      <p className="receipt-row text-center text-[18px] tracking-[0.4em] font-bold mt-1">F·O·O·D</p>
      <p className="receipt-row text-center text-[18px] tracking-[0.4em] font-bold mb-2">F·O·O·D</p>
      <p className="receipt-row text-center opacity-75">═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═</p>
      <p className="receipt-row text-center mt-1.5">{displayDate}</p>
      <p className="receipt-row text-center opacity-60 text-[10.5px]">ORDER #{dateOrderId}</p>
      <p className="receipt-row text-center mt-1">
        {isWorkout ? '◆ WORKOUT DAY ◆' : '· REST DAY ·'}
      </p>
    </>
  );
}

function ColHeader() {
  return (
    <div className="receipt-row flex justify-between opacity-60">
      <span>TIME &nbsp;ITEM</span>
      <span>KCAL</span>
    </div>
  );
}

function MealRow({ time, name, kcal }: { time: string; name: string; kcal: number }) {
  return (
    <div className="receipt-row flex justify-between gap-2">
      <span className="truncate">
        <span className="opacity-70">{time}</span>
        <span className="mx-1.5 opacity-40">·</span>
        <span>{name.toUpperCase()}</span>
      </span>
      <span className="tabular shrink-0">{kcal}</span>
    </div>
  );
}

function PrintingRow({ time, name, kcal }: { time: string; name: string; kcal: number }) {
  return (
    <div className="receipt-row flex justify-between gap-2 receipt-print-in">
      <span className="truncate">
        <span className="opacity-70">{time}</span>
        <span className="mx-1.5 opacity-40">·</span>
        <span className="font-bold">{name.toUpperCase()}</span>
      </span>
      <span className="tabular shrink-0 font-bold">{kcal}</span>
    </div>
  );
}

function SubtotalBlock({ subtotal, target, remain, pct }: { subtotal: number; target: number; remain: number; pct: number }) {
  const filled = Math.round(pct / 5); // 20 segments
  return (
    <>
      <div className="receipt-row flex justify-between">
        <span>SUBTOTAL</span>
        <span className="tabular">{subtotal}</span>
      </div>
      <div className="receipt-row flex justify-between opacity-70">
        <span>TARGET</span>
        <span className="tabular">{target}</span>
      </div>
      <div className="receipt-row flex justify-between">
        <span>REMAIN</span>
        <span className="tabular">{remain}</span>
      </div>
      <div className="receipt-row mt-1">
        <span className="tracking-tight">
          {'█'.repeat(filled)}{'░'.repeat(20 - filled)} {Math.round(pct)}%
        </span>
      </div>
    </>
  );
}

function ThankYouStamp() {
  return (
    <div className="my-3 flex justify-center">
      <div className="stamp">
        <span>★&nbsp;THANK&nbsp;YOU&nbsp;★</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <>
      <p className="receipt-row text-center opacity-50 mt-1">VISIT US AGAIN TOMORROW</p>
      <p className="receipt-row text-center opacity-40 text-[10px]">— food·food daily kitchen —</p>
    </>
  );
}

function Dashes({ spaced }: { spaced?: boolean }) {
  return <p className={`receipt-row text-center opacity-50 ${spaced ? 'my-1.5' : ''}`}>──────────────────────</p>;
}

function ZigzagEdge({ position }: { position: 'top' | 'bottom' }) {
  // SVG zigzag 撕纸边
  return (
    <svg
      viewBox="0 0 360 12"
      preserveAspectRatio="none"
      className="block w-full"
      style={{
        height: 12,
        transform: position === 'top' ? 'rotate(180deg)' : undefined,
        marginBottom: position === 'top' ? -1 : 0,
        marginTop: position === 'bottom' ? -1 : 0,
      }}
      aria-hidden
    >
      <path
        d="M0,0 L0,4 L8,12 L16,4 L24,12 L32,4 L40,12 L48,4 L56,12 L64,4 L72,12 L80,4 L88,12 L96,4 L104,12 L112,4 L120,12 L128,4 L136,12 L144,4 L152,12 L160,4 L168,12 L176,4 L184,12 L192,4 L200,12 L208,4 L216,12 L224,4 L232,12 L240,4 L248,12 L256,4 L264,12 L272,4 L280,12 L288,4 L296,12 L304,4 L312,12 L320,4 L328,12 L336,4 L344,12 L352,4 L360,12 L360,0 Z"
        fill="#f3ede0"
      />
    </svg>
  );
}

function PresetDrawer({
  presets, onPick, onClose, onCreate,
}: {
  presets: UserMealPreset[];
  onPick: (p: UserMealPreset) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[140]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 px-4 pt-4 pb-7"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
          animation: 'ff-slide-up 0.28s var(--ease-out-soft) both',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">▼ PICK AN ITEM ▼</p>
          <button onClick={onClose} className="text-[11px] text-text-3 font-mono active:scale-95">cancel</button>
        </div>
        {presets.length === 0 ? (
          <button
            onClick={onCreate}
            className="w-full h-12 rounded-md border-2 border-dashed border-hairline text-[12px] font-mono uppercase tracking-wider text-text-3 active:scale-[0.99]"
          >
            ＋ create first item
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pb-1">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="bg-surface border border-hairline text-left px-3 py-2.5 active:scale-95 transition-transform hover:border-accent/60 group"
              >
                <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
                <p className="text-[11px] font-mono text-accent tabular mt-0.5">
                  {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
                </p>
              </button>
            ))}
            <button
              onClick={onCreate}
              className="bg-surface border border-dashed border-hairline-strong text-[11px] font-mono uppercase tracking-wider text-text-3 hover:text-accent hover:border-accent/60 active:scale-95 transition-all py-2.5"
            >
              ＋ new
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes ff-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles = `
.receipt-paper {
  background: #f3ede0;
  color: #1a1a1a;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  position: relative;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.05) inset,
    0 28px 60px -20px rgba(0, 0, 0, 0.7),
    0 8px 16px -8px rgba(0, 0, 0, 0.4);
}
.receipt-body {
  padding: 6px 18px 14px;
  /* dot matrix print 噪点 + 微微的细横线 */
  background-image:
    repeating-linear-gradient(0deg, rgba(0,0,0,0.025) 0px, rgba(0,0,0,0.025) 1px, transparent 1px, transparent 3px),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.receipt-row {
  font-size: 12.5px;
  line-height: 1.55;
  letter-spacing: 0.02em;
  font-weight: 500;
  /* dot matrix 微抖：text-shadow 模拟打印油墨外溢 */
  text-shadow: 0.5px 0 0 rgba(0,0,0,0.15);
  white-space: nowrap;
}
.receipt-row .tabular { font-variant-numeric: tabular-nums; }

.stamp {
  border: 2px solid #b3320d;
  color: #b3320d;
  padding: 5px 14px 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  transform: rotate(-6deg);
  border-radius: 4px;
  opacity: 0.85;
  /* 印章不均匀：mask 给一点磨损感 */
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='1'/%3E%3CfeColorMatrix values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 8 -2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' fill='white'/%3E%3C/svg%3E");
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='1'/%3E%3CfeColorMatrix values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 8 -2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' fill='white'/%3E%3C/svg%3E");
  -webkit-mask-mode: alpha;
          mask-mode: alpha;
  -webkit-mask-composite: source-over;
}

.receipt-print-in {
  background: #e6dcc9;
  margin: 2px -18px;
  padding: 2px 18px;
  /* typewriter clip */
  animation: receipt-print 0.55s steps(28, end) both, receipt-flash 0.55s ease both;
  overflow: hidden;
}
@keyframes receipt-print {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0% 0 0); }
}
@keyframes receipt-flash {
  0% { background: #d6f06a; }
  60% { background: #e6dcc9; }
  100% { background: transparent; }
}
`;
