import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";

const nextConfig: NextConfig = {
  // Ghim root về thư mục sat-prep-web để Turbopack không chọn nhầm lockfile ở thư mục cha.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'katex', 'framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
