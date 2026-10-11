import type { NextConfig } from 'next';

// Security headers on every response the worker renders (pages and the
// API alike; dist/client/_headers only reaches static assets). Conservative
// on purpose: framing stays allowed so a partner can embed a record, HSTS
// leaves subdomains alone, and there is no CSP until one is tested against
// the 3D scene and the font host.
const SECURITY = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  async headers() {
    // '/' is listed on its own: vinext's '/:path*' does not match the root.
    return [{ source: '/', headers: SECURITY }, { source: '/:path*', headers: SECURITY }];
  },
};

export default nextConfig;
