import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * We dynamically import next.config.ts so we can manipulate NODE_ENV
 * before the module evaluates. Each test that needs a specific NODE_ENV
 * must reset modules.
 */

async function loadConfig() {
  const mod = await import("./next.config");
  return mod.default;
}

/**
 * Helper: given the headers array returned by next config, find the
 * entry whose `source` pattern matches the given path.
 *
 * Next.js matches headers in order — first match wins.
 * We replicate that: return the FIRST entry whose source matches.
 */
function findMatchingHeaders(
  headersArray: Array<{ source: string; headers: Array<{ key: string; value: string }> }>,
  path: string,
): Array<{ key: string; value: string }> | undefined {
  for (const entry of headersArray) {
    // Convert Next.js source pattern to regex
    // Next.js uses :param for dynamic segments and (regex) for inline regex
    let pattern = entry.source;
    // Replace :param with a generic segment match
    pattern = pattern.replace(/:[a-zA-Z]+/g, "[^/]+");
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(path)) {
      return entry.headers;
    }
  }
  return undefined;
}

function getHeaderValue(
  headers: Array<{ key: string; value: string }>,
  key: string,
): string | undefined {
  return headers.find(
    (h) => h.key.toLowerCase() === key.toLowerCase(),
  )?.value;
}

describe("next.config.ts security headers", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  describe("general (non-badge) routes", () => {
    it("applies X-Frame-Options: DENY to non-badge routes", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/some/page");
      expect(matched).toBeDefined();
      expect(getHeaderValue(matched!, "X-Frame-Options")).toBe("DENY");
    });

    it("applies frame-ancestors 'none' in CSP for non-badge routes", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/");
      expect(matched).toBeDefined();
      const csp = getHeaderValue(matched!, "Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("includes all required security headers on non-badge routes", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/u/someone");
      expect(matched).toBeDefined();
      expect(getHeaderValue(matched!, "X-Content-Type-Options")).toBe("nosniff");
      expect(getHeaderValue(matched!, "X-XSS-Protection")).toBe("1; mode=block");
      expect(getHeaderValue(matched!, "Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(getHeaderValue(matched!, "Strict-Transport-Security")).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
    });
  });

  describe("badge SVG route (/u/:handle/badge.svg)", () => {
    it("does NOT apply X-Frame-Options to the badge route", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/u/juan294/badge.svg");
      expect(matched).toBeDefined();
      const xfo = getHeaderValue(matched!, "X-Frame-Options");
      // Badge route should either not have X-Frame-Options or not be DENY
      expect(xfo).toBeUndefined();
    });

    it("uses frame-ancestors * in CSP for the badge route", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/u/juan294/badge.svg");
      expect(matched).toBeDefined();
      const csp = getHeaderValue(matched!, "Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("frame-ancestors *");
      expect(csp).not.toContain("frame-ancestors 'none'");
    });

    it("still includes other security headers on the badge route", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/u/juan294/badge.svg");
      expect(matched).toBeDefined();
      expect(getHeaderValue(matched!, "X-Content-Type-Options")).toBe("nosniff");
      expect(getHeaderValue(matched!, "Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  });

  describe("W3: CSP unsafe-eval is environment-dependent", () => {
    it("includes 'unsafe-eval' in script-src in development", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      vi.resetModules();
      const mod = await import("./next.config");
      const config = mod.default;
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/");
      expect(matched).toBeDefined();
      const csp = getHeaderValue(matched!, "Content-Security-Policy");
      expect(csp).toContain("'unsafe-eval'");
    });

    it("does NOT include 'unsafe-eval' in script-src in production", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      vi.resetModules();
      const mod = await import("./next.config");
      const config = mod.default;
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/");
      expect(matched).toBeDefined();
      const csp = getHeaderValue(matched!, "Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it("always includes 'unsafe-inline' in script-src with explanatory comment in source", async () => {
      // Check that unsafe-inline is present regardless of environment
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      vi.resetModules();
      const mod = await import("./next.config");
      const config = mod.default;
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/");
      expect(matched).toBeDefined();
      const csp = getHeaderValue(matched!, "Content-Security-Policy");
      expect(csp).toContain("'unsafe-inline'");
    });
  });

  describe("headers array ordering", () => {
    it("badge route entry comes before the catch-all entry", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      // There should be at least 2 entries
      expect(headersArray.length).toBeGreaterThanOrEqual(2);

      // Find indices
      const badgeIndex = headersArray.findIndex((h: { source: string }) =>
        h.source.includes("badge"),
      );
      const catchAllIndex = headersArray.findIndex(
        (h: { source: string }) => !h.source.includes("badge"),
      );

      expect(badgeIndex).toBeGreaterThanOrEqual(0);
      expect(catchAllIndex).toBeGreaterThanOrEqual(0);
      expect(badgeIndex).toBeLessThan(catchAllIndex);
    });
  });

  describe("W4: Permissions-Policy header", () => {
    it("includes Permissions-Policy header on non-badge routes", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/some/page");
      expect(matched).toBeDefined();
      const pp = getHeaderValue(matched!, "Permissions-Policy");
      expect(pp).toBeDefined();
      expect(pp).toContain("camera=()");
      expect(pp).toContain("microphone=()");
      expect(pp).toContain("geolocation=()");
      expect(pp).toContain("interest-cohort=()");
    });

    it("includes Permissions-Policy header on badge route", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/u/juan294/badge.svg");
      expect(matched).toBeDefined();
      const pp = getHeaderValue(matched!, "Permissions-Policy");
      expect(pp).toBeDefined();
      expect(pp).toContain("camera=()");
    });
  });

  describe("CSP connect-src includes Vercel Analytics", () => {
    it("includes va.vercel-scripts.com in connect-src", async () => {
      const config = await loadConfig();
      const headersArray = await config.headers!();
      const matched = findMatchingHeaders(headersArray, "/");
      expect(matched).toBeDefined();
      const csp = getHeaderValue(matched!, "Content-Security-Policy");
      expect(csp).toContain("https://va.vercel-scripts.com");
    });
  });

  describe("source code contains explanatory comment for unsafe-inline", () => {
    it("has a comment explaining why unsafe-inline is needed", async () => {
      const { readFileSync } = await import("fs");
      const { resolve } = await import("path");
      const configSource = readFileSync(
        resolve(__dirname, "next.config.ts"),
        "utf-8",
      );
      // Should have a comment near unsafe-inline explaining it's needed for Next.js
      expect(configSource).toMatch(/unsafe-inline[\s\S]*Next\.js|Next\.js[\s\S]*unsafe-inline/i);
    });
  });
});
