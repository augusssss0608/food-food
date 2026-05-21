'use client';
import { useMemo, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MockToast, useMockTodayLog } from '../_lib/mock-home';
import { MOCK_PRESETS } from '../_lib/mock-presets';

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

type Stage = 'closed' | 'quick' | 'all' | 'wizard' | 'photo';

export default function LedgerPage() {
  const { log, addEntry } = useMockTodayLog();
  const [stage, setStage] = useState<Stage>('closed');
  const [toast, setToast] = useState<string | null>(null);

  // wizard 表單
  const [wizName, setWizName] = useState('');
  const [wizKcal, setWizKcal] = useState('');

  // all 列表搜索
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return MOCK_PRESETS;
    const nq = q.trim().toLowerCase();
    return MOCK_PRESETS.filter((p) => p.name.toLowerCase().includes(nq));
  }, [q]);

  function recordPreset(name: string, kcal: number) {
    addEntry(name, kcal);
    setToast(`已記錄「${name}」`);
    setTimeout(() => setToast(null), 1800);
    setStage('closed');
    setQ('');
  }

  function saveNewMenu() {
    const name = wizName.trim();
    const kcal = Number(wizKcal);
    if (!name || !Number.isFinite(kcal) || kcal < 0) return;
    recordPreset(name, kcal);
    setWizName('');
    setWizKcal('');
  }

  const total = log.reduce((s, m) => s + m.kcal, 0);

  return (
    <PrototypeShell title="5. Today Ledger">
      <div className="h-full overflow-y-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
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
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono mb-3">今日紀錄 · {log.length} 筆</p>
            <ul className="space-y-1.5">
              {log.map((m) => (
                <li key={m.id} className="bg-surface border border-hairline rounded-lg px-3.5 py-2.5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-text font-medium truncate">{m.dish_name}</p>
                    <p className="text-[10px] text-text-4 font-mono mt-0.5">{fmtTime(m.ate_at)}</p>
                  </div>
                  <p className="text-[13px] font-mono text-accent tabular">{m.kcal}<span className="text-[9px] text-text-3 ml-0.5">kcal</span></p>
                </li>
              ))}

              {/* inline composer 各階段 */}
              {stage === 'closed' && (
                <li>
                  <button
                    onClick={() => setStage('quick')}
                    className="w-full border-2 border-dashed border-hairline rounded-lg px-3.5 py-4 flex items-center justify-center gap-2 text-text-3 hover:border-accent/60 hover:text-accent active:scale-[0.99] transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="text-[13px] font-mono uppercase tracking-wider">記下一餐</span>
                  </button>
                </li>
              )}

              {stage === 'quick' && (
                <li className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-accent font-mono">新紀錄 · 常用 6 個</p>
                    <button onClick={() => setStage('closed')} className="text-[11px] text-text-3 hover:text-text active:scale-95">取消</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {MOCK_PRESETS.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => recordPreset(p.name, p.kcal)}
                        className="bg-surface border border-hairline rounded-lg px-2.5 py-2 text-left hover:border-accent/60 active:scale-95 transition-all"
                      >
                        <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
                        <p className="text-[11px] font-mono text-accent tabular">{p.kcal}<span className="text-[8px] text-text-3 ml-0.5">kcal</span></p>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setStage('all')} className="bg-surface border border-hairline rounded-md px-2 py-2 text-[11px] text-text-2 hover:border-hairline-strong active:scale-95 transition-all">
                      📋 全部
                    </button>
                    <button onClick={() => setStage('photo')} className="bg-surface border border-hairline rounded-md px-2 py-2 text-[11px] text-text-2 hover:border-hairline-strong active:scale-95 transition-all">
                      📷 拍照
                    </button>
                    <button onClick={() => setStage('wizard')} className="bg-surface border border-hairline rounded-md px-2 py-2 text-[11px] text-text-2 hover:border-hairline-strong active:scale-95 transition-all">
                      + 新菜單
                    </button>
                  </div>
                </li>
              )}

              {stage === 'all' && (
                <li className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-accent font-mono">全部 {MOCK_PRESETS.length} 個菜單</p>
                    <button onClick={() => setStage('quick')} className="text-[11px] text-text-3 hover:text-text active:scale-95">← 返回</button>
                  </div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="搜尋..."
                    className="w-full h-10 px-3 mb-2 rounded-lg bg-surface border border-hairline text-[13px] text-text placeholder:text-text-4 outline-none focus:border-accent/60"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {filtered.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => recordPreset(p.name, p.kcal)}
                        className="w-full bg-surface border border-hairline rounded-lg px-3 py-2 flex items-center justify-between hover:border-accent/60 active:scale-[0.99] transition-all"
                      >
                        <span className="text-[12px] text-text truncate">{p.name}</span>
                        <span className="text-[11px] font-mono text-accent tabular">{p.kcal}</span>
                      </button>
                    ))}
                  </div>
                </li>
              )}

              {stage === 'wizard' && (
                <li className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-accent font-mono">新菜單</p>
                    <button onClick={() => setStage('quick')} className="text-[11px] text-text-3 hover:text-text active:scale-95">取消</button>
                  </div>
                  <div className="space-y-2">
                    <input
                      name="preset-name"
                      aria-label="菜名"
                      value={wizName}
                      onChange={(e) => setWizName(e.target.value)}
                      placeholder="菜名（必填）"
                      maxLength={50}
                      className="w-full h-10 px-3 rounded-lg bg-surface border border-hairline text-[13px] text-text outline-none focus:border-accent/60"
                    />
                    <input
                      name="preset-kcal"
                      aria-label="熱量"
                      type="number"
                      inputMode="numeric"
                      value={wizKcal}
                      onChange={(e) => setWizKcal(e.target.value)}
                      placeholder="熱量 kcal（必填）"
                      min={0}
                      max={5000}
                      className="w-full h-10 px-3 rounded-lg bg-surface border border-hairline text-[13px] text-text outline-none focus:border-accent/60"
                    />
                    <button
                      onClick={saveNewMenu}
                      disabled={!wizName.trim() || !wizKcal}
                      className="w-full h-10 rounded-lg bg-accent text-accent-ink text-[13px] font-medium disabled:bg-surface-3 disabled:text-text-3 active:scale-[0.99] transition-all"
                    >
                      保存並加入今日
                    </button>
                  </div>
                </li>
              )}

              {stage === 'photo' && (
                <li className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-accent font-mono">拍照</p>
                    <button onClick={() => setStage('quick')} className="text-[11px] text-text-3 hover:text-text active:scale-95">取消</button>
                  </div>
                  <button
                    onClick={() => recordPreset('拍照識別餐', 420)}
                    className="w-full aspect-square border-2 border-dashed border-hairline rounded-2xl flex flex-col items-center justify-center gap-2 text-text-3 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className="text-[12px] font-mono uppercase tracking-wider">點擊模擬識別</span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
      <MockToast text={toast} />
    </PrototypeShell>
  );
}
