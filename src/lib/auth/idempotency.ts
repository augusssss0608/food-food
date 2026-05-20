export class MissingIdempotencyKeyError extends Error {
  constructor(msg = 'Idempotency-Key header required (UUID)') {
    super(msg); this.name = 'MissingIdempotencyKeyError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractIdempotencyKey(req: Request): string {
  const key = req.headers.get('Idempotency-Key');
  if (!key || !UUID_RE.test(key)) throw new MissingIdempotencyKeyError();
  return key;
}
