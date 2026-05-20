'use client';
import type { AiMeta } from '@/lib/ai-provider';

export function AiMetaChip({ meta }: { meta: AiMeta }) {
  const fallback = meta.fallbackFrom ? ` (fallback from ${meta.fallbackFrom})` : '';
  const sec = (meta.durationMs / 1000).toFixed(1);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
      {meta.provider}{fallback} · {sec}s · {meta.attempts} attempt{meta.attempts > 1 ? 's' : ''}
    </span>
  );
}
