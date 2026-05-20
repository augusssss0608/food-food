import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = [
  '/login', '/auth/callback', '/manifest.json', '/sw.js',
  '/favicon.ico', '/icons/', '/api/cron', '/api/push/manifest',
  // POC 工具靠 DEV_SECRET 自鉴权（详见 spec §5.7 / §6.2）
  '/api/dev/sandbox-probe',
];
// 注意：'/admin/debug' 和 '/api/dev/export' 都仍走 middleware（必须是 owner），
// 进入后再各自做 DEV_SECRET 第二道校验

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => {
    if (pathname === p) return true;
    // 收紧：必须是 exact 或在 p 后跟 '/'，避免 /login 命中 /login-anything
    const prefix = p.endsWith('/') ? p : `${p}/`;
    return pathname.startsWith(prefix);
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Supabase SSR 模式：刷新 token 时必须同时写 req.cookies 和 response.cookies，
  // 让同一次请求接下来的 Server Component 渲染能读到新 token（参考 supabase-ssr 官方示例）
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub
        || claims.sub !== process.env.ALLOWED_USER_ID
        || claims.is_anonymous === true) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt)$).*)',
  ],
};
