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

  it('omits camelCase / snake_case image variants', () => {
    const out = sanitizeContext({
      imageBase64: 'huge', image_url: 'u', photoData: 'p', base64_image: 'b', user: 'alice',
    }) as Record<string, string>;
    expect(out.imageBase64).toBe('[OMITTED]');
    expect(out.image_url).toBe('[OMITTED]');
    expect(out.photoData).toBe('[OMITTED]');
    expect(out.base64_image).toBe('[OMITTED]');
    expect(out.user).toBe('alice');
  });

  it('redacts authentication / authorization keys', () => {
    const out = sanitizeContext({
      authentication: 'Basic xxx', authorization: 'Bearer yyy', user: 'alice',
    }) as Record<string, string>;
    expect(out.authentication).toBe('[REDACTED]');
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.user).toBe('alice');
  });

  it('redacts secrets in strings BEFORE truncation', () => {
    // 长字符串里的 Bearer token 必须先被 redact，再被截断；否则截断保留了部分 secret
    const input = 'x'.repeat(450) + ' Bearer abc.def.ghi ' + 'y'.repeat(200);
    const out = sanitizeContext(input) as string;
    expect(out).toContain('Bearer [REDACTED]');
    expect(out).not.toContain('abc.def.ghi');
  });
});
