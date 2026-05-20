const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class CsrfError extends Error {
  constructor(msg = 'CSRF check failed') {
    super(msg);
    this.name = 'CsrfError';
  }
}

export function assertSameOrigin(req: Request): void {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get('origin');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new CsrfError('NEXT_PUBLIC_SITE_URL not configured');
  const allowed = new Set([siteUrl.toLowerCase()]);
  if (process.env.NODE_ENV !== 'production') allowed.add('http://localhost:3000');
  if (origin) {
    let normalized: string;
    try {
      normalized = new URL(origin).origin.toLowerCase();
    } catch {
      throw new CsrfError('Invalid origin header');
    }
    if (!allowed.has(normalized)) throw new CsrfError();
    return;
  }
  const sfs = req.headers.get('sec-fetch-site');
  if (sfs && ['same-origin', 'same-site', 'none'].includes(sfs)) return;
  throw new CsrfError('Missing origin');
}
