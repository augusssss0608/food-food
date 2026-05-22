'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';
import type { TodayMeal } from '@/components/today-meals';

/**
 * Order Spike — 中央一根钢针，preset 票纸抛飞→刺穿→堆叠。
 * 新增 = 抽屉选 preset，票纸以随机角度落到针顶。
 * 已记录票 long-press 删除。
 * 美学：金属反光钢针 + 厨房 chef ticket 米黄票纸 + 红色印章戳 + 角度错落。
 */
export function SpikeContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // 时间倒序：最新的票在最顶部
  const sortedMeals = [...api.meals].sort(
    (a, b) => new Date(b.ate_at).getTime() - new Date(a.ate_at).getTime(),
  );

  const subtotal = Math.round(api.consumed.kcal);
  const target = Math.round(api.targets.kcal);

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
    setDrawerOpen(false);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    await api.recordCustomPreset(p);
  }

  return (
    <PrototypeShell title="5. Order Spike">
      <div
        className="h-full bg-ink relative overflow-hidden flex flex-col"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,255,255,0.04) 0%, transparent 60%)',
        }}
      >
        {/* 顶部 HUD */}
        <header
          className="relative z-10 flex-shrink-0 px-5 pt-3 pb-2 flex items-center justify-between"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="ml-16">
            <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">KITCHEN</p>
            <p className="display-roman text-[18px] leading-none mt-0.5">order spike</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.24em] text-text-3 font-mono">tickets</p>
            <p className="text-[14px] font-mono tabular text-accent leading-none mt-1">
              {sortedMeals.length}
            </p>
          </div>
        </header>
        <div className="relative z-10 px-5 pb-2 text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-3">
            <span className="tabular text-accent">{subtotal}</span>
            <span className="mx-1">/</span>
            <span className="tabular">{target}</span>
            <span className="ml-1">kcal</span>
          </p>
        </div>

        {/* spike 区 */}
        <div className="flex-1 relative">
          <SpikeRail count={sortedMeals.length} />
          <div
            className="absolute inset-x-0 top-0 bottom-16 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            <div className="relative mx-auto" style={{ maxWidth: 360, paddingTop: 60, paddingBottom: 40 }}>
              {sortedMeals.length === 0 ? (
                <div className="text-center mt-32">
                  <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-text-3">
                    no tickets on spike
                  </p>
                  <p className="text-[11px] text-text-4 mt-1.5">
                    press ▲ DRAWER · pick item · fly to spike
                  </p>
                </div>
              ) : (
                sortedMeals.map((m, i) => (
                  <TicketCard
                    key={m.id}
                    meal={m}
                    index={i}
                    isNewest={i === 0}
                    timezone={api.timezone}
                    onLongPressStart={() => startLongPress(m.id)}
                    onLongPressEnd={cancelLongPress}
                  />
                ))
              )}
            </div>
          </div>

          {/* 针座 */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-14 z-[5] pointer-events-none">
            <div className="spike-base" />
          </div>
        </div>

        {/* 底部抽屉触发 */}
        <div
          className="relative z-10 px-5 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            disabled={api.recordingId != null}
            className="w-full h-12 bg-surface-2 border border-accent/40 text-accent font-mono uppercase tracking-[0.22em] text-[11px] font-semibold active:scale-[0.99] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span aria-hidden>▲</span>
            <span>{api.recordingId ? 'flying…' : 'preset drawer'}</span>
            <span aria-hidden>▲</span>
          </button>
        </div>
      </div>

      {drawerOpen && (
        <PresetDrawer
          presets={api.presets}
          onPick={pickPreset}
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
          <div
            className="relative w-full max-w-[420px] bg-surface-2 border-t border-hairline px-5 pt-5"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">
              ＋ NEW TICKET TEMPLATE
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

      <InlineConfirmDialog
        open={deletingId != null}
        title="撤下這張單？"
        body={
          deletingId
            ? <span>將從針上取下並刪除這條記錄。</span>
            : null
        }
        confirmText="撤下"
        variant="danger"
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (deletingId) {
            // 用真实的 meal delete API（复用 onMealDeleted patch）
            const id = deletingId;
            try {
              await fetch(`/api/meals/${id}`, { method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' } });
              api.onMealDeleted(id);
            } catch {}
          }
          setDeletingId(null);
        }}
      />

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function SpikeRail({ count }: { count: number }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-14 z-[1] pointer-events-none">
      {/* 钢针主体 */}
      <div className="spike-shaft" />
      {/* 顶部尖头 */}
      <div className="spike-tip" aria-hidden />
      {/* 顶部高光 */}
      <p className="absolute top-[-22px] left-1/2 -translate-x-1/2 text-[8px] font-mono uppercase tracking-[0.3em] text-text-4 whitespace-nowrap">
        spike · {count}
      </p>
    </div>
  );
}

function TicketCard({
  meal, index, isNewest, timezone, onLongPressStart, onLongPressEnd,
}: {
  meal: TodayMeal;
  index: number;
  isNewest: boolean;
  timezone: string;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
}) {
  // 用 meal.id 算稳定的伪随机角度，让排列错落但每次刷新一致
  const rotation = useMemo(() => {
    const seed = meal.id.charCodeAt(0) + meal.id.charCodeAt(meal.id.length - 1);
    return ((seed % 11) - 5) * 0.9; // [-4.5, +4.5] deg
  }, [meal.id]);
  const offsetX = useMemo(() => {
    const seed = meal.id.charCodeAt(1) ?? 0;
    return (seed % 7) - 3; // [-3, +3]px
  }, [meal.id]);

  const time = new Date(meal.ate_at).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
  });
  const stamped = meal.source === 'preset';

  return (
    <div
      className="ticket-wrap relative mx-auto"
      style={{
        marginTop: index === 0 ? 0 : -34,
        zIndex: 100 - index,
        animation: isNewest ? 'ticket-impale 0.5s var(--ease-spring) both' : undefined,
      }}
    >
      <button
        type="button"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onLongPressStart}
        onPointerUp={onLongPressEnd}
        onPointerCancel={onLongPressEnd}
        onPointerLeave={onLongPressEnd}
        className="ticket-card"
        style={{
          transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
        }}
      >
        {/* 钢针穿过的孔 */}
        <span className="ticket-hole" aria-hidden />
        <span className="ticket-shadow" aria-hidden />

        <div className="ticket-grid">
          <span className="ticket-time">{time}</span>
          <span className="ticket-name">{(meal.dish_name ?? '—').toUpperCase()}</span>
          <span className="ticket-kcal tabular">{Math.round(meal.kcal ?? 0)}</span>
          <span className="ticket-kcal-unit">kcal</span>
        </div>

        {stamped && (
          <span className="ticket-stamp" aria-hidden>
            <span>✓ FIRED</span>
          </span>
        )}
      </button>
    </div>
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
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 px-4 pt-4"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
          animation: 'drawer-up 0.28s var(--ease-out-soft) both',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">▲ pick a ticket</p>
          <button onClick={onClose} className="text-[11px] text-text-3 font-mono active:scale-95">cancel</button>
        </div>
        {presets.length === 0 ? (
          <button
            onClick={onCreate}
            className="w-full h-14 border-2 border-dashed border-hairline text-[12px] font-mono uppercase tracking-wider text-text-3 active:scale-[0.99]"
          >
            ＋ create first ticket
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pb-2">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="drawer-ticket text-left active:scale-95 transition-transform"
              >
                <span className="drawer-ticket-hole" aria-hidden />
                <p className="text-[12px] font-medium truncate" style={{ color: '#1a1a1a' }}>{p.name}</p>
                <p className="text-[11px] font-mono tabular mt-0.5" style={{ color: '#7a3a0d' }}>
                  {Math.round(p.kcal)}<span className="text-[9px] ml-0.5 opacity-70">kcal</span>
                </p>
              </button>
            ))}
            <button
              onClick={onCreate}
              className="bg-surface border-2 border-dashed border-hairline-strong text-[11px] font-mono uppercase tracking-wider text-text-3 hover:text-accent hover:border-accent/60 active:scale-95 transition-all py-3"
            >
              ＋ new
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = `
@keyframes drawer-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* 钢针主轴：金属反光渐变 */
.spike-shaft {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 0;
  bottom: 0;
  width: 6px;
  background:
    linear-gradient(90deg,
      #1a1a1f 0%,
      #4a4a52 25%,
      #c4c4cc 48%,
      #ffffff 52%,
      #a4a4ac 56%,
      #4a4a52 75%,
      #1a1a1f 100%);
  box-shadow:
    -1px 0 4px rgba(0,0,0,0.8),
    1px 0 4px rgba(0,0,0,0.4);
}
/* 钢针顶尖（三角形） */
.spike-tip {
  position: absolute;
  left: 50%;
  top: -14px;
  transform: translateX(-50%);
  width: 8px;
  height: 16px;
  background: linear-gradient(180deg, #f4f4f4 0%, #888 60%, #4a4a52 100%);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.6));
}
/* 针座 */
.spike-base {
  width: 88px;
  height: 18px;
  background:
    linear-gradient(180deg, #6a6a72 0%, #2a2a32 70%, #15151a 100%);
  border-radius: 3px;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.08) inset,
    0 12px 22px -6px rgba(0,0,0,0.7),
    0 4px 8px -2px rgba(0,0,0,0.5);
  position: relative;
}
.spike-base::after {
  content: '';
  position: absolute;
  left: 50%;
  top: -3px;
  transform: translateX(-50%);
  width: 16px;
  height: 6px;
  background: linear-gradient(180deg, #888 0%, #2a2a32 100%);
  border-radius: 2px 2px 0 0;
}

/* 票纸 */
.ticket-wrap {
  width: 260px;
}
.ticket-card {
  position: relative;
  display: block;
  width: 260px;
  padding: 26px 16px 12px;
  background: #f3ede0;
  background-image:
    repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 4px),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  color: #1a1a1a;
  font-family: 'JetBrains Mono', monospace;
  text-align: left;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.4) inset,
    0 8px 18px -8px rgba(0,0,0,0.7),
    0 2px 4px -1px rgba(0,0,0,0.4);
  transition: transform 0.18s ease;
}
.ticket-card:active {
  transform-origin: top center;
  filter: brightness(0.95);
}
/* 顶部圆孔（针穿过） */
.ticket-hole {
  position: absolute;
  left: 50%;
  top: 8px;
  transform: translateX(-50%);
  width: 14px;
  height: 14px;
  background: #0a0a0c;
  border-radius: 50%;
  box-shadow:
    0 0 0 2px rgba(255,255,255,0.4),
    inset 0 1px 3px rgba(0,0,0,0.8),
    inset 0 -1px 2px rgba(255,255,255,0.1);
}
.ticket-shadow {
  position: absolute;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  width: 24px;
  height: 4px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%);
  pointer-events: none;
}

.ticket-grid {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  letter-spacing: 0.02em;
}
.ticket-time {
  font-weight: 700;
  font-size: 13px;
  color: #1a1a1a;
}
.ticket-name {
  color: #1a1a1a;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ticket-kcal {
  font-weight: 800;
  font-size: 16px;
  color: #b3320d;
  font-variant-numeric: tabular-nums;
}
.ticket-kcal-unit {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #7a7a7a;
  text-transform: uppercase;
}

.ticket-stamp {
  position: absolute;
  right: -4px;
  bottom: -8px;
  padding: 3px 8px;
  border: 1.5px solid #b3320d;
  color: #b3320d;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.25em;
  transform: rotate(-12deg);
  opacity: 0.7;
  background: rgba(243, 237, 224, 0.6);
}

@keyframes ticket-impale {
  0%   { transform: translateY(-80px) scale(0.5) rotate(180deg); opacity: 0; }
  55%  { transform: translateY(8px)   scale(1.02) rotate(0deg);  opacity: 1; }
  78%  { transform: translateY(-3px)  scale(0.99); }
  100% { transform: translateY(0)     scale(1); }
}

/* drawer 里的票卡 */
.drawer-ticket {
  position: relative;
  background: #f3ede0;
  background-image:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  padding: 18px 10px 10px;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.4) inset,
    0 4px 10px -4px rgba(0,0,0,0.5);
}
.drawer-ticket-hole {
  position: absolute;
  left: 50%;
  top: 5px;
  transform: translateX(-50%);
  width: 10px;
  height: 10px;
  background: #0a0a0c;
  border-radius: 50%;
  box-shadow:
    0 0 0 1.5px rgba(255,255,255,0.3),
    inset 0 1px 2px rgba(0,0,0,0.8);
}
`;
