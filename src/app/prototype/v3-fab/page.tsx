'use client';
import { useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockHome } from '../_lib/mock-home';
import { MOCK_PRESETS, MOCK_RECENT_PHOTO } from '../_lib/mock-presets';

type Mode = 'home' | 'open' | 'custom' | 'photo' | 'recent';

export default function FabPage() {
  const [mode, setMode] = useState<Mode>('home');
  const [recordedName, setRecordedName] = useState<string | null>(null);

  function record(name: string) {
    setRecordedName(name);
    setMode('home');
    setTimeout(() => setRecordedName(null), 1500);
  }

  return (
    <PrototypeShell title="3. FAB Quick Actions">
      <div className="h-full relative overflow-hidden">
        {/* 模擬主頁背景，原本主頁右上的 + 在 FAB 方案中拿掉 */}
        {(mode === 'home' || mode === 'open') && (
          <>
            <MockHome scrollPaddingBottom={120} />

            {/* 背景遮罩，open 時加深 */}
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity"
              style={{ opacity: mode === 'open' ? 1 : 0, pointerEvents: mode === 'open' ? 'auto' : 'none' }}
              onClick={() => setMode('home')}
            />

            <SubAction label="自定義" icon="⭐" mode={mode} delay={0.05} offset={170} angleDeg={-90} onClick={() => setMode('custom')} />
            <SubAction label="拍照" icon="📷" mode={mode} delay={0.10} offset={120} angleDeg={-30} onClick={() => setMode('photo')} />
            <SubAction label="近期" icon="🕐" mode={mode} delay={0.15} offset={120} angleDeg={-60} onClick={() => setMode('recent')} />

            <button
              type="button"
              onClick={() => setMode(mode === 'open' ? 'home' : 'open')}
              aria-label="新增餐"
              className="absolute right-6 w-14 h-14 rounded-full bg-accent text-accent-ink flex items-center justify-center shadow-2xl shadow-black/50 active:scale-90 z-20"
              style={{
                bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
                transform: mode === 'open' ? 'rotate(45deg)' : 'rotate(0)',
                transitionProperty: 'transform',
                transitionDuration: '0.2s',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </>
        )}

        {mode === 'custom' && (
          <SubPage title="自定義菜單" onBack={() => setMode('home')}>
            <div className="grid grid-cols-2 gap-2.5 p-5">
              {MOCK_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => record(p.name)}
                  className="bg-surface border border-hairline rounded-xl p-4 text-left hover:border-hairline-strong active:scale-[0.98] transition-all"
                >
                  <p className="text-[14px] text-text font-medium truncate">{p.name}</p>
                  <p className="text-[18px] font-mono text-accent tabular mt-2">{p.kcal}<span className="text-[10px] text-text-3 ml-1">kcal</span></p>
                </button>
              ))}
            </div>
          </SubPage>
        )}
        {mode === 'photo' && (
          <SubPage title="拍照識別" onBack={() => setMode('home')}>
            <div className="h-full flex items-center justify-center p-5">
              <div className="w-full max-w-xs aspect-square border-2 border-dashed border-hairline rounded-2xl flex flex-col items-center justify-center gap-3 text-text-3">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[14px] font-mono">點擊拍照 / 選圖</span>
              </div>
            </div>
          </SubPage>
        )}
        {mode === 'recent' && (
          <SubPage title="近期拍照" onBack={() => setMode('home')}>
            <ul className="p-5 space-y-1.5">
              {MOCK_RECENT_PHOTO.map((m) => (
                <li key={m.meal_id}>
                  <button onClick={() => record(m.dish_name)} className="w-full bg-surface border border-hairline rounded-lg px-3.5 py-3 flex items-center justify-between hover:border-hairline-strong active:scale-[0.99] transition-all">
                    <span className="text-[14px] text-text font-medium">{m.dish_name}</span>
                    <span className="text-[12px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </SubPage>
        )}

        {recordedName && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg z-30">
            已記錄「{recordedName}」
          </div>
        )}
      </div>
    </PrototypeShell>
  );
}

function SubAction({
  label, icon, mode, delay, offset, angleDeg, onClick,
}: {
  label: string;
  icon: string;
  mode: 'home' | 'open';
  delay: number;
  offset: number;
  angleDeg: number;
  onClick: () => void;
}) {
  const rad = (angleDeg * Math.PI) / 180;
  const tx = Math.cos(rad) * offset;
  const ty = Math.sin(rad) * offset;
  const open = mode === 'open';
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-6 w-14 h-14 rounded-full bg-surface-2 border border-hairline flex flex-col items-center justify-center gap-0.5 shadow-xl active:scale-90 z-20"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        transform: open ? `translate(${tx}px, ${ty}px) scale(1)` : 'translate(0, 0) scale(0)',
        opacity: open ? 1 : 0,
        transitionDelay: open ? `${delay}s` : '0s',
        transitionDuration: '0.28s',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionProperty: 'transform, opacity',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <span className="text-[18px] leading-none">{icon}</span>
      <span className="text-[9px] font-mono uppercase tracking-wider text-text-2">{label}</span>
    </button>
  );
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 bg-ink overflow-y-auto z-30"
      style={{ animation: 'ff-slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="px-4 h-12 flex items-center border-b border-hairline">
        <button onClick={onBack} className="flex items-center gap-1.5 text-text-2 hover:text-text active:scale-95">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[12px] font-mono uppercase tracking-wider">返回</span>
        </button>
        <p className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium">{title}</p>
      </header>
      <div>{children}</div>
    </div>
  );
}
