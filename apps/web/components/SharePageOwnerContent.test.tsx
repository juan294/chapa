import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "SharePageOwnerContent.tsx"),
  "utf-8",
);
const COPY_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../lib/copy/public-flow.ts"),
  "utf-8",
);

describe("SharePageOwnerContent", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });

    it("does NOT import from next/headers", () => {
      expect(SOURCE).not.toContain("next/headers");
    });
  });

  describe("session detection", () => {
    it("fetches session from /api/auth/session", () => {
      expect(SOURCE).toContain("/api/auth/session");
    });

    it("compares session login to handle for isOwner", () => {
      expect(SOURCE).toContain("handle");
    });
  });

  describe("public insight sections", () => {
    it("renders DataSources component for public viewers", () => {
      expect(SOURCE).toContain("DataSources");
    });

    it("renders ImpactDashboard component for public viewers", () => {
      expect(SOURCE).toContain("ImpactDashboard");
    });

    it("renders embed snippets for public viewers", () => {
      expect(SOURCE).toContain("Incrustar esta insignia");
    });

    it("renders DataSources before Impact Breakdown heading", () => {
      const dsIndex = SOURCE.indexOf("DataSources");
      const breakdownIndex = SOURCE.indexOf("Desglose de impacto");
      expect(dsIndex).toBeGreaterThan(-1);
      expect(breakdownIndex).toBeGreaterThan(-1);
      expect(dsIndex).toBeLessThan(breakdownIndex);
    });

    it("passes stats and handle to DataSources", () => {
      expect(SOURCE).toContain("stats={stats}");
      expect(SOURCE).toContain("handle={handle}");
    });
  });

  // #440 — embed snippet includes both width and height for proper aspect ratio
  describe("embed snippet dimensions", () => {
    it("embed HTML includes width=\"600\" and height=\"315\"", () => {
      expect(SOURCE).toContain('width="600"');
      expect(SOURCE).toContain('height="315"');
    });
  });

  describe("visitor CTA", () => {
    it("shows a Spanish impact CTA for non-owners", () => {
      expect(COPY_SOURCE).toContain("Descubre tu impacto");
    });

    it("CTA links to the homepage", () => {
      expect(SOURCE).toContain('href="/"');
    });

    it("uses curiosity-driven copy that focuses on the reader", () => {
      expect(COPY_SOURCE).toContain("¿Quieres ver cómo se ve tu impacto como desarrollador?");
    });

    it("uses centralized public-flow copy", () => {
      expect(SOURCE).toContain("SPANISH_PUBLIC_COPY");
    });
  });

  // #743 — empty state retry mechanism
  describe("empty state retry mechanism (#743)", () => {
    it("has a Regenerate button in the empty state", () => {
      expect(SOURCE).toContain("Regenerar");
    });

    it("empty state calls /api/refresh endpoint", () => {
      expect(SOURCE).toContain("/api/refresh");
    });

    it("empty state includes support mailto link", () => {
      expect(SOURCE).toContain("mailto:");
    });

    it("Regenerate button uses POST method", () => {
      expect(SOURCE).toContain('method: "POST"');
    });
  });
});
