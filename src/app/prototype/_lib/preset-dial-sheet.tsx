'use client';
import { useMemo, useRef, useState } from 'react';
import type { UserMealPreset } from '@/lib/home-snapshot';

/**
 * 共享 dial-style 选餐 sheet：
 * - 顶部：搜索切换 + close
 * - AI 推荐 3 chip：tap chip = 直接 record
 * - 中央：单卡显示当前 preset（菜名 + kcal + macro），左右大箭头 / 横滑切换
 * - 下方：dot indicators
 * - 底部：＋ 新建 + 大「記錄此餐」按钮
 *
 * v9-radial / v11-composer / v13-tray 共用，避免抓 grid 滚动。
 */
export function PresetDialSheet({
  presets, recordingId, aiRecommended,
  onPick, onCreate, onClose,
  headerTagline = 'flip · search · record',
}: {
  presets: UserMealPreset[];
  recordingId: string | null;
  aiRecommended?: UserMealPreset[];
  onPick: (p: UserMealPreset) => void | Promise<void>;
  onCreate: () => void;
  onClose: () => void;
  headerTagline?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const startRef = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) return presets;
    const nq = q.trim().toLowerCase();
    return presets.filter((p) => p.name.toLowerCase().includes(nq));
  }, [q, presets]);

  const safeIdx = filtered.length === 0 ? 0 : Math.min(idx, filtered.length - 1);
  const item = filtered[safeIdx];

  function prev() {
    if (filtered.length === 0) return;
    setIdx((i) => (i - 1 + filtered.length) % filtered.length);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
  }
  function next() {
    if (filtered.length === 0) return;
    setIdx((i) => (i + 1) % filtered.length);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(4);
  }

  function onTouchStart(e: React.TouchEvent) {
    startRef.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startRef.current == null) return;
    const cx = e.touches[0]?.clientX ?? 0;
    setDx(cx - startRef.current);
  }
  function onTouchEnd() {
    const d = dx;
    startRef.current = null;
    setDx(0);
    if (d > 50) prev();
    else if (d < -50) next();
  }

  return (
    <div className="fixed inset-0 z-[150]" style={{ animation: 'ff-fade-in 0.18s ease-out both' }}>
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-accent/40 rounded-t-2xl flex flex-col"
        style={{
          height: '78vh',
          animation: 'drawer-up 0.32s var(--ease-out-soft) both',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* handle */}
        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-hairline-strong" />
        </div>

        {/* header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-1 pb-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-accent font-mono">pick a preset</p>
            <p className="text-[10px] font-mono text-text-3 mt-0.5">{headerTagline}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSearchOpen((o) => !o); if (searchOpen) { setQ(''); } }}
              aria-label="toggle search"
              className={`w-8 h-8 flex items-center justify-center border rounded transition-all active:scale-95 ${
                searchOpen ? 'border-accent text-accent bg-accent/10' : 'border-hairline text-text-2 hover:text-accent'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4-4" />
              </svg>
            </button>
            <button onClick={onClose} className="text-[11px] text-text-3 font-mono active:scale-95 px-1">close</button>
          </div>
        </div>

        {/* search bar */}
        {searchOpen && (
          <div className="flex-shrink-0 px-4 pb-2" style={{ animation: 'ff-fade-in 0.16s ease-out both' }}>
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setIdx(0); }}
              placeholder={`搜尋 ${presets.length} 個 preset…`}
              className="w-full h-10 px-3 bg-surface border border-hairline rounded text-[13px] text-text outline-none focus:border-accent/60 placeholder:text-text-4"
            />
          </div>
        )}

        {/* AI 推荐 chip 行 */}
        {!searchOpen && aiRecommended && aiRecommended.length > 0 && (
          <div className="flex-shrink-0 px-4 pb-3">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-3 mb-1.5">★ 智能推薦</p>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {aiRecommended.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  disabled={recordingId != null}
                  className="shrink-0 bg-accent text-accent-ink rounded-full pl-3 pr-3.5 py-1.5 text-[12px] font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="truncate max-w-[100px]">{p.name}</span>
                  <span className="font-mono tabular text-[10px] opacity-70">{Math.round(p.kcal)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* dial 大卡区 */}
        <div
          className="flex-1 flex items-center justify-center px-5 relative overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {filtered.length === 0 ? (
            <div className="text-center">
              <p className="text-[14px] text-text-3 font-mono">{q ? '沒有結果' : '還沒有 preset'}</p>
              {!q && (
                <button onClick={onCreate} className="mt-3 text-[12px] text-accent font-mono uppercase tracking-wider active:scale-95">
                  ＋ 建立第一個
                </button>
              )}
            </div>
          ) : item ? (
            <>
              <button
                onClick={prev}
                aria-label="previous"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center text-text-3 active:scale-90 active:text-accent hover:text-text-2"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div
                className="dial-card"
                style={{
                  transform: `translateX(${dx * 0.4}px) rotate(${dx * 0.02}deg)`,
                  transition: dx === 0 ? 'transform 0.28s var(--ease-spring)' : 'none',
                }}
              >
                <p className="text-[9px] uppercase tracking-[0.3em] text-text-3 font-mono">
                  {safeIdx + 1} / {filtered.length}
                </p>
                <p
                  className="text-[24px] font-medium text-text leading-tight mt-2 text-center"
                  style={{ maxWidth: 240, wordBreak: 'break-word' }}
                >
                  {item.name}
                </p>
                <p className="text-[44px] font-mono tabular text-accent leading-none mt-3">
                  {Math.round(item.kcal)}
                  <span className="text-[12px] text-text-3 ml-1.5 font-sans">kcal</span>
                </p>
                <div className="flex gap-4 text-[11px] font-mono text-text-2 tabular mt-4">
                  <span><span className="opacity-60">P</span> {Math.round(item.protein_g)}</span>
                  <span><span className="opacity-60">C</span> {Math.round(item.carb_g)}</span>
                  <span><span className="opacity-60">F</span> {Math.round(item.fat_g)}</span>
                </div>
              </div>
              <button
                onClick={next}
                aria-label="next"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center text-text-3 active:scale-90 active:text-accent hover:text-text-2"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          ) : null}
        </div>

        {/* dots indicator */}
        {filtered.length > 1 && filtered.length <= 16 && (
          <div className="flex-shrink-0 flex justify-center gap-1.5 pb-3 pt-1">
            {filtered.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === safeIdx ? 16 : 5,
                  height: 5,
                  background: i === safeIdx ? 'var(--color-accent)' : 'var(--color-hairline)',
                }}
              />
            ))}
          </div>
        )}
        {filtered.length > 16 && (
          <div className="flex-shrink-0 flex justify-center pb-2 pt-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-text-4">
              {safeIdx + 1} / {filtered.length} · swipe or ← →
            </p>
          </div>
        )}

        {/* footer */}
        <div className="flex-shrink-0 px-4 pb-4 flex gap-2">
          <button
            onClick={onCreate}
            aria-label="new preset"
            className="shrink-0 w-12 h-12 border border-hairline bg-surface text-text-2 hover:text-accent hover:border-accent/60 active:scale-95 transition-all rounded font-mono text-[16px] flex items-center justify-center"
          >
            ＋
          </button>
          <button
            onClick={() => item && onPick(item)}
            disabled={!item || recordingId != null}
            className="flex-1 h-12 bg-accent text-accent-ink font-mono uppercase tracking-[0.22em] text-[12px] font-semibold disabled:opacity-40 disabled:bg-surface-3 active:scale-[0.99] transition-transform rounded"
          >
            {recordingId ? 'recording…' : '記錄此餐'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes drawer-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .dial-card {
          width: min(280px, 78vw);
          background:
            linear-gradient(180deg, rgba(36,36,44,0.96) 0%, rgba(22,22,28,1) 100%);
          border: 1px solid var(--color-hairline-strong);
          border-radius: 18px;
          padding: 22px 16px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.05) inset,
            0 18px 40px -12px rgba(0,0,0,0.8);
        }
      `}</style>
    </div>
  );
}

/**
 * 简单 AI 推荐：基于时间 + 名字 keyword 凑出 3 个 preset。
 * 早 (5-10): 蛋 / 咖 / 燕 / 奶 / 麦 / 包
 * 中 (10-15): 飯 / 麵 / 麦 / 漢
 * 晚 (15-22): 飯 / 麵 / 肉 / 鱼
 * 零 (other): 果 / 茶 / 餅
 * 没匹配回退到 presets[0..2]。
 */
export function pickAIRecommended(presets: UserMealPreset[]): UserMealPreset[] {
  if (presets.length === 0) return [];
  const hour = new Date().getHours();
  let keywords: string[];
  if (hour >= 5 && hour < 10) keywords = ['蛋', '咖', '燕', '奶', '麥', '麦', '包', 'oat', 'egg', 'coffee'];
  else if (hour >= 10 && hour < 15) keywords = ['飯', '飯', '麵', '面', '麥', '漢', 'rice', 'noodle'];
  else if (hour >= 15 && hour < 22) keywords = ['飯', '麵', '面', '肉', '魚', '鱼', '湯', 'rice', 'noodle'];
  else keywords = ['果', '茶', '餅', '巧', 'fruit', 'tea', 'cookie'];

  const matched = presets.filter((p) =>
    keywords.some((k) => p.name.toLowerCase().includes(k.toLowerCase())),
  );
  const result = [...matched.slice(0, 3)];
  // 不足 3 个 → 用 presets 前几个补
  for (const p of presets) {
    if (result.length >= 3) break;
    if (!result.find((r) => r.id === p.id)) result.push(p);
  }
  return result;
}
