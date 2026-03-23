import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("terms page — source structure", () => {
  it("exports revalidate = 86400 for ISR", () => {
    expect(source).toContain("export const revalidate = 86400");
  });

  it("exports metadata with Terms of Service title", () => {
    expect(source).toContain("export const metadata");
    expect(source).toContain("Terms of Service");
  });

  it("renders a main content landmark", () => {
    expect(source).toContain('id="main-content"');
  });

  it("contains Terms of Service heading text", () => {
    expect(source).toContain("Terms of");
    expect(source).toContain("Service");
  });

  it("includes section headings for legal content", () => {
    expect(source).toContain("Acceptance of Terms");
    expect(source).toContain("Limitation of Liability");
  });
});
