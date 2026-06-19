import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("terms page — i18n server component", () => {
  it("is static/ISR with force-static directive", () => {
    expect(source).not.toContain("export const dynamic = 'force-dynamic'");
    expect(source).toContain("export const revalidate");
  });

  it("exports generateMetadata", () => {
    expect(source).toContain("generateMetadata");
  });

  it("uses DEFAULT_LOCALE and getServerT (no getServerLocale)", () => {
    expect(source).toContain('from "@/lib/i18n/server"');
    expect(source).toContain('getServerT');
    expect(source).not.toContain('getServerLocale');
    expect(source).toContain('DEFAULT_LOCALE');
  });

  it("renders a main content landmark", () => {
    expect(source).toContain('id="main-content"');
  });

  it("does NOT use static metadata export", () => {
    expect(source).not.toContain("export const metadata");
  });
});
