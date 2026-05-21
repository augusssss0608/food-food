'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, MockSheet, PlusButton } from '../_lib/mock-home';
import { MOCK_PRESETS, MOCK_RECENT_PHOTO } from '../_lib/mock-presets';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export default function SpotlightPage() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [recordedName, setRecordedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 320);
    else setQ('');
  }, [open]);

  const trimmed = q.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return MOCK_PRESETS.slice(0, 8);
    const nq = norm(trimmed);
    return MOCK_PRESETS.filter((p) => norm(p.name).includes(nq));
  }, [trimmed]);

  const noMatch = trimmed.length > 0 && filtered.length === 0;

  function record(name: string) {
    setRecordedName(name);
    setOpen(false);
    setTimeout(() => setRecordedName(null), 1500);
  }

  return (
    <PrototypeShell title="1. Spotlight 搜索">
      <MockHome rightAction={<PlusButton onClick={() => setOpen(true)} />} />

      <MockSheet open={open} onClose={() => setOpen(false)} title="新增餐">
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
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

        <div className="px-4 pb-6">
          {noMatch ? (
            <button
              type="button"
              onClick={() => alert(`新建「${trimmed}」流程`)}
              className="w-full bg-accent/10 border border-accent/30 rounded-xl p-4 text-left hover:bg-accent/15 active:scale-[0.99] transition-all"
            >
              <p className="text-[11px] uppercase tracking-wider text-accent font-mono mb-1">找不到？</p>
              <p className="text-[14px] text-text font-medium">
                ↵ 新建「<span className="text-accent">{trimmed}</span>」
              </p>
            </button>
          ) : (
            <>
              {!trimmed && <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-2">建議</p>}
              <ul className="space-y-1.5">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => record(p.name)}
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

          <div className="mt-5 pt-3 border-t border-hairline flex gap-2">
            <button className="flex-1 bg-surface border border-hairline rounded-lg px-3 py-2.5 text-[12px] text-text-2 hover:border-hairline-strong active:scale-[0.99] transition-all">
              📷 拍餐
            </button>
            <button className="flex-1 bg-surface border border-hairline rounded-lg px-3 py-2.5 text-[12px] text-text-2 hover:border-hairline-strong active:scale-[0.99] transition-all">
              🕐 近期 ({MOCK_RECENT_PHOTO.length})
            </button>
          </div>
        </div>
      </MockSheet>

      {recordedName && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg z-[80]">
          已記錄「{recordedName}」
        </div>
      )}
    </PrototypeShell>
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
