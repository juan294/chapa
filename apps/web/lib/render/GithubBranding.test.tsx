import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "GithubBranding.tsx"),
  "utf-8",
);

describe("GithubBranding — SVG branding component", () => {
  it("exports a function", () => {
    expect(SOURCE).toMatch(/export function \w+/);
  });

  it("contains 'GitHub' text", () => {
    expect(SOURCE).toContain("GitHub");
  });

  it("contains SVG path markup (octocat icon)", () => {
    expect(SOURCE).toContain("<path d=");
  });

  it("contains 'Powered by' branding text", () => {
    expect(SOURCE).toContain("Powered by");
  });

  it("contains the domain text", () => {
    expect(SOURCE).toContain("chapa.thecreativetoken.com");
  });
});
