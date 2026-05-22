'use client';
import { useEffect, useState } from 'react';

/**
 * 丝滑探索 + 延迟提交：value 变化后，等 delay 毫秒稳定不变才更新 committed。
 * 如果在 delay 内 value 又变了，timer 重置（debounce 行为）。
 *
 * 用法（mode 滚轮 + 右侧 content 延迟切换）：
 *   const exploreIdx = ...        // 实时跟手
 *   const committedIdx = useDelayedCommit(exploreIdx, 1200)
 *   const content = render(committedIdx)
 */
export function useDelayedCommit<T>(value: T, delay = 1200): T {
  const [committed, setCommitted] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setCommitted(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return committed;
}
