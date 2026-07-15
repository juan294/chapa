import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// #1023 (FE-H1) — terms/page.tsx is now a single, fully server-rendered
// page (no more separate TermsPageClient) translating via
// getServerT(locale) with `locale` sourced from the route's [locale]
// segment param (populated by proxy.ts).
const source = fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8");

describe("terms page — i18n server component", () => {
  it("forces static rendering with hourly revalidation", () => {
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("export const revalidate = 3600");
    expect(source).not.toContain("export const dynamic = 'force-dynamic'");
  });

  it("exports generateMetadata", () => {
    expect(source).toContain("generateMetadata");
  });

  it("uses getServerT() with the [locale] route param", () => {
    expect(source).toContain('from "@/lib/i18n/server"');
    expect(source).toContain('getServerT');
    expect(source).not.toContain('DEFAULT_LOCALE');
    expect(source).not.toContain('getServerLocale');
    expect(source).toContain('params');
  });

  it("renders a main content landmark", () => {
    expect(source).toContain('id="main-content"');
  });

  it("does NOT use static metadata export", () => {
    expect(source).not.toContain("export const metadata");
  });
});
