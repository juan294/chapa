import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy, resolveProxyLocale, config } from "./proxy";

function makeRequest(
  path: string,
  opts: { cookie?: string; acceptLanguage?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.acceptLanguage) headers.set("accept-language", opts.acceptLanguage);
  return new NextRequest(new URL(`https://chapa.example.com${path}`), {
    headers,
  });
}

describe("resolveProxyLocale", () => {
  it("prefers an explicit supported lang query over the persisted locale", () => {
    const request = makeRequest("/about/verification?lang=en", {
      cookie: "chapa-locale=es",
      acceptLanguage: "es-ES,es;q=0.9",
    });
    expect(resolveProxyLocale(request)).toBe("en");
  });

  it("prefers the chapa-locale cookie over Accept-Language without a supported query", () => {
    const request = makeRequest("/about", {
      cookie: "chapa-locale=en",
      acceptLanguage: "es-ES,es;q=0.9",
    });
    expect(resolveProxyLocale(request)).toBe("en");
  });

  it("ignores an unsupported lang query and falls through to the cookie", () => {
    const request = makeRequest("/about/verification?lang=fr", {
      cookie: "chapa-locale=en",
      acceptLanguage: "es-ES,es;q=0.9",
    });
    expect(resolveProxyLocale(request)).toBe("en");
  });

  it("ignores an unsupported cookie value and falls through to Accept-Language", () => {
    const request = makeRequest("/about", {
      cookie: "chapa-locale=fr",
      acceptLanguage: "en-US,en;q=0.9",
    });
    expect(resolveProxyLocale(request)).toBe("en");
  });

  it("falls back to Accept-Language when there is no cookie", () => {
    const request = makeRequest("/about", { acceptLanguage: "en-GB,en;q=0.8" });
    expect(resolveProxyLocale(request)).toBe("en");
  });

  it("falls back to DEFAULT_LOCALE (es) when neither cookie nor header resolve", () => {
    const request = makeRequest("/about");
    expect(resolveProxyLocale(request)).toBe("es");
  });
});

describe("proxy", () => {
  it("rewrites the root path to the resolved locale's internal route", () => {
    const request = makeRequest("/", { cookie: "chapa-locale=en" });
    const response = proxy(request);
    const rewritten = response.headers.get("x-middleware-rewrite");
    expect(rewritten).toBe("https://chapa.example.com/en");
  });

  it("rewrites a nested content page and preserves the query string", () => {
    const request = makeRequest("/about/scoring?foo=bar", {
      cookie: "chapa-locale=en",
    });
    const response = proxy(request);
    const rewritten = response.headers.get("x-middleware-rewrite");
    expect(rewritten).toBe("https://chapa.example.com/en/about/scoring?foo=bar");
  });

  it("rewrites an explicit English deep link to matching English content", () => {
    const request = makeRequest("/about/verification?lang=en", {
      cookie: "chapa-locale=es",
    });
    const response = proxy(request);
    const rewritten = response.headers.get("x-middleware-rewrite");
    expect(rewritten).toBe(
      "https://chapa.example.com/en/about/verification?lang=en",
    );
  });

  it("rewrites an archetype slug page to the default locale when unresolved", () => {
    const request = makeRequest("/archetypes/builder");
    const response = proxy(request);
    const rewritten = response.headers.get("x-middleware-rewrite");
    expect(rewritten).toBe("https://chapa.example.com/es/archetypes/builder");
  });

  it("is a rewrite, not a redirect (no Location header, 2xx-style passthrough)", () => {
    const request = makeRequest("/privacy");
    const response = proxy(request);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy matcher scope (#1023 / FE-H1 — must stay narrow)", () => {
  const CONTENT_PAGES = [
    "/",
    "/about",
    "/about/scoring",
    "/about/verification",
    "/privacy",
    "/terms",
    "/archetypes/builder",
    "/archetypes/guardian",
    "/archetypes/marathoner",
    "/archetypes/polymath",
    "/archetypes/artificer",
    "/archetypes/balanced",
    "/archetypes/emerging",
  ];

  it("matches exactly the 9 migrated content pages (13 literal paths incl. 7 archetype slugs)", () => {
    expect(config.matcher.sort()).toEqual([...CONTENT_PAGES].sort());
  });

  const OUT_OF_SCOPE_PATHS = [
    "/u/testhandle",
    "/u/testhandle/badge.svg",
    "/u/testhandle/og-image",
    "/api/health",
    "/api/verify/abc123",
    "/studio",
    "/admin",
    "/cli/authorize",
    "/verify",
    "/verify/abc123",
    "/experiments/aurora",
    "/generating/testhandle",
    "/coming-soon",
    "/_next/static/chunk.js",
    "/favicon.svg",
  ];

  for (const path of OUT_OF_SCOPE_PATHS) {
    it(`does NOT match ${path}`, () => {
      expect(config.matcher).not.toContain(path);
      // The matcher is a static list of exact literal paths (no wildcards),
      // so containment is the correct check for "would Next.js run
      // middleware for this request" for every path in this list.
      expect(config.matcher.includes(path)).toBe(false);
    });
  }

  it("does not absorb the existing per-page auth/flag gates", () => {
    for (const gated of ["/studio", "/admin", "/cli/authorize"]) {
      expect(config.matcher).not.toContain(gated);
    }
  });
});
