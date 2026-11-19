import type { Metadata, Viewport } from 'next';
import './globals.css';
import { t, locale, dir } from '@/lib/i18n/t';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = { title: t('app.name'), description: t('app.tagline'), icons: { icon: '/icon.svg' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2853e0' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={locale} dir={dir}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
