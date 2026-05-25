import type { Metadata, Viewport } from 'next';
import { Fraunces, JetBrains_Mono, Geist } from 'next/font/google';
import { NoSwipeBackGesture } from '@/components/no-swipe-back-gesture';
import { ToastProvider } from '@/components/ui/toast';
import { ViewportDebug } from '@/components/viewport-debug';
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

// iOS PWA standalone：apple-touch-startup-image 是 best-effort native launch screen。
// 命中是赚到，不命中也不增加 Web 内视觉阶段（因为我们不再渲染自己的 splash）。
// 用户机型需要的 PNG 如果不在下面列表，可以新增；旧 iOS 版本可能需要清 Safari 网站数据后重新添加 PWA 才会重新读取这些 link。
const SPLASH_LINKS: { media: string; href: string }[] = [
  { media: 'screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-15-pro-max.png' },
  { media: 'screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-pro-max-legacy.png' },
  { media: 'screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/iphone-xr.png' },
  { media: 'screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-xs-max.png' },
  { media: 'screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-15-pro.png' },
  { media: 'screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-15.png' },
  { media: 'screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-14.png' },
  { media: 'screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-x.png' },
  { media: 'screen and (device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/iphone-mini.png' },
  { media: 'screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/iphone-se.png' },
];

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
        <NoSwipeBackGesture />
        <ToastProvider>{children}</ToastProvider>
        <ViewportDebug />
      </body>
    </html>
  );
}
