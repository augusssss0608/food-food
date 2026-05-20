import { describe, it, expect } from 'vitest';
import { normalizeImage } from '@/lib/image/normalize';

describe('normalizeImage', () => {
  it('returns same File when not HEIC', async () => {
    const f = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    const out = await normalizeImage(f);
    expect(out).toBe(f);
  });

  it('non-HEIC by extension also passes through', async () => {
    const f = new File(['x'], 'photo.png', { type: 'image/png' });
    const out = await normalizeImage(f);
    expect(out).toBe(f);
  });
});
