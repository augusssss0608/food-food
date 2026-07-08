'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export type WeeklyAdvice = {
  content_md: string;
  generated_at: string | null;
  stale: boolean | null;
};

export function WeeklyAdviceSection({
  weekLabel,
  isCurrentWeek,
  advice,
  timezone,
}: {
  weekLabel: string;
  isCurrentWeek: boolean;
  advice: WeeklyAdvice | null;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const weekWord = isCurrentWeek ? '本週' : '該週';

  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-3 font-mono">
          AI 週建議 · {weekLabel}
        </p>
        {open && advice?.stale && (
          <p className="text-[10px] text-warm font-mono uppercase tracking-wide">已過時</p>
        )}
      </div>
      {!open ? (
        <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
          查看{weekWord}建議
        </Button>
      ) : advice ? (
        <Card className="px-4 py-4">
          <pre className="text-[13px] text-text-2 leading-relaxed whitespace-pre-wrap break-words font-sans">
            {advice.content_md}
          </pre>
          {advice.generated_at && (
            <p className="text-[10px] text-text-4 font-mono tabular mt-3">
              生成於 {new Date(advice.generated_at).toLocaleString('zh-TW', { timeZone: timezone })}
            </p>
          )}
        </Card>
      ) : (
        <Card className="px-5 py-6 text-center">
          <p className="text-[13px] text-text-3">
            {isCurrentWeek ? '本週建議尚未生成，週日晚間自動生成' : '該週建議尚未生成'}
          </p>
        </Card>
      )}
    </section>
  );
}
