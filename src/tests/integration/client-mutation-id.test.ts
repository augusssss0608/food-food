import { describe, it, expect, beforeEach } from 'vitest';
import { createTestAdminClient, OWNER_UID } from './helpers/test-supabase';

const supa = createTestAdminClient();

beforeEach(async () => {
  await supa.from('meals').delete().eq('user_id', OWNER_UID);
});

describe('client_mutation_id 幂等', () => {
  it('inserting twice with same mutation_id results in 1 row', async () => {
    const mid = crypto.randomUUID();
    await supa.from('meals').insert({
      user_id: OWNER_UID, ate_at: new Date().toISOString(), source: 'manual',
      kcal: 500, client_mutation_id: mid,
    } as never);
    const r2 = await supa.from('meals').insert({
      user_id: OWNER_UID, ate_at: new Date().toISOString(), source: 'manual',
      kcal: 600, client_mutation_id: mid,
    } as never);
    expect((r2.error as { code?: string } | null)?.code).toBe('23505');

    const { data } = await supa.from('meals').select('*').eq('user_id', OWNER_UID);
    expect(data?.length).toBe(1);
  });

  it('upsert with ON CONFLICT DO NOTHING is idempotent', async () => {
    const mid = crypto.randomUUID();
    for (let i = 0; i < 3; i++) {
      await supa.from('meals').upsert({
        user_id: OWNER_UID, ate_at: new Date().toISOString(), source: 'manual',
        kcal: 500, client_mutation_id: mid,
      } as never, { onConflict: 'user_id,client_mutation_id', ignoreDuplicates: true });
    }
    const { data } = await supa.from('meals').select('*').eq('user_id', OWNER_UID);
    expect(data?.length).toBe(1);
  });
});
