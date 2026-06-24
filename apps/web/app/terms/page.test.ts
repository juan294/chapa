import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const source = [
  fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8"),
  fs.readFileSync(path.resolve(__dirname, "TermsPageClient.tsx"), "utf-8"),
].join("\n");

describe("terms page — i18n server component", () => {
  it("forces static rendering with hourly revalidation", () => {
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("export const revalidate = 3600");
    expect(source).not.toContain("export const dynamic = 'force-dynamic'");
  });

  it("exports generateMetadata", () => {
    expect(source).toContain("generateMetadata");
  });

  it("uses getServerT() with DEFAULT_LOCALE", () => {
    expect(source).toContain('from "@/lib/i18n/server"');
    expect(source).toContain('getServerT');
    expect(source).toContain('DEFAULT_LOCALE');
    expect(source).not.toContain('getServerLocale');
  });

  it("renders a main content landmark", () => {
    expect(source).toContain('id="main-content"');
  });

  it("does NOT use static metadata export", () => {
    expect(source).not.toContain("export const metadata");
  });
});
