'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome, MockSheet, PlusButton } from '../_lib/mock-home';
import { MOCK_PRESETS, MOCK_RECENT_PHOTO } from '../_lib/mock-presets';

type Tab = 'custom' | 'recent' | 'photo';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'custom', label: '自定義', icon: '⭐' },
  { key: 'recent', label: '近期', icon: '🕐' },
  { key: 'photo', label: '拍照', icon: '📷' },
];

export default function TabsPage() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('custom');
  const [recordedName, setRecordedName] = useState<string | null>(null);
  const startX = useRef<number | null>(null);

  function record(name: string) {
    setRecordedName(name);
    setOpen(false);
    setTimeout(() => setRecordedName(null), 1500);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0]!.clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current == null) return;
    const dx = e.changedTouches[0]!.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = TABS.findIndex((t) => t.key === tab);
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1]!.key);
    if (dx > 0 && idx > 0) setTab(TABS[idx - 1]!.key);
  }

  return (
    <PrototypeShell title="2. 底部 Tab 切換">
      <MockHome rightAction={<PlusButton onClick={() => setOpen(true)} />} />

      <MockSheet open={open} onClose={() => setOpen(false)} title="新增餐">
        <div className="h-full flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="flex-1 overflow-hidden relative">
            <div
              className="absolute inset-0 flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${TABS.findIndex((t) => t.key === tab) * 100}%)`, width: `${TABS.length * 100}%` }}
            >
              {TABS.map((t) => (
                <div key={t.key} className="w-full flex-shrink-0 overflow-y-auto px-4 py-4" style={{ width: `${100 / TABS.length}%` }}>
                  {t.key === 'custom' && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-2.5">{MOCK_PRESETS.length} 個菜單</p>
                      <div className="grid grid-cols-2 gap-2">
                        {MOCK_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => record(p.name)}
                            className="bg-surface border border-hairline rounded-xl p-3.5 text-left hover:border-hairline-strong active:scale-[0.98] transition-all"
                          >
                            <p className="text-[13px] text-text font-medium leading-tight truncate">{p.name}</p>
                            <p className="text-[17px] font-mono text-accent tabular mt-1.5 leading-none">
                              {p.kcal}<span className="text-[9px] text-text-3 ml-1">kcal</span>
                            </p>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {t.key === 'recent' && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-2.5">近 30 天拍照</p>
                      <ul className="space-y-1.5">
                        {MOCK_RECENT_PHOTO.map((m) => (
                          <li key={m.meal_id}>
                            <button
                              onClick={() => record(m.dish_name)}
                              className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between hover:border-hairline-strong active:scale-[0.99] transition-all"
                            >
                              <span className="text-[13px] text-text font-medium truncate">{m.dish_name}</span>
                              <span className="text-[12px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {t.key === 'photo' && (
                    <div className="h-full flex items-center justify-center pt-2">
                      <button className="w-full aspect-square max-w-[280px] border-2 border-dashed border-hairline rounded-2xl flex flex-col items-center justify-center gap-3 text-text-3 hover:border-accent/60 hover:text-accent active:scale-95 transition-all">
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span className="text-[13px] font-mono uppercase tracking-wider">拍照識別</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <nav className="flex-shrink-0 grid grid-cols-3 border-t border-hairline bg-surface-2/95 backdrop-blur">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={[
                    'h-13 py-2 flex flex-col items-center justify-center gap-0.5 transition-colors',
                    active ? 'text-accent' : 'text-text-3 hover:text-text-2',
                  ].join(' ')}
                >
                  <span className="text-[17px] leading-none">{t.icon}</span>
                  <span className="text-[9px] font-mono uppercase tracking-wider">{t.label}</span>
                </button>
              );
            })}
          </nav>
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
