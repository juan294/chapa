import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ShareBadgePreview.tsx"),
  "utf-8",
);

describe("ShareBadgePreview", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("props interface", () => {
    it("accepts BadgeConfig prop", () => {
      expect(SOURCE).toContain("config: BadgeConfig");
    });

    it("accepts Stats90d prop", () => {
      expect(SOURCE).toContain("stats: Stats90d");
    });

    it("accepts ImpactV4Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV4Result");
    });
  });

  describe("rendering", () => {
    it("uses BadgePreviewCard component", () => {
      expect(SOURCE).toContain("BadgePreviewCard");
    });

    it("imports from studio directory", () => {
      expect(SOURCE).toContain("@/app/studio/BadgePreviewCard");
    });
  });
});
