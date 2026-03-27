import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ClientAnalytics.tsx"),
  "utf-8",
);

describe("ClientAnalytics", () => {
  it("is a client component", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("exports a named ClientAnalytics function", () => {
    expect(SOURCE).toMatch(/export function ClientAnalytics/);
  });

  it("dynamically imports Vercel Analytics", () => {
    expect(SOURCE).toContain("@vercel/analytics/react");
  });

  it("dynamically imports Vercel SpeedInsights", () => {
    expect(SOURCE).toContain("@vercel/speed-insights/next");
  });

  it("disables SSR for analytics components", () => {
    expect(SOURCE).toContain("ssr: false");
  });

  it("renders both Analytics and SpeedInsights components", () => {
    expect(SOURCE).toContain("<Analytics />");
    expect(SOURCE).toContain("<SpeedInsights />");
  });
});
