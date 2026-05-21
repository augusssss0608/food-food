'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, MockSheet, PlusButton, MockToast, useMockTodayLog } from '../_lib/mock-home';
import { MOCK_PRESETS, MOCK_RECENT_PHOTO } from '../_lib/mock-presets';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export default function SpotlightPage() {
  const { log, addEntry } = useMockTodayLog();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [section, setSection] = useState<'main' | 'photo' | 'recent'>('main');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 不 autoFocus，避免 iPhone Safari 立即彈鍵盤遮擋下方入口；用戶點輸入框才彈
    if (!open) { setQ(''); setSection('main'); }
  }, [open]);

  const trimmed = q.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return MOCK_PRESETS;
    const nq = norm(trimmed);
    return MOCK_PRESETS.filter((p) => norm(p.name).includes(nq));
  }, [trimmed]);

  const noMatch = trimmed.length > 0 && filtered.length === 0;

  function record(name: string, kcal: number) {
    addEntry(name, kcal);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
    setOpen(false);
  }

  return (
    <PrototypeShell title="1. Spotlight 搜索">
      <MockHome log={log} rightAction={<PlusButton onClick={() => setOpen(true)} />} />

      <MockSheet open={open} onClose={() => setOpen(false)} title="新增餐" minHeight="80vh">
        {section === 'photo' ? (
          <PhotoSection onBack={() => setSection('main')} onPicked={record} />
        ) : section === 'recent' ? (
          <RecentSection onBack={() => setSection('main')} onPicked={record} />
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-4 pt-3 pb-3 flex-shrink-0">
              <label className="relative block">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none"
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜尋菜單或新建..."
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-surface border border-hairline text-[15px] text-text placeholder:text-text-4 outline-none focus:border-accent/60 transition-colors"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-2">
              {noMatch ? (
                <button
                  type="button"
                  onClick={() => {
                    record(trimmed, 0);
                  }}
                  className="w-full bg-accent/10 border border-accent/30 rounded-xl p-4 text-left hover:bg-accent/15 active:scale-[0.99] transition-all"
                >
                  <p className="text-[11px] uppercase tracking-wider text-accent font-mono mb-1">找不到？</p>
                  <p className="text-[14px] text-text font-medium">
                    ↵ 新建「<span className="text-accent">{trimmed}</span>」並加入今日
                  </p>
                </button>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-2">
                    {trimmed ? `匹配 ${filtered.length} 個` : `建議 · 全部 ${MOCK_PRESETS.length} 個`}
                  </p>
                  <ul className="space-y-1.5">
                    {filtered.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => record(p.name, p.kcal)}
                          className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3 hover:border-hairline-strong active:scale-[0.99] transition-all"
                        >
                          <span className="text-[13px] text-text font-medium truncate">
                            {trimmed ? highlight(p.name, trimmed) : p.name}
                          </span>
                          <span className="text-[12px] font-mono text-accent tabular flex-shrink-0">
                            {p.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="flex-shrink-0 px-4 pt-2 pb-3 border-t border-hairline flex gap-2">
              <button
                onClick={() => setSection('photo')}
                className="flex-1 bg-surface border border-hairline rounded-lg px-3 py-2.5 text-[12px] text-text-2 hover:border-hairline-strong active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>📷</span>
                <span>拍餐</span>
              </button>
              <button
                onClick={() => setSection('recent')}
                className="flex-1 bg-surface border border-hairline rounded-lg px-3 py-2.5 text-[12px] text-text-2 hover:border-hairline-strong active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>🕐</span>
                <span>近期 ({MOCK_RECENT_PHOTO.length})</span>
              </button>
            </div>
          </div>
        )}
      </MockSheet>

      <MockToast text={toast} />
    </PrototypeShell>
  );
}

function PhotoSection({ onBack, onPicked }: { onBack: () => void; onPicked: (n: string, k: number) => void }) {
  return (
    <div className="p-5 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-text-3 hover:text-text active:scale-95 text-[12px] font-mono uppercase tracking-wider">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        返回
      </button>
      <div className="w-full aspect-square border-2 border-dashed border-hairline rounded-2xl flex flex-col items-center justify-center gap-3 text-text-3 hover:border-accent/60 hover:text-accent active:scale-[0.99] transition-all cursor-pointer"
        onClick={() => onPicked('拍照識別餐', 420)}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span className="text-[13px] font-mono uppercase tracking-wider">點擊模擬拍照識別</span>
      </div>
    </div>
  );
}

function RecentSection({ onBack, onPicked }: { onBack: () => void; onPicked: (n: string, k: number) => void }) {
  return (
    <div className="p-4 space-y-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-text-3 hover:text-text active:scale-95 text-[12px] font-mono uppercase tracking-wider">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        返回
      </button>
      <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono">近 30 天拍照</p>
      <ul className="space-y-1.5">
        {MOCK_RECENT_PHOTO.map((m) => (
          <li key={m.meal_id}>
            <button
              onClick={() => onPicked(m.dish_name, m.kcal)}
              className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between hover:border-hairline-strong active:scale-[0.99] transition-all"
            >
              <span className="text-[13px] text-text font-medium truncate">{m.dish_name}</span>
              <span className="text-[12px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function highlight(text: string, q: string) {
  const i = norm(text).indexOf(norm(q));
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}
