import type { NextConfig } from 'next';
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // No 'unsafe-eval'. The only thing that wanted it was pdf.js, which now
      // runs with isEvalSupported:false in app/evaluate. Checked the rest:
      // gtag.js needs no eval, and Razorpay's checkout.js has one new Function
      // in a try/catch globalThis polyfill that never runs in a real browser.
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://apis.google.com https://checkout.razorpay.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.anthropic.com https://*.supabase.co https://www.google-analytics.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://firebase.googleapis.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://ip-api.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com",
      "base-uri 'self'",
      "form-action 'self' https://*.firebaseapp.com https://accounts.google.com",
      "frame-ancestors 'self'",
    ].join('; '),
  },
];
// Firebase always serves the real auth handler from <project>.firebaseapp.com.
// Proxying it under our own origin makes the sign-in handshake first-party, so
// Safari/WebKit ITP (Telegram's iOS webview included) stops partitioning it.
// Inert until NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is pointed at our own domain.
const FIREBASE_AUTH_UPSTREAM = `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`;

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', 'razorpay'],
  rewrites: async () => [
    {
      source: '/__/auth/:path*',
      destination: `https://${FIREBASE_AUTH_UPSTREAM}/__/auth/:path*`,
    },
    {
      source: '/__/firebase/:path*',
      destination: `https://${FIREBASE_AUTH_UPSTREAM}/__/firebase/:path*`,
    },
  ],
  headers: async () => [
    {
      // The proxied auth handler is Google's own page — our CSP would break it.
      source: '/((?!__/).*)',
      headers: securityHeaders,
    },
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};
export default nextConfig;
