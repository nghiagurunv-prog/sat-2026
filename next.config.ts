import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";

const nextConfig: NextConfig = {
  // Ghim root về thư mục sat-prep-web để Turbopack không chọn nhầm lockfile ở thư mục cha.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'katex', 'framer-motion', '@supabase/supabase-js'],
  },
  async redirects() {
    return [
      { source: '/exam-mode', destination: '/mock-exams', permanent: false },
      { source: '/mock-exams/session', destination: '/mock-exams', permanent: false },
      { source: '/rescue', destination: '/forge', permanent: false },
      { source: '/missions', destination: '/quests', permanent: false },
      { source: '/achievements', destination: '/collection', permanent: false },
      { source: '/study-plan', destination: '/journey', permanent: false },
      { source: '/scholarship', destination: '/analytics', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.desmos.com https://js.stripe.com",
              "frame-src 'self' https://www.desmos.com https://js.stripe.com https://checkout.stripe.com https://pay.payos.vn",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.desmos.com https://api.stripe.com https://api-merchant.payos.vn",
              "base-uri 'self'",
              "form-action 'self' https://pay.payos.vn https://checkout.stripe.com https://sandbox.vnpayment.vn https://pay.vnpay.vn",
            ].join('; '),
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
