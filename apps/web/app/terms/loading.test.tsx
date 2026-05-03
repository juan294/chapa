import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "loading.tsx"),
  "utf-8",
);

describe("Terms loading.tsx", () => {
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

  it("has an sr-only loading text span", () => {
    expect(SOURCE).toContain('className="sr-only"');
  });

  it("uses terminal aesthetic with font-heading", () => {
    expect(SOURCE).toContain("font-heading");
  });

  it("uses useTranslation for i18n", () => {
    expect(SOURCE).toContain("useTranslation");
  });

  it("uses common.loading key", () => {
    expect(SOURCE).toContain("common.loading");
  });
});
