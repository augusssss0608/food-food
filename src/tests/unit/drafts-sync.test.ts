import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDraftsDb } from '@/lib/drafts/db';
import { saveDraft, syncDrafts, type UploadFn } from '@/lib/drafts/sync';

beforeEach(async () => {
  await getDraftsDb().drafts.clear();
});

describe('saveDraft + syncDrafts', () => {
  it('saves and syncs once (idempotent)', async () => {
    const upload = vi.fn().mockResolvedValue({ id: 'srv-1' });
    await saveDraft('uid', 'meal', { kcal: 500 });
    await syncDrafts('uid', upload as unknown as UploadFn);
    await syncDrafts('uid', upload as unknown as UploadFn);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported payloadVersion', async () => {
    const upload = vi.fn();
    await getDraftsDb().drafts.add({
      id: crypto.randomUUID(),
      ownerUserId: 'uid', type: 'meal',
      payloadVersion: 99 as 1, payload: {}, idempotencyKey: crypto.randomUUID(),
      status: 'pending', attempts: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await syncDrafts('uid', upload as unknown as UploadFn);
    const drafts = await getDraftsDb().drafts.toArray();
    expect(drafts[0]!.status).toBe('failed');
    expect(drafts[0]!.lastError).toMatch(/unsupported payload version/);
  });

  it('stops at attempts > 5', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('network'));
    await saveDraft('uid', 'meal', { kcal: 500 });
    for (let i = 0; i < 6; i++) await syncDrafts('uid', upload as unknown as UploadFn);
    expect(upload).toHaveBeenCalledTimes(5);
  });
});
