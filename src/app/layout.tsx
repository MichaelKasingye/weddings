import type { Metadata, Viewport } from 'next';
import { appUrl } from '@/lib/settings';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: 'Aaron & Josephine · Wedding',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/assets/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/assets/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/assets/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B1B45',
};

/* One root layout. The invitation pages and the dashboard each bring their own stylesheet
   (src/app/(invite)/layout.tsx and src/app/(admin)/layout.tsx); links between the two
   sides are plain <a> links, so each side loads only its own styles. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-modern">
      <body>{children}</body>
    </html>
  );
}
