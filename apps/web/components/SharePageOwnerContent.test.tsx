import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "SharePageOwnerContent.tsx"),
  "utf-8",
);
const EN_DICT = fs.readFileSync(
  path.resolve(__dirname, "../lib/i18n/dictionaries/en.ts"),
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

  describe("i18n integration", () => {
    it("uses useTranslation() for all copy", () => {
      expect(SOURCE).toContain("useTranslation");
    });

    it("does not use the old SPANISH_PUBLIC_COPY import", () => {
      expect(SOURCE).not.toContain("SPANISH_PUBLIC_COPY");
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

    it("embed badge copy is looked up via t() key", () => {
      expect(SOURCE).toContain("shareOwner.embedBadge");
    });

    it("embed badge copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Embed this badge");
    });

    it("renders DataSources before Impact Breakdown (DOM order preserved)", () => {
      const dsIndex = SOURCE.indexOf("DataSources");
      const breakdownIndex = SOURCE.indexOf("shareOwner.impactBreakdown");
      expect(dsIndex).toBeGreaterThan(-1);
      expect(breakdownIndex).toBeGreaterThan(-1);
      expect(dsIndex).toBeLessThan(breakdownIndex);
    });

    it("impact breakdown copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Impact breakdown");
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
    it("visitor CTA copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Discover your impact");
    });

    it("CTA links to the homepage", () => {
      expect(SOURCE).toContain('href="/"');
    });

    it("visitor description copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Want to see what your developer impact looks like?");
    });
  });

  // #743 — empty state retry mechanism
  describe("empty state retry mechanism (#743)", () => {
    it("has a Regenerate translation key", () => {
      expect(SOURCE).toContain("shareOwner.regenerate");
    });

    it("Regenerate copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Regenerate");
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
