import { readFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import { getBaseUrl, getAdminHandles } from "./env";

// Next.js only inlines NEXT_PUBLIC_* env vars into the client bundle when they
// are referenced as a STATIC LITERAL member expression (process.env.NEXT_PUBLIC_X).
// Dynamic access (process.env[name]) is never substituted, so any NEXT_PUBLIC_*
// reader routed through readTrimmed(name) returns undefined in the browser — which
// silently disabled client-side feature flags (platform link/unlink rows). See #918.
// Runtime tests run in Node where process.env[name] works, so this regression can
// only be guarded at the source level.
describe("env.ts NEXT_PUBLIC readers use static literal access (#918)", () => {
  const source = readFileSync(new URL("./env.ts", import.meta.url), "utf8");
  const publicVars = [
    ...new Set(source.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? []),
  ];

  it("finds NEXT_PUBLIC vars to check", () => {
    expect(publicVars.length).toBeGreaterThan(0);
  });

  for (const name of publicVars) {
    it(`reads ${name} via static literal, not dynamic readTrimmed`, () => {
      // Must be referenced literally so the bundler can inline it client-side.
      expect(source).toContain(`process.env.${name}`);
      // Must NOT be read via the dynamic helper (won't inline on the client).
      expect(source).not.toContain(`readTrimmed("${name}")`);
    });
  }
});

describe("env boundary lint coverage", () => {
  it("blocks computed process.env reads outside lib/env.ts", () => {
    const source = readFileSync(
      new URL("../eslint.config.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      "MemberExpression[object.object.name='process'][object.property.name='env']",
    );
    expect(source).not.toContain("computed=false");
  });
});

describe("getBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns env var when NEXT_PUBLIC_BASE_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://custom.example.com");
    expect(getBaseUrl()).toBe("https://custom.example.com");
  });

  it("returns fallback when NEXT_PUBLIC_BASE_URL is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(getBaseUrl()).toBe("https://chapa.thecreativetoken.com");
  });

  it("returns fallback when NEXT_PUBLIC_BASE_URL is undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
    expect(getBaseUrl()).toBe("https://chapa.thecreativetoken.com");
  });

  it("trims whitespace from env var", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "  https://custom.example.com  \n");
    expect(getBaseUrl()).toBe("https://custom.example.com");
  });
});

describe("getAdminHandles", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns parsed list when ADMIN_HANDLES is set", () => {
    vi.stubEnv("ADMIN_HANDLES", "alice,bob, carol ");
    expect(getAdminHandles()).toEqual(["alice", "bob", "carol"]);
  });

  it("returns empty array when ADMIN_HANDLES is not set", () => {
    vi.stubEnv("ADMIN_HANDLES", undefined);
    expect(getAdminHandles()).toEqual([]);
  });
});
