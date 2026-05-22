'use client';
import { useMemo, useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { RealHomeShell } from '../_lib/real-home';
import { useHomeData } from '../_lib/use-home-data';
import { MockPresetForm, InlineConfirmDialog } from '../_lib/preset-manager';
import type { HomeSnapshot } from '@/lib/home-snapshot';

type Stage = 'closed' | 'quick' | 'all' | 'wizard' | { kind: 'editPreset'; id: string };

export function LedgerContent({ initialSnapshot }: { initialSnapshot: HomeSnapshot }) {
  const api = useHomeData(initialSnapshot);
  const [stage, setStage] = useState<Stage>('closed');
  const [wizName, setWizName] = useState('');
  const [wizKcal, setWizKcal] = useState('');
  const [q, setQ] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) return api.presets;
    const nq = q.trim().toLowerCase();
    return api.presets.filter((p) => p.name.toLowerCase().includes(nq));
  }, [q, api.presets]);

  const editingPreset = typeof stage === 'object' && stage.kind === 'editPreset'
    ? api.presets.find((p) => p.id === stage.id) : undefined;

  function startLongPress() {
    if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setEditMode(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 450);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current != null) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }

  async function pickAndRecord(presetId: string) {
    const preset = api.presets.find((p) => p.id === presetId);
    if (!preset) return;
    const ok = await api.recordCustomPreset(preset);
    if (ok) { setStage('closed'); setQ(''); }
  }

  async function saveNewMenu() {
    const name = wizName.trim();
    const kcal = Number(wizKcal);
    if (!name || !Number.isFinite(kcal) || kcal < 0) return;
    const okAdd = await api.addPreset(name, kcal);
    if (!okAdd) return;
    const newPreset = api.presets.find((p) => p.name === name);
    if (newPreset) await api.recordCustomPreset(newPreset);
    setWizName(''); setWizKcal('');
    setStage('closed');
  }

  // inline composer 作為 todayMealsExtraSlot 注入到 TodayMeals 之後
  const composer = (
    <div className="mt-3">
      {stage === 'closed' && (
        <button
          onClick={() => setStage('quick')}
          className="w-full border-2 border-dashed border-hairline rounded-lg px-3.5 py-4 flex items-center justify-center gap-2 text-text-3 hover:border-accent/60 hover:text-accent active:scale-[0.99] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-[13px] font-mono uppercase tracking-wider">記下一餐</span>
        </button>
      )}

      {stage === 'quick' && (
        <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-accent font-mono">新紀錄 · 常用</p>
            <button onClick={() => setStage('closed')} className="text-[11px] text-text-3 hover:text-text active:scale-95">取消</button>
          </div>
          {api.presets.length === 0 ? (
            <button
              onClick={() => { api.clearDuplicate(); setStage('wizard'); }}
              className="w-full h-10 rounded-lg bg-accent text-accent-ink text-[13px] font-medium active:scale-[0.99] transition-all"
            >
              + 建立第一個菜單
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {api.presets.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => pickAndRecord(p.id)}
                    disabled={api.recordingId === p.id}
                    className="bg-surface border border-hairline rounded-lg px-2.5 py-2 text-left hover:border-accent/60 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <p className="text-[12px] text-text font-medium truncate">{p.name}</p>
                    <p className="text-[11px] font-mono text-accent tabular">{Math.round(p.kcal)}<span className="text-[8px] text-text-3 ml-0.5">kcal</span></p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStage('all')} className="bg-surface border border-hairline rounded-md px-2 py-2 text-[11px] text-text-2 hover:border-hairline-strong active:scale-95 transition-all">
                  📋 全部 ({api.presets.length})
                </button>
                <button
                  onClick={() => { api.clearDuplicate(); setStage('wizard'); }}
                  className="bg-surface border border-hairline rounded-md px-2 py-2 text-[11px] text-text-2 hover:border-hairline-strong active:scale-95 transition-all"
                >
                  + 新菜單
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'all' && (
        <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-accent font-mono">全部 {api.presets.length} 個菜單</p>
            <div className="flex items-center gap-3">
              {editMode ? (
                <button onClick={() => setEditMode(false)} className="text-[11px] text-accent font-mono uppercase tracking-wider active:scale-95">完成</button>
              ) : (
                <button
                  onClick={() => { api.clearDuplicate(); setStage('wizard'); }}
                  aria-label="新增菜單"
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-surface border border-hairline text-text-2 hover:border-accent/60 hover:text-accent active:scale-95 transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              )}
              <button onClick={() => { setStage('quick'); setEditMode(false); }} className="text-[11px] text-text-3 hover:text-text active:scale-95">← 返回</button>
            </div>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋..."
            className="w-full h-10 px-3 mb-2 rounded-lg bg-surface border border-hairline text-[13px] text-text placeholder:text-text-4 outline-none focus:border-accent/60"
          />
          {!editMode && <p className="text-[9px] text-text-4 font-mono mb-1.5">長按列表項可進入編輯模式</p>}
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {filtered.map((p, i) => {
              const wiggle = editMode ? (i % 2 === 0 ? 'ff-wiggle-a 0.32s ease-in-out infinite' : 'ff-wiggle-b 0.32s ease-in-out infinite') : undefined;
              return (
                <div key={p.id} className="relative" style={{ animation: wiggle }}>
                  <button
                    onClick={() => editMode ? (api.clearDuplicate(), setStage({ kind: 'editPreset', id: p.id })) : pickAndRecord(p.id)}
                    onPointerDown={() => !editMode && startLongPress()}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={api.recordingId === p.id}
                    className="w-full bg-surface border border-hairline rounded-lg px-3 py-2 flex items-center justify-between hover:border-accent/60 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    <span className="text-[12px] text-text truncate">{p.name}</span>
                    <span className="text-[11px] font-mono text-accent tabular">{Math.round(p.kcal)}</span>
                  </button>
                  {editMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                      aria-label={`刪除 ${p.name}`}
                      className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stage === 'wizard' && (
        <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-accent font-mono">新菜單</p>
            <button onClick={() => setStage('quick')} className="text-[11px] text-text-3 hover:text-text active:scale-95">取消</button>
          </div>
          <div className="space-y-2">
            <input
              value={wizName}
              onChange={(e) => setWizName(e.target.value)}
              placeholder="菜名（必填）"
              maxLength={50}
              className="w-full h-10 px-3 rounded-lg bg-surface border border-hairline text-[13px] text-text outline-none focus:border-accent/60"
            />
            <input
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
              disabled={!wizName.trim() || !wizKcal || api.presetBusy}
              className="w-full h-10 rounded-lg bg-accent text-accent-ink text-[13px] font-medium disabled:bg-surface-3 disabled:text-text-3 active:scale-[0.99] transition-all"
            >
              {api.presetBusy ? '保存中…' : '保存並加入今日'}
            </button>
            {api.duplicateName && <p className="text-[11px] text-danger text-center">已存在同名菜單，請改名</p>}
          </div>
        </div>
      )}

      {typeof stage === 'object' && stage.kind === 'editPreset' && (
        <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-accent font-mono">編輯菜單</p>
            <button onClick={() => setStage('all')} className="text-[11px] text-text-3 hover:text-text active:scale-95">← 返回</button>
          </div>
          <MockPresetForm
            initial={editingPreset ? { name: editingPreset.name, kcal: editingPreset.kcal } : undefined}
            submitLabel="保存"
            onSubmit={async (name, kcal) => {
              if (typeof stage === 'object') {
                const ok = await api.updatePreset(stage.id, name, kcal);
                if (ok) setStage('all');
              }
            }}
            onCancel={() => setStage('all')}
          />
          {api.duplicateName && <p className="text-[11px] text-danger mt-2 text-center">已存在同名菜單，請改名</p>}
        </div>
      )}
    </div>
  );

  return (
    <PrototypeShell title="2. Today Ledger">
      <RealHomeShell
        api={api}
        rightAction={null}
        todayMealsExtraSlot={composer}
      />
      <InlineConfirmDialog
        open={deleteId != null}
        title="刪除這個菜單？"
        body={deleteId ? <span>將永久移除「<span className="text-text font-medium">{api.presets.find((p) => p.id === deleteId)?.name}</span>」。</span> : null}
        confirmText="刪除"
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await api.deletePreset(deleteId); setDeleteId(null); }}
      />
    </PrototypeShell>
  );
}
