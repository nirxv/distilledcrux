import '@fontsource/libre-baskerville/400.css';
import '@fontsource/libre-baskerville/400-italic.css';
import '@fontsource/libre-baskerville/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import Navbar from '@/components/Navbar';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050508',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://distilledcrux.com'),
  title: { default: 'Distilled Crux — UPSC Optional Preparation', template: '%s | Distilled Crux' },
  description: 'AI answer evaluation, curated notes, PYQ practice and topper copies for every UPSC optional.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://distilledcrux.com' },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Navbar />
        <main style={{ minHeight: '100vh', paddingTop: 60 }} id="main-layout">
          {children}
        </main>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXXXX');
        `}</Script>
      </body>
    </html>
  );
}
