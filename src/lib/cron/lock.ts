import { supabaseAdmin } from '@/lib/supabase/admin';

export async function tryStartCronRun(jobName: string, runKey: string, lockSeconds = 900): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .schema('app_private')
    .rpc('try_start_cron_run', { p_job_name: jobName, p_run_key: runKey, p_lock_seconds: lockSeconds });
  if (error) throw error;
  return data === true;
}

export async function finishCronRun(
  jobName: string, runKey: string,
  status: 'finished' | 'failed', result: Record<string, unknown> = {},
): Promise<void> {
  await supabaseAdmin().schema('app_private').rpc('finish_cron_run', {
    p_job_name: jobName, p_run_key: runKey, p_status: status, p_result: result,
  });
}
