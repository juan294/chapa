import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Build the Content-Security-Policy header value.
 *
 * @param frameAncestors - The frame-ancestors directive value.
 *   Use "'none'" for pages that should not be embedded,
 *   or "*" for the badge SVG which is designed to be embeddable.
 */
function buildCsp(frameAncestors: string): string {
  const scriptSrc = [
    "'self'",
    // 'unsafe-inline' is required by Next.js App Router for inline scripts
    // (hydration, page transitions). Removing it requires nonce-based CSP
    // which Next.js does not yet support without custom middleware.
    "'unsafe-inline'",
    // 'unsafe-eval' is only needed in development for Next.js Fast Refresh / HMR.
    // In production, Next.js does not require eval.
    ...(isDev ? ["'unsafe-eval'"] : []),
    "blob:",
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://eu.i.posthog.com https://api.github.com https://cdn.jsdelivr.net",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}

/** Security headers shared by all routes. */
const baseSecurityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/** Headers for the embeddable badge SVG — allows framing from any origin. */
const badgeHeaders = [
  ...baseSecurityHeaders,
  {
    key: "Content-Security-Policy",
    value: buildCsp("*"),
  },
];

/** Headers for all other routes — denies framing entirely. */
const defaultHeaders = [
  ...baseSecurityHeaders,
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Content-Security-Policy",
    value: buildCsp("'none'"),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@chapa/shared"],
  async headers() {
    return [
      // Badge SVG is designed to be embedded in READMEs, iframes, etc.
      // Must come BEFORE the catch-all so Next.js matches it first.
      {
        source: "/u/:handle/badge.svg",
        headers: badgeHeaders,
      },
      // All other routes get strict framing headers.
      {
        source: "/(.*)",
        headers: defaultHeaders,
      },
    ];
  },
};

export default nextConfig;
