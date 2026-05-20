import { createSupabaseServerClient } from '@/lib/supabase/server';

export class AuthError extends Error {
  constructor(msg = 'Unauthenticated') { super(msg); this.name = 'AuthError'; }
}
export class ForbiddenError extends Error {
  constructor(msg = 'Forbidden') { super(msg); this.name = 'ForbiddenError'; }
}

export async function requireAllowedUser(opts: { fresh?: boolean } = {}) {
  const supabase = await createSupabaseServerClient();
  if (opts.fresh) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new AuthError();
    if (user.id !== process.env.ALLOWED_USER_ID || user.is_anonymous) throw new ForbiddenError();
    return { supabase, userId: user.id };
  }
  const { data: { claims }, error } = await supabase.auth.getClaims();
  if (error || !claims?.sub) throw new AuthError();
  if (claims.sub !== process.env.ALLOWED_USER_ID || claims.is_anonymous === true) throw new ForbiddenError();
  return { supabase, userId: claims.sub };
}
