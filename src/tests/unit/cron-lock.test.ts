import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: vi.fn() }));

import { supabaseAdmin } from '@/lib/supabase/admin';
import { tryStartCronRun, finishCronRun } from '@/lib/cron/lock';

const rpc = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ schema: () => ({ rpc }) });
});

describe('tryStartCronRun', () => {
  it('returns true when RPC ok', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await tryStartCronRun('job', 'key:1')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('try_start_cron_run', { p_job_name: 'job', p_run_key: 'key:1', p_lock_seconds: 900 });
  });

  it('returns false when RPC false', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await tryStartCronRun('job', 'key:1')).toBe(false);
  });
});

describe('finishCronRun', () => {
  it('calls RPC with status + result', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await finishCronRun('job', 'key:1', 'finished', { adviceId: 'a' });
    expect(rpc).toHaveBeenCalledWith('finish_cron_run', expect.objectContaining({
      p_job_name: 'job', p_run_key: 'key:1', p_status: 'finished', p_result: { adviceId: 'a' },
    }));
  });
});
