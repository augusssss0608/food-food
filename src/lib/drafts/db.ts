import Dexie, { type Table } from 'dexie';

export type LocalDraft = {
  id: string;
  ownerUserId: string;
  type: 'meal' | 'body_metric';
  payloadVersion: 1;
  payload: unknown;
  idempotencyKey: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  attempts: number;
  lastError?: string;
  serverId?: string;
  createdAt: string;
  updatedAt: string;
};

class FoodFoodDB extends Dexie {
  drafts!: Table<LocalDraft, string>;
  constructor() {
    super('food-food');
    this.version(1).stores({
      drafts: '&id, ownerUserId, status, createdAt, idempotencyKey',
    });
  }
}

let _db: FoodFoodDB | null = null;
export function getDraftsDb(): FoodFoodDB {
  if (!_db) _db = new FoodFoodDB();
  return _db;
}

export const CURRENT_PAYLOAD_VERSION = 1 as const;
