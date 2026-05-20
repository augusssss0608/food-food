'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiMeta } from '@/lib/ai-provider';

export function useAiCall<T extends { _meta: AiMeta }>(fn: () => Promise<T>) {
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const call = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    startRef.current = performance.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      if (startRef.current != null) {
        setElapsed((performance.now() - startRef.current) / 1000);
      }
    }, 100);
    try {
      const r = await fn();
      setResult(r);
    } catch (e: unknown) {
      setError(e as Error);
    } finally {
      setLoading(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      startRef.current = null;
    }
  }, [fn]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  return { call, loading, elapsed, result, error, meta: result?._meta ?? null };
}
