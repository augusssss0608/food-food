import type { Metadata, Viewport } from 'next';
import { Fraunces, JetBrains_Mono, Geist } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz', 'SOFT'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});
const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

export const metadata: Metadata = {
  title: 'food-food',
  description: 'Your private fitness lab.',
  manifest: '/manifest.json',
  applicationName: 'food-food',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'food-food',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

// iOS PWA standalone 模式：apple-touch-startup-image 要求 CSS px + 设备 DPR 精确匹配；
// 没匹配中 iOS 会用 manifest background_color 等 HTML，体感就是"3 秒黑屏"。
// 把主流 iPhone（XR/11 一直到 16 Pro Max）全列出来覆盖。
const SPLASH_LINKS: { media: string; href: string }[] = [
  // iPhone 15/16 Pro Max — 430 × 932 @3x
  { media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-15-pro-max.png' },
  // iPhone 12/13/14 Pro Max / 14 Plus — 428 × 926 @3x
  { media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-pro-max-legacy.png' },
  // iPhone XR / 11 — 414 × 896 @2x
  { media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/iphone-xr.png' },
  // iPhone XS Max / 11 Pro Max — 414 × 896 @3x
  { media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-xs-max.png' },
  // iPhone 16 Pro — 402 × 874 @3x
  { media: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-15-pro.png' },
  // iPhone 14 Pro / 15 / 15 Pro / 16 / 16e — 393 × 852 @3x
  { media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-15.png' },
  // iPhone 12/13/14 — 390 × 844 @3x
  { media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-14.png' },
  // iPhone X / XS / 11 Pro — 375 × 812 @3x
  { media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-x.png' },
  // iPhone 12/13 mini — 360 × 780 @3x
  { media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-mini.png' },
  // iPhone SE 2/3 / 8 — 375 × 667 @2x
  { media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/iphone-se.png' },
];

// 即便所有 PNG splash 没匹配，body 一进就有这个 inline 覆盖层；
// 它不依赖 Tailwind / fonts / JS chunk，HTML parser 一到 body 就立刻可见。
// 等首屏 content 准备好后由 inline script 淡出移除。
const INLINE_SPLASH_HTML = `
<style>
  #ff-initial-splash {
    position: fixed; inset: 0; z-index: 99999;
    background: #0a0a0c;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    transition: opacity .35s ease-out;
    -webkit-tap-highlight-color: transparent;
  }
  #ff-initial-splash .ff-mono { font-family: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace; color: #c8ff00; letter-spacing: 0.32em; font-size: 11px; }
  #ff-initial-splash .ff-ff   { font-family: Georgia, 'Times New Roman', serif; font-style: italic; color: #c8ff00; font-size: 96px; line-height: 1; margin: 22px 0 0; }
  #ff-initial-splash .ff-tag  { font-family: ui-monospace, 'JetBrains Mono', 'SF Mono', monospace; color: #686870; font-size: 10px; letter-spacing: 0.28em; margin-top: 28px; }
  #ff-initial-splash .ff-bot  { position: absolute; left: 32px; bottom: 40px; color: #4a4a52; font-family: ui-monospace, 'SF Mono', monospace; font-size: 10px; letter-spacing: 0.24em; }
  #ff-initial-splash .ff-line { display: block; width: 56px; height: 2px; background: rgba(200,255,0,.7); margin-bottom: 12px; }
</style>
<div id="ff-initial-splash" aria-hidden="true">
  <div style="text-align:center">
    <p class="ff-mono" style="margin:0">FOOD</p>
    <p class="ff-ff">ff<span style="font-family:Georgia,serif;font-style:normal;font-size:48px;vertical-align:middle">·</span></p>
    <p class="ff-tag" style="margin:0;text-transform:uppercase">YOUR PRIVATE FITNESS LAB</p>
  </div>
  <div class="ff-bot">
    <span class="ff-line"></span>
    <span style="text-transform:uppercase">v0.1 · single-user beta</span>
  </div>
</div>
<script>
(function(){
  var hidden = false;
  function hide() {
    if (hidden) return; hidden = true;
    var el = document.getElementById('ff-initial-splash');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }
  // 等 main 进入 DOM（streaming server component 完成）；超时兜底 2.4s
  function ready() {
    if (document.querySelector('main')) { hide(); return true; }
    return false;
  }
  if (!ready()) {
    var mo = new MutationObserver(function(){ if (ready()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(hide, 2400);
  }
})();
</script>
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-TW"
      className={`${fraunces.variable} ${mono.variable} ${sans.variable}`}
      style={{ backgroundColor: '#0a0a0c' }}
    >
      <head>
        {SUPABASE_URL && (
          <>
            <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={SUPABASE_URL} />
          </>
        )}
        {SPLASH_LINKS.map((l) => (
          <link key={l.href} rel="apple-touch-startup-image" href={l.href} media={l.media} />
        ))}
      </head>
      <body className="antialiased" style={{ backgroundColor: '#0a0a0c' }}>
        {/* inline splash overlay — paints on first body parse, no Tailwind / fonts dependency */}
        <div dangerouslySetInnerHTML={{ __html: INLINE_SPLASH_HTML }} />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
