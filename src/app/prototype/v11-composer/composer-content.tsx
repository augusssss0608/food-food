'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm } from '../_lib/preset-manager';
import type { HomeSnapshot, UserMealPreset } from '@/lib/home-snapshot';

/**
 * Bottom Composer — 主页结构保留，底部常驻 ambient capsule。
 * 状态：collapsed (capsule) ⇄ expanded (sheet)。
 * 触发：点击 / 上拉 ≥ 60px。
 * Tabs：preset · 拍 · 写。
 * Capsule 文案随时间和剩余 kcal 动态变化（"还没记早餐 · 还需 1245"）。
 */
type Tab = 'preset' | 'photo' | 'write';

export function ComposerContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('preset');
  const [dragY, setDragY] = useState(0); // 上拉时跟手位移（visual only）
  const [q, setQ] = useState('');
  const dragStartRef = useRef<number | null>(null);

  const subtotal = Math.round(api.consumed.kcal);
  const target = Math.round(api.targets.kcal);
  const remain = Math.max(0, target - subtotal);

  // 动态提示文案
  const placeholder = useMemo(() => {
    const hour = new Date().getHours();
    const hasMorning = api.meals.some((m) => new Date(m.ate_at).getHours() < 11);
    const hasLunch = api.meals.some((m) => {
      const h = new Date(m.ate_at).getHours();
      return h >= 11 && h < 15;
    });
    const hasDinner = api.meals.some((m) => new Date(m.ate_at).getHours() >= 17);
    if (hour < 11 && !hasMorning) return '記下早餐';
    if (hour < 15 && !hasLunch) return '記下午餐';
    if (hour < 22 && !hasDinner) return '記下晚餐';
    if (remain > 200) return `還差 ${remain} kcal · 加一筆`;
    return '吃了點什麼？';
  }, [api.meals, remain]);

  const filtered = useMemo(() => {
    if (!q.trim()) return api.presets;
    const nq = q.trim().toLowerCase();
    return api.presets.filter((p) => p.name.toLowerCase().includes(nq));
  }, [q, api.presets]);

  function onCapsulePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragStartRef.current = e.clientY;
  }
  function onCapsulePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartRef.current == null) return;
    const dy = dragStartRef.current - e.clientY; // 上滑为正
    if (dy > 0) setDragY(Math.min(dy, 120));
  }
  function onCapsulePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartRef.current == null) return;
    const dy = dragStartRef.current - e.clientY;
    dragStartRef.current = null;
    setDragY(0);
    if (dy > 60) {
      setExpanded(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    } else if (Math.abs(dy) < 8) {
      // tap
      setExpanded(true);
    }
  }

  async function pickPreset(p: UserMealPreset) {
    const ok = await api.recordCustomPreset(p);
    if (ok) {
      setExpanded(false);
      setQ('');
    }
  }

  return (
    <PrototypeShell title="6. Bottom Composer">
      <RealHomeShell api={api} rightAction={null} />

      {/* ambient capsule（始终在屏底） */}
      <div
        className="fixed left-0 right-0 z-[70] px-4 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <button
          type="button"
          onClick={() => !dragStartRef.current && setExpanded(true)}
          onPointerDown={onCapsulePointerDown}
          onPointerMove={onCapsulePointerMove}
          onPointerUp={onCapsulePointerUp}
          onPointerCancel={onCapsulePointerUp}
          aria-label="open composer"
          className="capsule pointer-events-auto"
          style={{
            transform: `translateY(${-dragY * 0.6}px)`,
            opacity: expanded ? 0 : 1,
            pointerEvents: expanded ? 'none' : 'auto',
            transition: dragStartRef.current ? 'none' : 'transform 0.25s var(--ease-spring), opacity 0.18s ease',
          }}
        >
          <span className="capsule-handle" aria-hidden />
          <span className="capsule-glyph">＋</span>
          <span className="capsule-text">{placeholder}</span>
          <span className="capsule-meta tabular">
            {subtotal}
            <span className="opacity-50 mx-0.5">/</span>
            {target}
          </span>
          <span className="capsule-arrow" aria-hidden>↑</span>
        </button>
      </div>

      {/* expanded sheet */}
      {expanded && (
        <ExpandedSheet
          api={api}
          tab={tab}
          setTab={setTab}
          q={q}
          setQ={setQ}
          filtered={filtered}
          onPickPreset={pickPreset}
          onClose={() => setExpanded(false)}
        />
      )}

      <style>{styles}</style>
    </PrototypeShell>
  );
}

function ExpandedSheet({
  api, tab, setTab, q, setQ, filtered, onPickPreset, onClose,
}: {
  api: ReturnType<typeof useHomeData>;
  tab: Tab;
  setTab: (t: Tab) => void;
  q: string;
  setQ: (q: string) => void;
  filtered: UserMealPreset[];
  onPickPreset: (p: UserMealPreset) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/65 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 rounded-t-2xl flex flex-col"
        style={{
          height: '70vh',
          animation: 'drawer-up 0.32s var(--ease-out-soft) both',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* handle */}
        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-hairline-strong" />
        </div>

        {/* tabs */}
        <div className="flex-shrink-0 px-4 pt-1 pb-3 flex items-center justify-between">
          <div className="flex gap-1">
            {(['preset', 'photo', 'write'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-all ${
                  tab === t
                    ? 'bg-accent text-accent-ink'
                    : 'bg-surface border border-hairline text-text-3 hover:text-text active:scale-95'
                }`}
              >
                {t === 'preset' ? '★ 常用' : t === 'photo' ? '◉ 拍照' : '✎ 自定義'}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-[11px] text-text-3 font-mono active:scale-95">close</button>
        </div>

        {/* tab content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'preset' && (
            <PresetTab
              presets={api.presets}
              filtered={filtered}
              q={q}
              setQ={setQ}
              recordingId={api.recordingId}
              onPick={onPickPreset}
            />
          )}
          {tab === 'photo' && <PhotoTab />}
          {tab === 'write' && (
            <WriteTab
              busy={api.presetBusy || api.recordingId != null}
              duplicateName={api.duplicateName}
              onClear={() => api.clearDuplicate()}
              onSubmit={async (name, kcal) => {
                const okAdd = await api.addPreset(name, kcal);
                if (!okAdd) return false;
                const fresh = api.presets.find((p) => p.name === name);
                if (fresh) await api.recordCustomPreset(fresh);
                onClose();
                return true;
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PresetTab({
  presets, filtered, q, setQ, recordingId, onPick,
}: {
  presets: UserMealPreset[];
  filtered: UserMealPreset[];
  q: string;
  setQ: (q: string) => void;
  recordingId: string | null;
  onPick: (p: UserMealPreset) => void;
}) {
  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`搜尋 ${presets.length} 個菜單…`}
        className="w-full h-10 px-3 mb-3 rounded bg-surface border border-hairline text-[13px] text-text placeholder:text-text-4 outline-none focus:border-accent/60"
      />
      {presets.length === 0 ? (
        <p className="text-[12px] text-text-3 text-center py-10">
          還沒有 preset，去「自定義」 tab 建一個
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-[12px] text-text-3 text-center py-10">沒有結果</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              disabled={recordingId != null}
              className="bg-surface border border-hairline px-3 py-3 text-left rounded hover:border-accent/60 active:scale-95 transition-all disabled:opacity-50"
            >
              <p className="text-[12.5px] text-text font-medium truncate">{p.name}</p>
              <p className="text-[13px] font-mono text-accent tabular mt-1">
                {Math.round(p.kcal)}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function PhotoTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center pt-6">
      <div className="w-40 h-40 border-2 border-dashed border-hairline-strong rounded-2xl flex flex-col items-center justify-center gap-2 text-text-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span className="text-[11px] font-mono uppercase tracking-wider">tap to shoot</span>
      </div>
      <p className="text-[10px] text-text-4 mt-3 font-mono">demo · prototype 不接 AI</p>
    </div>
  );
}

function WriteTab({
  busy, duplicateName, onClear, onSubmit,
}: {
  busy: boolean;
  duplicateName: boolean;
  onClear: () => void;
  onSubmit: (name: string, kcal: number) => Promise<boolean>;
}) {
  return (
    <div className="pt-2">
      <p className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono mb-3">
        ＋ 新建並加入今日
      </p>
      <MockPresetForm
        submitLabel={busy ? '處理中…' : '建立並記錄'}
        onSubmit={async (name, kcal) => { await onSubmit(name, kcal); }}
        onCancel={onClear}
      />
      {duplicateName && (
        <p className="text-[11px] text-danger mt-2 text-center">已存在同名菜單，請改名</p>
      )}
    </div>
  );
}

const styles = `
@keyframes drawer-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

.capsule {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  gap: 10px;
  align-items: center;
  background: rgba(28, 28, 34, 0.85);
  border: 1px solid var(--color-hairline-strong);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-radius: 999px;
  padding: 10px 16px 10px 12px;
  cursor: pointer;
  position: relative;
  box-shadow:
    0 12px 32px -8px rgba(0,0,0,0.6),
    0 1px 0 rgba(255,255,255,0.04) inset;
}
.capsule:hover {
  border-color: rgba(200,255,0,0.4);
}
.capsule:active {
  transform: scale(0.99);
}
.capsule-handle {
  position: absolute;
  left: 50%;
  top: -4px;
  transform: translateX(-50%);
  width: 28px;
  height: 3px;
  background: var(--color-hairline-strong);
  border-radius: 999px;
  opacity: 0.6;
}
.capsule-glyph {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}
.capsule-text {
  font-size: 13px;
  color: var(--color-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.capsule-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--color-text-3);
  font-variant-numeric: tabular-nums;
}
.capsule-arrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--color-accent);
  opacity: 0.7;
  animation: arrow-bob 1.8s ease-in-out infinite;
}
@keyframes arrow-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
`;
