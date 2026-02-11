import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "StudioClient.tsx"),
  "utf-8",
);

describe("StudioClient", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("state management", () => {
    it("uses useState for config state", () => {
      expect(SOURCE).toContain("useState<BadgeConfig>");
    });

    it("accepts initial config as prop", () => {
      expect(SOURCE).toContain("initialConfig");
    });

    it("has save handler", () => {
      expect(SOURCE).toContain("/api/studio/config");
    });

    it("tracks saving state", () => {
      expect(SOURCE).toContain("saving");
    });

    it("tracks saved toast state", () => {
      expect(SOURCE).toContain("saved");
    });
  });

  describe("layout", () => {
    it("renders BadgePreviewCard in preview pane", () => {
      expect(SOURCE).toContain("BadgePreviewCard");
    });

    it("renders StudioControls in controls pane", () => {
      expect(SOURCE).toContain("StudioControls");
    });

    it("has responsive split layout classes", () => {
      expect(SOURCE).toContain("lg:grid-cols");
    });
  });

  describe("props interface", () => {
    it("accepts Stats90d prop", () => {
      expect(SOURCE).toContain("stats: Stats90d");
    });

    it("accepts ImpactV3Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV3Result");
    });

    it("accepts BadgeConfig initial config", () => {
      expect(SOURCE).toContain("initialConfig: BadgeConfig");
    });
  });

  describe("save functionality", () => {
    it("uses PUT method for saving", () => {
      expect(SOURCE).toContain('method: "PUT"');
    });

    it("sends JSON body", () => {
      expect(SOURCE).toContain("JSON.stringify");
    });
  });

  describe("reset functionality", () => {
    it("imports DEFAULT_BADGE_CONFIG for reset", () => {
      expect(SOURCE).toContain("DEFAULT_BADGE_CONFIG");
    });
  });
});
