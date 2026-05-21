import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/page-header';

type InboxRow = {
  id: string;
  type: 'weekly_advice_ready' | 'monthly_advice_ready' | 'body_metrics_overdue';
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<InboxRow['type'], string> = {
  weekly_advice_ready: 'WEEKLY',
  monthly_advice_ready: 'MONTHLY',
  body_metrics_overdue: 'REMINDER',
};

export default async function InboxPage() {
  const supa = await createSupabaseServerClient();
  const { data } = await supa.from('inbox').select('*').order('created_at', { ascending: false }).limit(50);
  const items = (data ?? []) as InboxRow[];

  return (
    <PageShell>
        <PageHeader>
          <p className="text-[11px] uppercase tracking-[0.24em] text-text-3 font-mono mb-1">inbox</p>
          <h1 className="display-roman text-[32px] leading-none">通知</h1>
        </PageHeader>

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2.5">
            {items.map((it, i) => (
              <li key={it.id} style={{ animation: `ff-enter 0.45s var(--ease-out-soft) both`, animationDelay: `${i * 35}ms` }}>
                <Card className={`p-4 ${it.read_at ? 'opacity-55' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        'mt-1 inline-block w-1 h-12 rounded-full flex-shrink-0',
                        it.read_at ? 'bg-text-4' : 'bg-accent',
                      ].join(' ')}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-accent font-mono">
                          {TYPE_LABEL[it.type]}
                        </span>
                        <time className="text-[10px] uppercase text-text-4 font-mono tabular">
                          {new Date(it.created_at).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}
                        </time>
                      </div>
                      <h3 className="text-[15px] font-medium text-text leading-snug">{it.title}</h3>
                      {it.body && (
                        <p className="text-[13px] text-text-2 leading-relaxed mt-1">{it.body}</p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-surface mx-auto mb-5 flex items-center justify-center border border-hairline">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-3">
          <path d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="display text-[24px] text-text-2">什麼都沒發生</p>
      <p className="text-[13px] text-text-3 mt-2">每週/每月建議生成後會出現在這裡</p>
    </div>
  );
}
