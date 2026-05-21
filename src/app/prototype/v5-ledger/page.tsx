'use client';
import { useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MOCK_PRESETS, MOCK_TODAY_LOG, type TodayLogEntry } from '../_lib/mock-presets';

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Ledger 方案：取消主頁右上 + 按鈕，「今日紀錄」末尾就是入口。
 * 直接在主頁佈局內插入 inline composer，不彈窗。
 */
export default function LedgerPage() {
  const [log, setLog] = useState<TodayLogEntry[]>(MOCK_TODAY_LOG);
  const [composerOpen, setComposerOpen] = useState(false);

  function insertEntry(name: string, kcal: number) {
    const now = new Date().toISOString();
    setLog((prev) => [...prev, { id: `l-${Date.now()}`, ate_at: now, dish_name: name, kcal }]);
    setComposerOpen(false);
  }

  const total = log.reduce((s, m) => s + m.kcal, 0);

  return (
    <PrototypeShell title="5. Today Ledger">
      <div className="h-full overflow-y-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)', paddingBottom: '24px' }}>
        <div className="max-w-md mx-auto px-5">
          <header className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-accent font-mono mb-1">today · 5/22</p>
            <h1 className="display-roman text-[32px] leading-none">food <span className="display">·</span> food</h1>
            <p className="text-[10px] text-text-4 font-mono mt-1">入口已併入「今日紀錄」末尾 · 無右上 +</p>
          </header>

          <section className="mb-5 bg-surface border border-hairline rounded-xl px-4 py-3.5">
            <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono mb-1.5">今日攝入</p>
            <p className="text-[22px] font-mono tabular text-text font-medium">
              {total}<span className="text-[12px] text-text-3 ml-1.5">/ 2200 kcal</span>
            </p>
          </section>

          <section>
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3">今日紀錄</p>
            <ul className="space-y-1.5">
              {log.map((m) => (
                <li
                  key={m.id}
                  className="bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-text font-medium truncate">{m.dish_name}</p>
                    <p className="text-[10px] text-text-4 font-mono mt-0.5">{fmtTime(m.ate_at)}</p>
                  </div>
                  <p className="text-[13px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
                </li>
              ))}

              {composerOpen ? (
                <li className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-accent font-mono">新紀錄 · 選或拍</p>
                    <button onClick={() => setComposerOpen(false)} className="text-[11px] text-text-3 hover:text-text active:scale-95">取消</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {MOCK_PRESETS.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => insertEntry(p.name, p.kcal)}
                        className="bg-surface border border-hairline rounded-lg px-2.5 py-2 text-left hover:border-accent/60 active:scale-95 transition-all"
                      >
                        <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
                        <p className="text-[11px] font-mono text-accent tabular">{p.kcal}<span className="text-[8px] text-text-3 ml-0.5">kcal</span></p>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-surface border border-hairline rounded-md px-3 py-2 text-[12px] text-text-2 hover:border-hairline-strong active:scale-95 transition-all">📷 拍照</button>
                    <button className="flex-1 bg-surface border border-hairline rounded-md px-3 py-2 text-[12px] text-text-2 hover:border-hairline-strong active:scale-95 transition-all">+ 新菜單</button>
                  </div>
                </li>
              ) : (
                <li>
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="w-full border-2 border-dashed border-hairline rounded-lg px-3.5 py-4 flex items-center justify-center gap-2 text-text-3 hover:border-accent/60 hover:text-accent active:scale-[0.99] transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="text-[13px] font-mono uppercase tracking-wider">記下一餐</span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </PrototypeShell>
  );
}
