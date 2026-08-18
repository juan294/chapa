import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "loading.tsx"),
  "utf-8",
);

describe("Verify loading.tsx", () => {
  it("renders a default export function", () => {
    expect(SOURCE).toMatch(/export default function/);
  });

  it("uses bg-bg for page background", () => {
    expect(SOURCE).toContain("bg-bg");
  });

  it("uses animate-pulse for skeleton effect", () => {
    expect(SOURCE).toContain("animate-pulse");
  });

  it("has role='status' on the main container", () => {
    expect(SOURCE).toContain('role="status"');
  });

  // #1109 (UX-H3): the aria-label and sr-only text must come from the i18n
  // dictionary, not a hardcoded English literal.
  it("resolves aria-label and sr-only text via getServerT(DEFAULT_LOCALE)", () => {
    expect(SOURCE).toContain("getServerT");
    expect(SOURCE).toContain('t("aria.loading")');
    expect(SOURCE).toContain('t("common.loading")');
    expect(SOURCE).not.toMatch(/aria-label="Loading"/);
  });

  it("has an sr-only loading text span", () => {
    expect(SOURCE).toContain('className="sr-only"');
  });
});
