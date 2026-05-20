'use client';
import type { AiMeta } from '@/lib/ai-provider';

export function AiMetaChip({ meta }: { meta: AiMeta }) {
  const fallback = meta.fallbackFrom ? ` · fallback` : '';
  const sec = (meta.durationMs / 1000).toFixed(1);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide bg-surface-2 text-text-3 border border-hairline">
      {meta.provider}{fallback} · {sec}s · ×{meta.attempts}
    </span>
  );
}
