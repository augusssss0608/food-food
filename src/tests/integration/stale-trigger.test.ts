import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';

const supa = createTestAdminClient();

beforeEach(async () => {
  await supa.from('meals').delete().eq('user_id', OWNER_UID);
  await supa.from('advice').delete().eq('user_id', OWNER_UID);
});

describe('mark_advice_stale_for_meal trigger', () => {
  it('INSERT meal marks current weekly advice stale', async () => {
    await supa.from('advice').insert({
      user_id: OWNER_UID, kind: 'weekly', period_start: '2026-05-18', period_end: '2026-05-24',
      period_timezone: 'Asia/Tokyo', content_md: '...', stale: false,
    } as never);
    await supa.from('meals').insert({
      user_id: OWNER_UID, ate_at: '2026-05-20T12:00:00+09:00', source: 'manual',
      kcal: 500, client_mutation_id: crypto.randomUUID(),
    } as never);
    const { data } = await supa.from('advice').select('stale')
      .eq('user_id', OWNER_UID).eq('kind', 'weekly').eq('period_start', '2026-05-18').single();
    expect((data as { stale: boolean } | null)?.stale).toBe(true);
  });

  it('UPDATE meal ate_at to different period marks both old and new period stale', async () => {
    await supa.from('advice').insert([
      { user_id: OWNER_UID, kind: 'weekly', period_start: '2026-05-04', period_end: '2026-05-10', period_timezone: 'Asia/Tokyo', content_md: '..', stale: false },
      { user_id: OWNER_UID, kind: 'weekly', period_start: '2026-05-18', period_end: '2026-05-24', period_timezone: 'Asia/Tokyo', content_md: '..', stale: false },
    ] as never);
    const { data: meal } = await supa.from('meals').insert({
      user_id: OWNER_UID, ate_at: '2026-05-06T12:00:00+09:00', source: 'manual',
      kcal: 500, client_mutation_id: crypto.randomUUID(),
    } as never).select('id').single();
    await supa.from('advice').update({ stale: false } as never).eq('user_id', OWNER_UID);
    await supa.from('meals').update({ ate_at: '2026-05-20T12:00:00+09:00' } as never).eq('id', (meal as { id: string }).id);
    const { data: rows } = await supa.from('advice').select('period_start, stale')
      .eq('user_id', OWNER_UID).eq('stale', true);
    expect(rows?.length).toBe(2);
  });
});
