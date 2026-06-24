import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("terms page — i18n server component", () => {
  it("does not use force-static (page must be dynamic to read locale cookie)", () => {
    expect(source).not.toContain("export const dynamic = 'force-static'");
    expect(source).not.toContain("export const dynamic = 'force-dynamic'");
  });

  it("exports generateMetadata", () => {
    expect(source).toContain("generateMetadata");
  });

  it("uses getServerLocale() and getServerT for per-request locale", () => {
    expect(source).toContain('from "@/lib/i18n/server"');
    expect(source).toContain('getServerT');
    expect(source).toContain('getServerLocale');
    expect(source).not.toContain('DEFAULT_LOCALE');
  });

  it("renders a main content landmark", () => {
    expect(source).toContain('id="main-content"');
  });

  it("does NOT use static metadata export", () => {
    expect(source).not.toContain("export const metadata");
  });
});
