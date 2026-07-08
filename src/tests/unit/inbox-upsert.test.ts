import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: vi.fn() }));

import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureInboxForAdvice } from '@/lib/inbox/upsert';

const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));
beforeEach(() => {
  vi.resetAllMocks();
  upsert.mockResolvedValue({ error: null });
  (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from });
});

describe('ensureInboxForAdvice', () => {
  it('writes weekly inbox with correct type + ref_id + data', async () => {
    await ensureInboxForAdvice('weekly', 'advice-1', 'uid', '2026-05-18', '2026-05-24');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'uid',
        type: 'weekly_advice_ready',
        ref_id: 'weekly:2026-05-18',
        title: '5/18-5/24 週建議已生成',
        data: { type: 'weekly_advice_ready', adviceId: 'advice-1', periodStart: '2026-05-18' },
      }),
      { onConflict: 'user_id,type,ref_id' },
    );
  });

  it('writes monthly inbox correctly', async () => {
    await ensureInboxForAdvice('monthly', 'advice-2', 'uid', '2026-05-01', '2026-05-31');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'monthly_advice_ready', ref_id: 'monthly:2026-05-01' }),
      expect.any(Object),
    );
  });
});
