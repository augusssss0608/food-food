import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAllowedUser, AuthError, ForbiddenError } from '@/lib/auth/require-allowed-user';

const OWNER = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.resetAllMocks();
  process.env.ALLOWED_USER_ID = OWNER;
});

type Override = {
  getClaims?: { data: { claims: unknown }; error: unknown };
  getUser?: { data: { user: unknown }; error: unknown };
};

function mockClient(overrides: Override) {
  (createSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getClaims: vi.fn().mockResolvedValue(overrides.getClaims ?? { data: { claims: null }, error: null }),
      getUser: vi.fn().mockResolvedValue(overrides.getUser ?? { data: { user: null }, error: null }),
    },
  });
}

describe('requireAllowedUser', () => {
  it('default mode rejects when no claims', async () => {
    mockClient({ getClaims: { data: { claims: null }, error: null } });
    await expect(requireAllowedUser()).rejects.toThrow(AuthError);
  });

  it('default mode rejects non-owner uid', async () => {
    mockClient({ getClaims: { data: { claims: { sub: 'other-uid', is_anonymous: false } }, error: null } });
    await expect(requireAllowedUser()).rejects.toThrow(ForbiddenError);
  });

  it('default mode rejects anonymous claims', async () => {
    mockClient({ getClaims: { data: { claims: { sub: OWNER, is_anonymous: true } }, error: null } });
    await expect(requireAllowedUser()).rejects.toThrow(ForbiddenError);
  });

  it('default mode passes for owner', async () => {
    mockClient({ getClaims: { data: { claims: { sub: OWNER, is_anonymous: false } }, error: null } });
    const { userId } = await requireAllowedUser();
    expect(userId).toBe(OWNER);
  });

  it('fresh=true uses getUser path and rejects non-owner', async () => {
    mockClient({ getUser: { data: { user: { id: 'other-uid', is_anonymous: false } }, error: null } });
    await expect(requireAllowedUser({ fresh: true })).rejects.toThrow(ForbiddenError);
  });

  it('fresh=true passes for owner', async () => {
    mockClient({ getUser: { data: { user: { id: OWNER, is_anonymous: false } }, error: null } });
    const { userId } = await requireAllowedUser({ fresh: true });
    expect(userId).toBe(OWNER);
  });
});
