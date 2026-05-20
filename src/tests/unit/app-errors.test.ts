import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: vi.fn(),
}));

import { supabaseAdmin } from '@/lib/supabase/admin';
import { writeAppError } from '@/lib/errors/app-errors';

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
const schema = vi.fn(() => ({ from }));

beforeEach(() => {
  vi.resetAllMocks();
  (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ schema });
});

describe('writeAppError', () => {
  it('writes a row with kind + correlation_id merged into context', async () => {
    insert.mockResolvedValue({ error: null });
    await writeAppError({ kind: 'provider_fallback', correlationId: 'cid-1', context: { primary: 'claude_agent_sdk' } });

    expect(schema).toHaveBeenCalledWith('app_private');
    expect(from).toHaveBeenCalledWith('app_errors');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'provider_fallback',
      context: expect.objectContaining({ correlation_id: 'cid-1', primary: 'claude_agent_sdk' }),
    }));
  });

  it('truncates message to 1000 chars + stack to 4000 chars', async () => {
    insert.mockResolvedValue({ error: null });
    const longMsg = 'm'.repeat(2000);
    const longStack = 's'.repeat(5000);
    await writeAppError({ kind: 'ai_call', message: longMsg, stack: longStack });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      message: 'm'.repeat(1000),
      stack: 's'.repeat(4000),
    }));
  });

  it('handles missing correlationId / context cleanly', async () => {
    insert.mockResolvedValue({ error: null });
    await writeAppError({ kind: 'cron' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'cron',
      context: expect.any(Object),
    }));
  });
});
