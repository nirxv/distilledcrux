import '@fontsource/libre-baskerville/400.css';
import '@fontsource/libre-baskerville/400-italic.css';
import '@fontsource/libre-baskerville/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import type { Metadata, Viewport } from 'next';
/**
 * Root layout for the public site.
 *
 * It sits inside a route group rather than at app/ because the Payload admin
 * needs a root layout of its own. Next allows more than one only when there is
 * no top-level layout.tsx, and while there was one, this file wrapped the CMS
 * too: /cms came back with two <html> and two <body> tags, which the browser
 * discarded, so React's hydration never matched the DOM and the admin crashed
 * with "This page couldn't load".
 */
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SessionTracker from '@/components/SessionTracker';
import ProgressSync from '@/components/ProgressSync';
import { AuthProvider } from '@/components/AuthProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050508',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://distilledcrux.com'),
  title: { default: 'Distilled Crux UPSC Optional Preparation', template: '%s | Distilled Crux' },
  description: 'AI answer evaluation, curated notes, 4500+ PYQs and topper copies for UPSC Mains Optional Sociology, Anthropology, History, Geography and more.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://distilledcrux.com' },
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    siteName: 'Distilled Crux',
    title: 'Distilled Crux UPSC Optional Preparation',
    description: 'AI answer evaluation, curated notes, 4500+ PYQs and topper copies for UPSC Mains Optional.',
    url: 'https://distilledcrux.com',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Distilled Crux UPSC Optional Preparation' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Distilled Crux UPSC Optional Preparation',
    description: 'AI answer evaluation, curated notes, 4500+ PYQs and topper copies for UPSC Mains Optional.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The script in <head> sets the saved theme before React loads, so the
  // attribute is expected to differ from the server's.
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);})();` }} />
      </head>
      <body>
        <AuthProvider>
        <Navbar />
        <SessionTracker />
        <ProgressSync />
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <main style={{ flex: 1, paddingTop: 60 }} id="main-layout">
            {children}
          </main>
          <Footer />
        </div>
        </AuthProvider>
      </body>
    </html>
  );
}
