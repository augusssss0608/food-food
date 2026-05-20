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

// iOS PWA standalone 模式下，没有匹配的 apple-touch-startup-image
// 会显示纯白闪屏。这里为常见 iPhone 显示尺寸都准备一张。
const SPLASH_LINKS: { media: string; href: string }[] = [
  // iPhone 15/16 Pro Max (430 × 932 @3x)
  {
    media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
    href: '/splash/iphone-15-pro-max.png',
  },
  // iPhone 15/16 Pro (402 × 874 @3x)
  {
    media: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
    href: '/splash/iphone-15-pro.png',
  },
  // iPhone 15 / 14 Pro (393 × 852 @3x)
  {
    media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
    href: '/splash/iphone-15.png',
  },
  // iPhone 13/14 (390 × 844 @3x)
  {
    media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
    href: '/splash/iphone-14.png',
  },
  // iPhone 12/13/14 Pro Max legacy (428 × 926 @3x)
  {
    media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
    href: '/splash/iphone-pro-max-legacy.png',
  },
  // iPhone SE / 8 (375 × 667 @2x)
  {
    media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
    href: '/splash/iphone-se.png',
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-TW"
      className={`${fraunces.variable} ${mono.variable} ${sans.variable}`}
      style={{ backgroundColor: '#0a0a0c' }}
    >
      <head>
        {/* 提前建立与 Supabase 的 TCP/TLS 连接 */}
        {SUPABASE_URL && (
          <>
            <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={SUPABASE_URL} />
          </>
        )}
        {/* iOS PWA standalone 启动闪屏 */}
        {SPLASH_LINKS.map((l) => (
          <link key={l.href} rel="apple-touch-startup-image" href={l.href} media={l.media} />
        ))}
      </head>
      <body className="antialiased" style={{ backgroundColor: '#0a0a0c' }}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
