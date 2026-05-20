import { describe, it, expect, beforeAll } from 'vitest';
import { assertSameOrigin, CsrfError } from '@/lib/auth/csrf';

function makeReq(method: string, headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/test', { method, headers });
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  process.env.NODE_ENV = 'test';
});

describe('assertSameOrigin', () => {
  it('safe methods (GET) always pass', () => {
    expect(() => assertSameOrigin(makeReq('GET', {}))).not.toThrow();
  });

  it('matching origin passes for POST', () => {
    expect(() => assertSameOrigin(makeReq('POST', { origin: 'http://localhost:3000' }))).not.toThrow();
  });

  it('mismatched origin throws CsrfError', () => {
    expect(() => assertSameOrigin(makeReq('POST', { origin: 'http://evil.com' }))).toThrow(CsrfError);
  });

  it('missing origin but sec-fetch-site=same-origin passes', () => {
    expect(() => assertSameOrigin(makeReq('POST', { 'sec-fetch-site': 'same-origin' }))).not.toThrow();
  });

  it('missing both origin and sec-fetch-site throws CsrfError', () => {
    expect(() => assertSameOrigin(makeReq('POST', {}))).toThrow(CsrfError);
  });
});
