import { describe, it, expect } from "vitest";
import {
  SCORING_WINDOW_DAYS,
  PR_WEIGHT_AGG_CAP,
  SCORING_CAPS,
  REPO_DEPTH_THRESHOLD,
} from "./constants";

describe("shared/constants", () => {
  describe("SCORING_WINDOW_DAYS", () => {
    it("is exported", () => {
      expect(SCORING_WINDOW_DAYS).toBeDefined();
    });

    it("is a number", () => {
      expect(typeof SCORING_WINDOW_DAYS).toBe("number");
    });

    it("equals 365", () => {
      expect(SCORING_WINDOW_DAYS).toBe(365);
    });

    it("is a positive integer", () => {
      expect(SCORING_WINDOW_DAYS).toBeGreaterThan(0);
      expect(Number.isInteger(SCORING_WINDOW_DAYS)).toBe(true);
    });
  });

  describe("PR_WEIGHT_AGG_CAP", () => {
    it("is exported", () => {
      expect(PR_WEIGHT_AGG_CAP).toBeDefined();
    });

    it("is a number", () => {
      expect(typeof PR_WEIGHT_AGG_CAP).toBe("number");
    });

    it("equals 120", () => {
      expect(PR_WEIGHT_AGG_CAP).toBe(120);
    });

    it("is a positive integer", () => {
      expect(PR_WEIGHT_AGG_CAP).toBeGreaterThan(0);
      expect(Number.isInteger(PR_WEIGHT_AGG_CAP)).toBe(true);
    });
  });

  describe("SCORING_CAPS", () => {
    it("is exported", () => {
      expect(SCORING_CAPS).toBeDefined();
    });

    it("is an object", () => {
      expect(typeof SCORING_CAPS).toBe("object");
      expect(SCORING_CAPS).not.toBeNull();
    });

    it("has all expected keys", () => {
      const expectedKeys = [
        "prWeight",
        "issues",
        "commits",
        "reviews",
        "repos",
        "stars",
        "forks",
        "watchers",
      ];
      for (const key of expectedKeys) {
        expect(SCORING_CAPS).toHaveProperty(key);
      }
    });

    it("all values are positive numbers", () => {
      for (const [key, value] of Object.entries(SCORING_CAPS)) {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThan(0);
      }
    });

    it("all values are integers", () => {
      for (const value of Object.values(SCORING_CAPS)) {
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("has expected V5 specific values", () => {
      expect(SCORING_CAPS.prWeight).toBe(60);
      expect(SCORING_CAPS.issues).toBe(40);
      expect(SCORING_CAPS.commits).toBe(300);
      expect(SCORING_CAPS.reviews).toBe(80);
      expect(SCORING_CAPS.repos).toBe(12);
      expect(SCORING_CAPS.stars).toBe(150);
      expect(SCORING_CAPS.forks).toBe(80);
      expect(SCORING_CAPS.watchers).toBe(50);
    });

    it("prWeight is less than PR_WEIGHT_AGG_CAP (scoring cap < agg cap)", () => {
      expect(SCORING_CAPS.prWeight).toBeLessThan(PR_WEIGHT_AGG_CAP);
    });

    it("no values are undefined or NaN", () => {
      for (const value of Object.values(SCORING_CAPS)) {
        expect(value).not.toBeUndefined();
        expect(value).not.toBeNaN();
      }
    });
  });

  describe("REPO_DEPTH_THRESHOLD", () => {
    it("is exported", () => {
      expect(REPO_DEPTH_THRESHOLD).toBeDefined();
    });

    it("is a number", () => {
      expect(typeof REPO_DEPTH_THRESHOLD).toBe("number");
    });

    it("equals 3", () => {
      expect(REPO_DEPTH_THRESHOLD).toBe(3);
    });

    it("is a positive integer", () => {
      expect(REPO_DEPTH_THRESHOLD).toBeGreaterThan(0);
      expect(Number.isInteger(REPO_DEPTH_THRESHOLD)).toBe(true);
    });

    it("is less than commits cap (sanity)", () => {
      expect(REPO_DEPTH_THRESHOLD).toBeLessThan(SCORING_CAPS.commits);
    });
  });
});
