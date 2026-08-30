import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Business Dashboard', template: '%s · Business Dashboard' },
  description: 'Manage your business listing, reviews, messages, and advertising.',
  appleWebApp: { capable: true, title: 'Business', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Let people pinch-zoom. Locking it out is an accessibility failure.
  maximumScale: 5,
  themeColor: '#b3231e',
  // Content extends under the system bars; components pad with env(safe-area-*).
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
