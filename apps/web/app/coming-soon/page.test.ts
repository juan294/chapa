import { describe, it, expect, vi } from "vitest";

// Mock getServerLocale + getServerT to return English without needing Next.js headers()
vi.mock("@/lib/i18n/server", async () => {
  const { en } = await import("@/lib/i18n/dictionaries/en");
  function deepGet(obj: Record<string, unknown>, key: string): unknown {
    const parts = key.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || typeof current !== "object" || Array.isArray(current)) return key;
      current = (current as Record<string, unknown>)[part];
      if (current === undefined) return key;
    }
    return current;
  }
  return {
    getServerLocale: vi.fn().mockResolvedValue("en"),
    getServerT: vi.fn().mockImplementation(() => (key: string) =>
      deepGet(en as unknown as Record<string, unknown>, key)
    ),
  };
});

// Mock LocaleSync (client component, no-op in server tests)
vi.mock("@/lib/i18n", () => ({
  LocaleSync: () => null,
}));

describe("coming-soon page", () => {
  it("generateMetadata returns noindex robots directive", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(metadata).toBeDefined();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("generateMetadata returns comingSoon.metadataTitle as title", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(metadata.title).toBe("Coming soon");
  });

  it("exports a default component", async () => {
    const mod = await import("./page");
    expect(typeof mod.default).toBe("function");
  });

  it("does not export a static metadata object (uses generateMetadata)", async () => {
    const mod = await import("./page");
    expect((mod as Record<string, unknown>).metadata).toBeUndefined();
  });
});
