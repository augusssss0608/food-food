import { describe, it, expect } from 'vitest';
import { extractIdempotencyKey, MissingIdempotencyKeyError } from '@/lib/auth/idempotency';

function makeReq(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/test', { method: 'POST', headers });
}

describe('extractIdempotencyKey', () => {
  it('returns uuid from valid header', () => {
    expect(extractIdempotencyKey(makeReq({ 'Idempotency-Key': '00000000-0000-4000-8000-000000000001' })))
      .toBe('00000000-0000-4000-8000-000000000001');
  });

  it('throws MissingIdempotencyKeyError when header missing', () => {
    expect(() => extractIdempotencyKey(makeReq({}))).toThrow(MissingIdempotencyKeyError);
  });

  it('throws MissingIdempotencyKeyError when header value not uuid', () => {
    expect(() => extractIdempotencyKey(makeReq({ 'Idempotency-Key': 'not-uuid' }))).toThrow();
  });
});
