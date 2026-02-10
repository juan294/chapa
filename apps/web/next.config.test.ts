import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const configSource = readFileSync(
  resolve(__dirname, "next.config.ts"),
  "utf-8",
);

describe("next.config.ts security headers", () => {
  it("defines an async headers() function", () => {
    expect(configSource).toMatch(/async\s+headers\s*\(\)/);
  });

  it("applies headers to all routes via source '/(.*)'", () => {
    expect(configSource).toContain('source: "/(.*)"');
  });

  const requiredHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-XSS-Protection", value: "1; mode=block" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "Content-Security-Policy", value: null },
  ];

  for (const { key, value } of requiredHeaders) {
    it(`includes ${key} header`, () => {
      expect(configSource).toContain(key);
      if (value) {
        expect(configSource).toContain(value);
      }
    });
  }

  describe("Content-Security-Policy directives", () => {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://avatars.githubusercontent.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://eu.i.posthog.com https://api.github.com",
      "frame-ancestors 'none'",
    ];

    for (const directive of cspDirectives) {
      it(`CSP includes "${directive}"`, () => {
        expect(configSource).toContain(directive);
      });
    }
  });
});
