import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("terms page — i18n server component", () => {
  it("exports dynamic = 'force-dynamic'", () => {
    expect(source).toContain("export const dynamic = 'force-dynamic'");
  });

  it("exports generateMetadata", () => {
    expect(source).toContain("export async function generateMetadata");
  });

  it("imports getServerT and getServerLocale from @/lib/i18n/server", () => {
    expect(source).toContain('from "@/lib/i18n/server"');
    expect(source).toContain('getServerT');
    expect(source).toContain('getServerLocale');
  });

  it("renders a main content landmark", () => {
    expect(source).toContain('id="main-content"');
  });

  it("does NOT use static metadata export", () => {
    expect(source).not.toContain("export const metadata");
  });

  it("does NOT export revalidate", () => {
    expect(source).not.toContain("export const revalidate");
  });
});
