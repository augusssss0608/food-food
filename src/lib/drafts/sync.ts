import { getDraftsDb, type LocalDraft, CURRENT_PAYLOAD_VERSION } from './db';

export async function saveDraft(
  ownerUserId: string, type: LocalDraft['type'], payload: unknown,
): Promise<string> {
  const draft: LocalDraft = {
    id: crypto.randomUUID(),
    ownerUserId, type,
    payloadVersion: CURRENT_PAYLOAD_VERSION,
    payload,
    idempotencyKey: crypto.randomUUID(),
    status: 'pending', attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await getDraftsDb().drafts.add(draft);
  return draft.id;
}

export type UploadFn = (draft: LocalDraft) => Promise<{ id: string }>;

export async function syncDrafts(ownerUserId: string, upload: UploadFn): Promise<void> {
  const db = getDraftsDb();
  const pending = await db.drafts.where({ ownerUserId, status: 'pending' }).toArray();
  for (const d of pending) {
    if (d.payloadVersion !== CURRENT_PAYLOAD_VERSION) {
      await db.drafts.update(d.id, {
        status: 'failed', lastError: 'unsupported payload version',
        updatedAt: new Date().toISOString(),
      });
      continue;
    }
    // 5 次失败后标 'failed'，主页 pending 计数不再算它；用户可在 admin/debug 看 failed 草稿后手动处理
    if (d.attempts >= 5) {
      await db.drafts.update(d.id, {
        status: 'failed', lastError: `attempts cap (5) reached; last: ${d.lastError ?? 'unknown'}`,
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    await db.drafts.update(d.id, { status: 'syncing', updatedAt: new Date().toISOString() });
    try {
      const r = await upload(d);
      await db.drafts.update(d.id, {
        status: 'synced', serverId: r.id, updatedAt: new Date().toISOString(),
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      await db.drafts.update(d.id, {
        status: 'pending', attempts: d.attempts + 1, lastError: err.message ?? 'unknown',
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
