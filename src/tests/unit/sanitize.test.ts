import { describe, it, expect } from 'vitest';
import { sanitizeContext } from '@/lib/errors/sanitize';

describe('sanitizeContext', () => {
  it('truncates long strings to 500 chars', () => {
    const long = 'a'.repeat(2000);
    expect(sanitizeContext(long) as string).toMatch(/^a{500}\[truncated\]$/);
  });

  it('redacts Bearer tokens', () => {
    expect(sanitizeContext('Bearer abc.def-_123')).toBe('Bearer [REDACTED]');
  });

  it('redacts sk-ant- keys', () => {
    expect(sanitizeContext('sk-ant-api03_xxxxx-yyy')).toMatch(/sk-ant-\[REDACTED\]/);
  });

  it('redacts JWT-shaped tokens', () => {
    expect(sanitizeContext('eyJhbGci.zzz')).toBe('[JWT_REDACTED]');
  });

  it('redacts sensitive object keys', () => {
    const input = { apiKey: 'secret', token: 't', password: 'p', user: 'alice' };
    const out = sanitizeContext(input) as Record<string, string>;
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.user).toBe('alice');
  });

  it('omits image / base64 keys', () => {
    const out = sanitizeContext({ image: 'huge_b64', photo: 'p', user: 'alice' }) as Record<string, string>;
    expect(out.image).toBe('[OMITTED]');
    expect(out.photo).toBe('[OMITTED]');
    expect(out.user).toBe('alice');
  });

  it('caps depth at 5', () => {
    let nested: unknown = { v: 'leaf' };
    for (let i = 0; i < 10; i++) nested = { x: nested };
    const out = JSON.stringify(sanitizeContext(nested));
    expect(out).toMatch(/MaxDepth/);
  });

  it('caps array length at 20', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    expect((sanitizeContext(arr) as number[]).length).toBe(20);
  });
});
