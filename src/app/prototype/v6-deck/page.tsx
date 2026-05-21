'use client';
import { useRef, useState } from 'react';
import { PrototypeShell } from '../_lib/prototype-shell';
import { MOCK_PRESETS } from '../_lib/mock-presets';

const SWIPE_THRESHOLD = 80;

export default function DeckPage() {
  const [idx, setIdx] = useState(0);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [exiting, setExiting] = useState<'right' | 'left' | 'up' | 'down' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const card = MOCK_PRESETS[idx];

  function nextCard() {
    setIdx((i) => Math.min(MOCK_PRESETS.length - 1, i + 1));
  }
  function prevCard() {
    setIdx((i) => Math.max(0, i - 1));
  }
  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 1500);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1 || exiting) return;
    startRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!startRef.current) return;
    setDx(e.touches[0]!.clientX - startRef.current.x);
    setDy(e.touches[0]!.clientY - startRef.current.y);
  }
  function onTouchEnd() {
    if (!startRef.current) return;
    startRef.current = null;
    const absX = Math.abs(dx), absY = Math.abs(dy);

    if (absX > SWIPE_THRESHOLD && absX > absY) {
      const dir = dx > 0 ? 'right' : 'left';
      setExiting(dir);
      setTimeout(() => {
        if (dir === 'right') {
          showToast(`已記錄「${card!.name}」`);
        }
        setExiting(null);
        setDx(0); setDy(0);
        if (dir === 'right') nextCard();
        else nextCard();
      }, 250);
    } else if (absY > SWIPE_THRESHOLD && absY > absX) {
      const dir = dy < 0 ? 'up' : 'down';
      setExiting(dir);
      setTimeout(() => {
        if (dir === 'up') showToast('進入拍照模式');
        if (dir === 'down') showToast('進入管理模式');
        setExiting(null);
        setDx(0); setDy(0);
      }, 250);
    } else {
      setDx(0); setDy(0);
    }
  }

  if (!card) {
    return (
      <PrototypeShell title="6. Swipe Deck">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-[15px] text-text-3 mb-3">沒有更多菜單了</p>
            <button onClick={() => setIdx(0)} className="text-[12px] text-accent font-mono uppercase tracking-wider active:scale-95">
              重新開始
            </button>
          </div>
        </div>
      </PrototypeShell>
    );
  }

  // 出場 transform
  let exitTx = 0, exitTy = 0, exitRot = 0;
  if (exiting === 'right') { exitTx = 500; exitRot = 25; }
  if (exiting === 'left') { exitTx = -500; exitRot = -25; }
  if (exiting === 'up') exitTy = -700;
  if (exiting === 'down') exitTy = 700;

  const tx = exiting ? exitTx : dx;
  const ty = exiting ? exitTy : dy;
  const rot = exiting ? exitRot : dx / 14;

  // 提示變顏色 + 滑動方向
  const hint =
    Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? { text: '記錄 →', color: 'rgb(74, 222, 128)' } : { text: '← 跳過', color: 'rgb(255, 122, 69)' })
      : Math.abs(dy) > 30
        ? (dy < 0 ? { text: '↑ 拍照', color: 'rgb(96, 165, 250)' } : { text: '↓ 管理', color: 'rgb(200, 255, 0)' })
        : null;

  return (
    <PrototypeShell title="6. Swipe Deck">
      <div className="h-full flex flex-col items-center justify-center p-6 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 60px)' }}>
        <p className="text-[10px] uppercase tracking-wider text-text-3 font-mono mb-2">
          {idx + 1} / {MOCK_PRESETS.length}
        </p>

        {/* 下一張預覽（疊在下面） */}
        {MOCK_PRESETS[idx + 1] && (
          <div className="absolute w-[280px] h-[380px] bg-surface border border-hairline rounded-3xl pointer-events-none"
            style={{ transform: 'scale(0.95) translateY(8px)', opacity: 0.45 }} />
        )}

        {/* 當前卡片 */}
        <div
          className="w-[280px] h-[380px] bg-surface-2 border border-hairline rounded-3xl shadow-2xl shadow-black/40 flex flex-col items-center justify-center p-8 select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          style={{
            transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
            transition: exiting ? 'transform 0.25s ease-out' : startRef.current ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <p className="text-[11px] uppercase tracking-wider text-text-3 font-mono mb-4">menu</p>
          <h2 className="text-[28px] font-medium text-text text-center leading-tight mb-3">{card.name}</h2>
          <p className="text-[40px] font-mono text-accent tabular leading-none mb-6">
            {card.kcal}<span className="text-[14px] text-text-3 ml-1.5">kcal</span>
          </p>
          <div className="flex gap-4 text-[11px] font-mono text-text-3 tabular">
            <span>P {card.protein_g}</span>
            <span>C {card.carb_g}</span>
            <span>F {card.fat_g}</span>
          </div>
        </div>

        {/* 方向提示 overlay */}
        {hint && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-2 rounded-full border-2 font-mono uppercase tracking-widest text-[14px] pointer-events-none"
            style={{ color: hint.color, borderColor: hint.color, transform: `translate(-50%, -50%) rotate(${dx > 0 ? 10 : -10}deg)` }}
          >
            {hint.text}
          </div>
        )}

        {/* 底部提示 */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono text-text-3">
          <span className="text-right">← 跳過</span>
          <span>記錄 →</span>
          <span className="text-right">↑ 拍照</span>
          <span>↓ 管理</span>
        </div>

        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-accent text-accent-ink px-5 py-2.5 rounded-full text-[13px] font-medium shadow-lg z-10">
            {toast}
          </div>
        )}
      </div>
    </PrototypeShell>
  );
}
