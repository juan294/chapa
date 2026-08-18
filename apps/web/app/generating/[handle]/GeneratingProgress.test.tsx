import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "GeneratingProgress.tsx"),
  "utf-8",
);
const EN_DICT = fs.readFileSync(
  path.resolve(__dirname, "../../../lib/i18n/dictionaries/en.ts"),
  "utf-8",
);

describe("GeneratingProgress", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toMatch(/^["']use client["']/m);
  });

  describe("progress steps", () => {
    it("GitHub session check step copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Checking GitHub session");
    });

    it("contribution fetch step copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Collecting contribution data");
    });

    it("impact profile step copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Computing impact profile");
    });

    it("badge render step copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Rendering badge");
    });

    it("uses useTranslation() for step labels (i18n-reactive)", () => {
      expect(SOURCE).toContain("useTranslation");
    });

    it("step labels are derived from translation keys (step0–step3)", () => {
      expect(SOURCE).toContain("generation.step0");
      expect(SOURCE).toContain("generation.step1");
      expect(SOURCE).toContain("generation.step2");
      expect(SOURCE).toContain("generation.step3");
    });

    it("does not use the old SPANISH_PUBLIC_COPY import", () => {
      expect(SOURCE).not.toContain("SPANISH_PUBLIC_COPY");
    });
  });

  describe("error handling", () => {
    it("retry copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Try again");
    });

    it("has error state", () => {
      expect(SOURCE).toContain("error");
    });

    it("branches on response status instead of collapsing every failure into one message (#1108)", () => {
      expect(SOURCE).toContain("res.status");
      expect(SOURCE).toContain("429");
      expect(SOURCE).toContain("401");
    });

    it("status-specific copy keys are in the English dictionary", () => {
      expect(EN_DICT).toContain("errorRateLimited");
      expect(EN_DICT).toContain("errorSession");
    });

    it("offers a sign-in-again link on session expiry instead of a same-URL retry (#1108)", () => {
      expect(SOURCE).toContain("/api/auth/login");
      expect(SOURCE).toContain("generation.signInAgain");
    });

    it("shows reassurance copy after a slow start", () => {
      expect(SOURCE).toContain("generation.stillWorking");
    });
  });

  describe("API integration", () => {
    it("calls POST /api/generate", () => {
      expect(SOURCE).toContain('"/api/generate"');
      expect(SOURCE).toContain('"POST"');
    });

    it("includes credentials for session cookie", () => {
      expect(SOURCE).toContain('"include"');
    });

    it("guards the request with a ~45s timeout so a stalled request cannot hang forever (#1108)", () => {
      expect(SOURCE).toContain("AbortController");
      expect(SOURCE).toMatch(/GENERATE_TIMEOUT_MS\s*=\s*45[_]?000/);
    });
  });

  describe("navigation", () => {
    it("uses useRouter for redirect", () => {
      expect(SOURCE).toContain("useRouter");
    });

    it("redirects to /u/:handle on success", () => {
      expect(SOURCE).toContain("/u/${handle}");
    });
  });

  describe("accessibility", () => {
    it("uses aria-live for progress announcements", () => {
      expect(SOURCE).toContain("aria-live");
    });

    it("uses role=status for progress area", () => {
      expect(SOURCE).toContain('role="status"');
    });

    it("has role='alert' on the error message container", () => {
      expect(SOURCE).toContain('role="alert"');
    });

    it("wraps content in a main landmark with skip-link target (#456)", () => {
      expect(SOURCE).toContain("<main");
      expect(SOURCE).toContain('id="main-content"');
    });
  });

  describe("design system compliance", () => {
    it("uses JetBrains Mono for terminal text (font-heading)", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses terminal-green for success checkmarks", () => {
      expect(SOURCE).toContain("terminal-green");
    });

    it("uses amber accent color", () => {
      expect(SOURCE).toContain("text-amber");
    });

    it("uses bg-bg for page background", () => {
      expect(SOURCE).toContain("bg-bg");
    });
  });
});
