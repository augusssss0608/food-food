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
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-[min(440px,calc(100%-24px))]"
      >
        {items.map((t) => (
          <ToastBubble key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastBubble({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const stripe = item.kind === 'success' ? 'bg-accent' : item.kind === 'error' ? 'bg-danger' : 'bg-text-3';
  return (
    <div
      role="status"
      className="pointer-events-auto flex gap-3 items-start bg-surface-2/95 backdrop-blur border border-hairline rounded-xl shadow-2xl shadow-black/60 px-4 py-3"
      style={{
        animation: item.closing
          ? 'ff-toast-out 0.2s ease-out forwards'
          : 'ff-toast-in 0.32s var(--ease-spring) both',
      }}
    >
      <span className={`w-1 self-stretch rounded-full ${stripe}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug font-medium text-text">{item.title}</p>
        {item.body && <p className="text-[12px] leading-snug text-text-2 mt-0.5">{item.body}</p>}
      </div>
      <button
        onClick={onClose}
        aria-label="关闭"
        className="text-text-3 hover:text-text transition-colors -mr-1 -mt-1 p-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
