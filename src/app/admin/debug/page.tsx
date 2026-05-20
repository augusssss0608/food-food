import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { DebugSecretGate } from '@/components/debug-secret-gate';

export const dynamic = 'force-dynamic';

type AiCallRow = {
  id: string; correlation_id?: string | null; kind: string; trigger: string; provider: string;
  status: string; attempt?: number | null; latency_ms?: number | null;
  estimated_cost_usd?: number | null; started_at?: string | null;
};
type AppErrorRow = { id: string; kind: string; occurred_at?: string | null; message?: string | null };
type CronRunRow = { job_name: string; run_key: string; status?: string | null; started_at?: string | null; finished_at?: string | null };

export default async function AdminDebugPage() {
  const cookieStore = await cookies();
  const ok = cookieStore.get('food_food_dev_secret_ok')?.value === '1';
  if (!ok) {
    return <DebugSecretGate />;
  }

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
    <main className="p-4 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">/admin/debug</h1>

      <section>
        <h2 className="font-semibold">最近 50 条 AI 调用</h2>
        <table className="w-full text-xs border">
          <thead><tr className="bg-gray-100">{['correlation_id','kind','trigger','provider','status','attempt','latency_ms','cost($)','started_at'].map(h => <th key={h} className="p-1 border">{h}</th>)}</tr></thead>
          <tbody>
            {aiCalls.map((r) => (
              <tr key={r.id} className={r.provider !== 'anthropic_api' && r.provider !== 'mock' ? 'bg-amber-50' : ''}>
                <td className="p-1 border font-mono text-[10px]">{r.correlation_id?.slice(0, 8)}</td>
                <td className="p-1 border">{r.kind}</td>
                <td className="p-1 border">{r.trigger}</td>
                <td className="p-1 border">{r.provider}</td>
                <td className="p-1 border">{r.status}</td>
                <td className="p-1 border">{r.attempt}</td>
                <td className="p-1 border">{r.latency_ms}</td>
                <td className="p-1 border">{r.estimated_cost_usd}</td>
                <td className="p-1 border">{r.started_at?.slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold">最近 50 条错误日志</h2>
        <ul className="space-y-1 text-xs">
          {appErrors.map((e) => (
            <li key={e.id} className={`border p-2 ${e.kind === 'oauth_token_expired' ? 'bg-red-50' : ''}`}>
              <span className="font-mono">{e.kind}</span> · {e.occurred_at?.slice(0, 19)} · {e.message?.slice(0, 100)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">预算状态</h2>
        <div className="text-sm">
          <div>今日 daily budget:</div>
          <pre>{JSON.stringify(budgetDailyRes.data, null, 2)}</pre>
          <div>本月 fallback monthly cap:</div>
          <pre>{JSON.stringify(budgetMonthlyRes.data, null, 2)}</pre>
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Cron Runs (最近 30 条)</h2>
        <table className="w-full text-xs border">
          <thead><tr className="bg-gray-100">{['job_name','run_key','status','started_at','finished_at'].map(h => <th key={h} className="p-1 border">{h}</th>)}</tr></thead>
          <tbody>
            {cronRuns.map((r, i) => (
              <tr key={i} className={r.status === 'failed' ? 'bg-red-50' : ''}>
                <td className="p-1 border">{r.job_name}</td>
                <td className="p-1 border">{r.run_key}</td>
                <td className="p-1 border">{r.status}</td>
                <td className="p-1 border">{r.started_at?.slice(0, 19)}</td>
                <td className="p-1 border">{r.finished_at?.slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
