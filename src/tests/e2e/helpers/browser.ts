import type { Page } from '@playwright/test';

/**
 * 在 page 上下文之前注入 Push API 的 fake 实现。
 * Playwright bundled Chromium 没有 fake push service / FCM endpoint，
 * 真 pushManager.subscribe() 会抛 push service unavailable。
 * 这里 mock 浏览器侧，让组件继续真实走 fetch /api/push/subscribe → DB upsert。
 */
export async function mockPushApi(page: Page, opts: {
  permission?: 'granted' | 'denied';
  endpoint?: string;
} = {}): Promise<void> {
  const permission = opts.permission ?? 'granted';
  const endpoint = opts.endpoint ?? 'https://push.test.local/sub/e2e-1';

  await page.addInitScript(({ permission, endpoint }) => {
    // 跨 reload 持久化订阅状态：真浏览器订阅成功后 reload 仍能 getSubscription() 拿到，
    // mock 也用 localStorage 模拟。
    const makeSub = () => ({
      endpoint,
      expirationTime: null as number | null,
      options: { userVisibleOnly: true, applicationServerKey: new Uint8Array() },
      getKey: () => null,
      toJSON() { return { endpoint, keys: { p256dh: 'p256dh-e2e', auth: 'auth-e2e' } }; },
      unsubscribe: async () => {
        localStorage.removeItem('e2e-push-sub');
        return true;
      },
    });
    const fakeReg = {
      pushManager: {
        getSubscription: async () => (localStorage.getItem('e2e-push-sub') ? makeSub() : null),
        subscribe: async () => {
          if (permission !== 'granted') throw new Error('denied');
          localStorage.setItem('e2e-push-sub', endpoint);
          return makeSub();
        },
        permissionState: async () => permission,
      },
      active: { state: 'activated' },
    };
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: function PushManager() { /* fake */ },
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission, requestPermission: async () => permission },
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: async () => fakeReg, ready: Promise.resolve(fakeReg) },
    });
  }, { permission, endpoint });
}

/** 通过 page.evaluate 直接写浏览器 IndexedDB 的 food-food.drafts。 */
export async function seedDraftInBrowser(page: Page, draft: {
  id?: string;
  ownerUserId: string;
  type?: 'meal' | 'body_metric';
  payloadVersion?: number;
  status?: 'pending' | 'syncing' | 'failed' | 'synced';
  attempts?: number;
  endpoint?: string;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  lastError?: string;
}): Promise<string> {
  return page.evaluate(async (d) => {
    const id = d.id ?? crypto.randomUUID();
    const idempotencyKey = d.idempotencyKey ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const draft = {
      id,
      ownerUserId: d.ownerUserId,
      type: d.type ?? 'meal',
      payloadVersion: d.payloadVersion ?? 1,
      payload: {
        endpoint: d.endpoint ?? '/api/meals/log',
        body: d.body ?? { ate_at: now, source: 'preset', preset_key: 'beef_rice' },
        idempotencyKey,
      },
      idempotencyKey,
      status: d.status ?? 'pending',
      attempts: d.attempts ?? 0,
      lastError: d.lastError,
      createdAt: now,
      updatedAt: now,
    };
    // Dexie 用 version*10 映射，open() 不传版本可拿当前 IndexedDB 版本，不冲突
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('food-food');
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id', autoIncrement: false });
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('drafts', 'readwrite');
        tx.objectStore('drafts').put(draft);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    return id;
  }, draft);
}

/** 读 IndexedDB drafts（含状态/attempts）。 */
export async function readDraftsInBrowser(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(async () => {
    return await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const req = indexedDB.open('food-food');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction('drafts', 'readonly');
        const getAll = tx.objectStore('drafts').getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => { db.close(); resolve(getAll.result as Array<Record<string, unknown>>); };
      };
    });
  });
}

/** 清空 IndexedDB drafts（spec 之间互不污染）。 */
export async function clearDraftsInBrowser(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('food-food');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
}
