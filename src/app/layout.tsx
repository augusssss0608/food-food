import type { Metadata, Viewport } from 'next';
import { Fraunces, JetBrains_Mono, Geist } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz', 'SOFT'],
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${fraunces.variable} ${mono.variable} ${sans.variable}`}
      style={{ backgroundColor: '#0a0a0c' }}
    >
      <head>
        {/* 提前建立与 Supabase 的 TCP/TLS 连接，省冷启首次往返 */}
        {SUPABASE_URL && (
          <>
            <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={SUPABASE_URL} />
          </>
        )}
      </head>
      <body className="antialiased" style={{ backgroundColor: '#0a0a0c' }}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
