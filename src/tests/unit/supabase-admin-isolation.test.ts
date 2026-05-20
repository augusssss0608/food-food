import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// server-only 包在 client 环境强行抛错（这是它的作用）；vitest jsdom 环境模拟两侧 import，统一 mock 成空模块
vi.mock('server-only', () => ({}));

describe('supabaseAdmin isolation', () => {
  const ORIG_WINDOW = (globalThis as unknown as { window?: unknown }).window;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SECRET_KEY_ADMIN = 'sb_secret_test';
  });

  afterAll(() => {
    if (ORIG_WINDOW === undefined) delete (globalThis as unknown as { window?: unknown }).window;
    else (globalThis as unknown as { window?: unknown }).window = ORIG_WINDOW;
  });

  it('returns a client when called server-side', async () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    vi.resetModules();
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    expect(supabaseAdmin()).toBeDefined();
  });

  it('throws when accidentally called from client-side bundle', async () => {
    (globalThis as unknown as { window?: unknown }).window = {};
    vi.resetModules();
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    expect(() => supabaseAdmin()).toThrow(/must not be imported on client/);
  });
});
