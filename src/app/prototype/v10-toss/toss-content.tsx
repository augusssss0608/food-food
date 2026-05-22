'use client';
import { useEffect, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Magnetic Toss — 主页结构保留不变。
 * 入口：右上 + 长按 280ms → 拖出一张 ghost card 跟随手指，底部 preset rail 浮起。
 * 拖到任一 preset 卡上 → 卡片磁吸合体 + lime 高亮，释放即记录。
 * 在中央释放（没命中）→ 弹出三选项：拍 / 自定义 / 取消。
 * 单击 + 按钮（短按）= 直接打开 preset 全列表 sheet（fallback）。
 */
export function TossContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [dragging, setDragging] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverPresetId, setHoverPresetId] = useState<string | null>(null);
  const [centerMenu, setCenterMenu] = useState<{ x: number; y: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [hint, setHint] = useState(true);

  const longPressRef = useRef<number | null>(null);
  const downAtRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const movedRef = useRef(false);
  const railRef = useRef<HTMLDivElement>(null);
  const ghostCardData = api.presets[0]; // ghost 暂用第一个 preset 的预览

  function clearTimer() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  // Plus button：长按触发 drag mode
  function onPlusPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    setHint(false);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    downAtRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    movedRef.current = false;
    setPointer({ x: e.clientX, y: e.clientY });
    clearTimer();
    longPressRef.current = window.setTimeout(() => {
      setDragging(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 280);
  }

  function onPlusPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) {
      // 还在长按阶段，如果手指移开足够远，认为是误触，取消长按
      if (downAtRef.current) {
        const dx = e.clientX - downAtRef.current.x;
        const dy = e.clientY - downAtRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          movedRef.current = true;
          // 不取消 — 仍允许长按触发（手感）
        }
      }
      return;
    }
    setPointer({ x: e.clientX, y: e.clientY });
    detectHover(e.clientX, e.clientY);
  }

  function onPlusPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    clearTimer();
    const tDown = downAtRef.current?.t ?? 0;
    const wasTap = !dragging && Date.now() - tDown < 280 && !movedRef.current;
    if (wasTap) {
      // 短按 = 打开全部 sheet
      setSheetOpen(true);
    } else if (dragging) {
      if (hoverPresetId) {
        const target = api.presets.find((p) => p.id === hoverPresetId);
        if (target) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 30, 10]);
          api.recordCustomPreset(target);
        }
      } else {
        // 中央释放：弹出小菜单
        setCenterMenu({ x: e.clientX, y: e.clientY });
      }
    }
    setDragging(false);
    setHoverPresetId(null);
    downAtRef.current = null;
  }

  function detectHover(x: number, y: number) {
    const el = document.elementFromPoint(x, y);
    if (!el) {
      setHoverPresetId(null);
      return;
    }
    const presetEl = (el as HTMLElement).closest?.('[data-preset-id]') as HTMLElement | null;
    const next = presetEl?.dataset?.presetId ?? null;
    if (next !== hoverPresetId) {
      setHoverPresetId(next);
      if (next && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5);
    }
  }

  function CustomPlus() {
    return (
      <button
        type="button"
        onPointerDown={onPlusPointerDown}
        onPointerMove={onPlusPointerMove}
        onPointerUp={onPlusPointerUp}
        onPointerCancel={onPlusPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="hold to drag preset"
        className="p-2 -mr-2 active:scale-95 transition-all rounded-md text-accent hover:text-accent-press relative"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {hint && (
          <span className="absolute -bottom-5 right-0 text-[8px] font-mono uppercase tracking-wider text-text-3 whitespace-nowrap pointer-events-none">
            hold ↓
          </span>
        )}
      </button>
    );
  }

  return (
    <PrototypeShell title="5. Magnetic Toss">
      <RealHomeShell api={api} rightAction={<CustomPlus />} />

      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-[2px] pointer-events-none transition-opacity"
        style={{ opacity: dragging ? 1 : 0 }}
      />

      {/* 底部 preset rail */}
      <div
        ref={railRef}
        className="fixed left-0 right-0 z-[70] bg-surface-2 border-t border-accent/40"
        style={{
          bottom: 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
          paddingTop: 12,
          transform: dragging ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.32s var(--ease-spring)',
          pointerEvents: dragging ? 'auto' : 'none',
          boxShadow: '0 -8px 30px -10px rgba(0,0,0,0.7)',
        }}
      >
        <div className="flex items-center justify-between px-5 mb-2">
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">drop on a preset</p>
          <p className="text-[9px] font-mono text-text-4 uppercase tracking-wider">
            release in middle for more
          </p>
        </div>
        <div className="overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2.5 pb-1">
            {api.presets.map((p) => {
              const hover = hoverPresetId === p.id;
              return (
                <div
                  key={p.id}
                  data-preset-id={p.id}
                  className={`shrink-0 bg-surface px-3 py-3 transition-all rounded-sm`}
                  style={{
                    minWidth: 110,
                    border: hover ? '1.5px solid var(--color-accent)' : '1px solid var(--color-hairline)',
                    boxShadow: hover ? '0 0 24px rgba(200,255,0,0.35)' : 'none',
                    transform: hover ? 'translateY(-6px) scale(1.04)' : 'none',
                    background: hover ? 'rgba(200,255,0,0.10)' : 'var(--color-surface)',
                  }}
                >
                  <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
                  <p className="text-[11px] font-mono text-accent tabular mt-0.5">
                    {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
                  </p>
                </div>
              );
            })}
            {api.presets.length === 0 && (
              <p className="text-[12px] text-text-3 py-2 px-3 font-mono">
                沒有 preset，先用「+」短按建立
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ghost card 跟随指针 */}
      {dragging && (
        <div
          className="fixed pointer-events-none z-[80] ghost-card"
          style={{
            left: pointer.x,
            top: pointer.y,
            transform: hoverPresetId
              ? 'translate(-50%, -50%) rotate(0deg) scale(0.92)'
              : 'translate(-50%, -50%) rotate(-6deg) scale(1)',
          }}
        >
          {hoverPresetId ? (
            <div className="ghost-card-snap">
              <span className="text-[10px] font-mono uppercase tracking-wider">snap</span>
            </div>
          ) : (
            <div className="ghost-card-body">
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-3">new meal</p>
              <p className="text-[14px] text-text font-medium mt-1">{ghostCardData?.name ?? '· · ·'}</p>
              <p className="text-[12px] font-mono text-accent tabular mt-0.5">
                {ghostCardData ? Math.round(ghostCardData.kcal) : '—'}
                <span className="text-[9px] text-text-3 ml-0.5">kcal</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 中央释放：备选菜单 */}
      {centerMenu && (
        <div
          className="fixed inset-0 z-[90]"
          onClick={() => setCenterMenu(null)}
          style={{ animation: 'ff-fade-in 0.18s ease-out both' }}
        >
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
          <div
            className="absolute"
            style={{
              left: Math.min(window.innerWidth - 180, Math.max(20, centerMenu.x - 90)),
              top: Math.min(window.innerHeight - 150, Math.max(20, centerMenu.y - 60)),
              animation: 'pop-in 0.2s var(--ease-spring) both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-surface-2 border border-accent/40 rounded-lg overflow-hidden min-w-[180px] shadow-2xl shadow-black/60">
              <button
                onClick={() => { setCenterMenu(null); setSheetOpen(true); }}
                className="w-full px-3 py-2.5 text-left text-[12px] text-text border-b border-hairline hover:bg-surface active:bg-surface flex items-center gap-2"
              >
                <span className="text-accent">◉</span> 拍照
              </button>
              <button
                onClick={() => { setCenterMenu(null); api.clearDuplicate(); setCreateOpen(true); }}
                className="w-full px-3 py-2.5 text-left text-[12px] text-text border-b border-hairline hover:bg-surface active:bg-surface flex items-center gap-2"
              >
                <span className="text-accent">✎</span> 自定義
              </button>
              <button
                onClick={() => setCenterMenu(null)}
                className="w-full px-3 py-2.5 text-left text-[12px] text-text-3 hover:bg-surface active:bg-surface flex items-center gap-2"
              >
                <span>×</span> 取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全部 preset sheet（短按 fallback） */}
      {sheetOpen && (
        <AllPresetSheet
          presets={api.presets}
          recordingId={api.recordingId}
          onPick={async (p) => {
            await api.recordCustomPreset(p);
            setSheetOpen(false);
          }}
          onCreate={() => { api.clearDuplicate(); setSheetOpen(false); setCreateOpen(true); }}
          onClose={() => setSheetOpen(false)}
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

function AllPresetSheet({
  presets, recordingId, onPick, onCreate, onClose,
}: {
  presets: UserMealPreset[];
  recordingId: string | null;
  onPick: (p: UserMealPreset) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 px-4 pt-4"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
          animation: 'drawer-up 0.28s var(--ease-out-soft) both',
          maxHeight: '65vh',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">all menus</p>
          <button onClick={onClose} className="text-[11px] text-text-3 font-mono active:scale-95">close</button>
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto" style={{ maxHeight: 'calc(65vh - 80px)' }}>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              disabled={recordingId != null}
              className="bg-surface border border-hairline px-3 py-2.5 text-left hover:border-accent/60 active:scale-95 transition-all disabled:opacity-50 rounded"
            >
              <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
              <p className="text-[11px] font-mono text-accent tabular mt-0.5">
                {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
              </p>
            </button>
          ))}
          <button
            onClick={onCreate}
            className="bg-surface border-2 border-dashed border-hairline-strong text-text-3 hover:text-accent hover:border-accent/60 active:scale-95 transition-all py-3 text-[11px] font-mono uppercase tracking-wider rounded"
          >
            ＋ new
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
@keyframes drawer-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes pop-in { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.ghost-card {
  transition: transform 0.18s var(--ease-spring);
}
.ghost-card-body {
  background: rgba(28, 28, 34, 0.92);
  border: 1.5px solid var(--color-accent);
  backdrop-filter: blur(8px);
  padding: 10px 14px;
  border-radius: 6px;
  min-width: 140px;
  box-shadow:
    0 12px 28px -8px rgba(0,0,0,0.7),
    0 0 24px rgba(200,255,0,0.25);
}
.ghost-card-snap {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  box-shadow:
    0 0 0 6px rgba(200,255,0,0.2),
    0 0 36px rgba(200,255,0,0.6);
}
`;
