import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { DebugSecretGate } from '@/components/debug-secret-gate';
import { Card } from '@/components/ui/card';
import { PageShell } from '@/components/ui/page-shell';

export const dynamic = 'force-dynamic';

type AiCallRow = {
  id: string; correlation_id?: string | null; kind: string; trigger: string; provider: string;
  status: string; attempt?: number | null; latency_ms?: number | null;
  estimated_cost_usd?: number | null; started_at?: string | null;
};
type AppErrorRow = { id: string; kind: string; occurred_at?: string | null; message?: string | null };
type CronRunRow = {
  job_name: string; run_key: string; status?: string | null;
  started_at?: string | null; finished_at?: string | null
};

export default async function AdminDebugPage() {
  const cookieStore = await cookies();
  const ok = cookieStore.get('food_food_dev_secret_ok')?.value === '1';
  if (!ok) return <DebugSecretGate />;

  const supa = supabaseAdmin();
  const [aiCallsRes, appErrorsRes, budgetDailyRes, budgetMonthlyRes, cronRunsRes] = await Promise.all([
    supa.schema('app_private').from('ai_calls').select('*').order('started_at', { ascending: false }).limit(50),
    supa.schema('app_private').from('app_errors').select('*').order('occurred_at', { ascending: false }).limit(50),
    supa.schema('app_private').from('ai_budget_daily').select('*').order('usage_date', { ascending: false }).limit(7),
    supa.schema('app_private').from('ai_budget_monthly_fallback').select('*').order('usage_month', { ascending: false }).limit(3),
    supa.schema('app_private').from('cron_runs').select('*').order('started_at', { ascending: false }).limit(30),
  ]);

  const aiCalls = (aiCallsRes.data ?? []) as AiCallRow[];
  const appErrors = (appErrorsRes.data ?? []) as AppErrorRow[];
  const cronRuns = (cronRunsRes.data ?? []) as CronRunRow[];

  return (
    <PageShell wide topAlign>
      <header className="mb-10">
        <Link
          href="/"
          prefetch
          className="inline-flex items-center text-[13px] text-text-3 hover:text-text transition-colors mb-4 -ml-1"
        >
          ← 主頁
        </Link>
        <p className="text-[11px] uppercase tracking-[0.24em] text-warm font-mono mb-1">restricted · admin</p>
        <h1 className="display-roman text-[32px] leading-none">debug</h1>
      </header>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Stat label="AI calls (50)" value={String(aiCalls.length)} />
        <Stat label="Errors (50)" value={String(appErrors.length)} accent={appErrors.length > 0 ? 'warm' : undefined} />
        <Stat label="Cron runs (30)" value={String(cronRuns.length)} />
        <Stat
          label="Budget rows"
          value={String((budgetDailyRes.data?.length ?? 0) + (budgetMonthlyRes.data?.length ?? 0))}
        />
      </div>

      <Section title="最近 50 條 AI 呼叫">
        <Table
          headers={['correlation_id', 'kind', 'trigger', 'provider', 'status', 'attempt', 'latency_ms', 'cost($)', 'started_at']}
          rows={aiCalls.map((r) => ({
            highlight: r.provider !== 'anthropic_api' && r.provider !== 'mock',
            cells: [
              <span key="c" className="font-mono text-[10px] text-text-3">{r.correlation_id?.slice(0, 8)}</span>,
              r.kind,
              r.trigger,
              r.provider,
              <StatusPill key="s" status={r.status} />,
              r.attempt ?? '—',
              r.latency_ms ?? '—',
              r.estimated_cost_usd ?? '—',
              <span key="t" className="font-mono text-[11px] text-text-3 tabular">{r.started_at?.slice(0, 19)}</span>,
            ],
          }))}
          empty="無 AI 呼叫記錄"
        />
      </Section>

      <Section title="最近 50 條錯誤日誌">
        {appErrors.length === 0 ? (
          <Empty>無錯誤，好事</Empty>
        ) : (
          <ul className="space-y-2">
            {appErrors.map((e) => (
              <Card key={e.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-block w-1 h-8 rounded-full bg-danger/70 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-danger font-mono">{e.kind}</span>
                      <span className="text-[10px] font-mono text-text-3 tabular">{e.occurred_at?.slice(0, 19)}</span>
                    </div>
                    <p className="text-[13px] text-text-2 break-all leading-snug">{e.message?.slice(0, 200)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      <Section title="預算">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-3 font-mono mb-2">daily (last 7)</p>
            <pre className="text-[11px] text-text-2 font-mono overflow-x-auto">{JSON.stringify(budgetDailyRes.data, null, 2)}</pre>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-3 font-mono mb-2">monthly fallback</p>
            <pre className="text-[11px] text-text-2 font-mono overflow-x-auto">{JSON.stringify(budgetMonthlyRes.data, null, 2)}</pre>
          </Card>
        </div>
      </Section>

      <Section title="Cron Runs(最近 30 條)">
        <Table
          headers={['job_name', 'run_key', 'status', 'started_at', 'finished_at']}
          rows={cronRuns.map((r) => ({
            highlight: r.status === 'failed',
            cells: [
              r.job_name,
              <span key="rk" className="font-mono text-[11px]">{r.run_key}</span>,
              <StatusPill key="s" status={r.status ?? '—'} />,
              <span key="s1" className="font-mono text-[11px] text-text-3 tabular">{r.started_at?.slice(0, 19)}</span>,
              <span key="s2" className="font-mono text-[11px] text-text-3 tabular">{r.finished_at?.slice(0, 19) ?? '—'}</span>,
            ],
          }))}
          empty="還沒跑過 cron"
        />
      </Section>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-text-3 font-mono mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'warm' }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-3 font-mono mb-1.5">{label}</p>
      <p className={`text-[28px] font-mono tabular leading-none ${accent === 'warm' ? 'text-warm' : 'text-text'}`}>{value}</p>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const c =
    status === 'succeeded' || status === 'finished' ? 'bg-success/15 text-success border-success/30' :
    status === 'failed' ? 'bg-danger/15 text-danger border-danger/30' :
    status === 'started' || status === 'running' ? 'bg-accent/15 text-accent border-accent/30' :
    'bg-surface-3 text-text-3 border-hairline';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wide border ${c}`}>
      {status}
    </span>
  );
}

function Table({
  headers, rows, empty,
}: {
  headers: string[];
  rows: { highlight?: boolean; cells: React.ReactNode[] }[];
  empty: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-hairline">
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-[0.14em] text-text-3 font-mono font-normal whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-hairline last:border-0 ${r.highlight ? 'bg-warm/5' : ''}`}>
              {r.cells.map((c, j) => (
                <td key={j} className="px-3 py-2.5 text-text-2 align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-text-3 text-[13px]">{children}</p>
    </Card>
  );
}
