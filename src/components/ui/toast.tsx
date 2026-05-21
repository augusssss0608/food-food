'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: string; kind: ToastKind; title: string; body?: string; closing?: boolean };

type ToastApi = {
  show: (kind: ToastKind, title: string, body?: string) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: string) => {
    setItems((cur) => cur.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    setTimeout(() => {
      setItems((cur) => cur.filter((t) => t.id !== id));
      delete timers.current[id];
    }, 220);
  }, []);

  const show = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = crypto.randomUUID();
    setItems((cur) => [...cur, { id, kind, title, body }]);
    timers.current[id] = setTimeout(() => remove(id), 4500);
  }, [remove]);

  const api: ToastApi = {
    show,
    success: (title, body) => show('success', title, body),
    error: (title, body) => show('error', title, body),
    info: (title, body) => show('info', title, body),
  };

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
  }, []);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        data-toast-root
        className="flex flex-col gap-2 pointer-events-none"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top) + 0.75rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          width: 'min(440px, calc(100% - 24px))',
        }}
      >
        {items.map((t) => (
          <ToastBubble key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/**
 * 單個 toast。支持向上滑動關閉（用戶要求，並移除右上角 ✕ 按鈕）：
 * - touchstart 記錄起點 Y
 * - touchmove 跟手上移（向下無視）
 * - touchend 超過閾值 → onClose；否則彈回原位
 */
function ToastBubble({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const stripe = item.kind === 'success' ? 'bg-accent' : item.kind === 'error' ? 'bg-danger' : 'bg-text-3';
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    startY.current = t.clientY;
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return;
    const t = e.touches[0];
    if (!t) return;
    const delta = t.clientY - startY.current;
    // 只跟向上滑（delta < 0）；向下不動
    setDragY(delta < 0 ? delta : 0);
  }
  function onTouchEnd() {
    setDragging(false);
    // 滑超過 40px 視為關閉意圖
    if (dragY < -40) onClose();
    else setDragY(0);
    startY.current = null;
  }

  // closing 動畫優先；正在拖動時也用拖動 transform；其他用入場動畫
  const animation = item.closing
    ? 'ff-toast-out 0.2s ease-out forwards'
    : (dragging ? 'none' : 'ff-toast-in 0.32s var(--ease-spring) both');

  return (
    <div
      role="status"
      className="pointer-events-auto flex gap-3 items-start bg-surface-2/95 backdrop-blur border border-hairline rounded-xl shadow-2xl shadow-black/60 px-4 py-3 select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        animation,
        transform: dragging ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? 'none' : 'transform 0.18s ease-out',
      }}
    >
      <span className={`w-1 self-stretch rounded-full ${stripe}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug font-medium text-text">{item.title}</p>
        {item.body && <p className="text-[12px] leading-snug text-text-2 mt-0.5">{item.body}</p>}
      </div>
    </div>
  );
}
