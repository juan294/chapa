import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "VerifyForm.tsx"),
  "utf-8",
);
const EN_DICT = fs.readFileSync(
  path.resolve(__dirname, "../../lib/i18n/dictionaries/en.ts"),
  "utf-8",
);

describe("VerifyForm", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("hash validation", () => {
    it("defines HASH_PATTERN for 8, 16, or 32 hex characters", () => {
      expect(SOURCE).toContain("HASH_PATTERN");
    });

    it("trims and lowercases input before validation", () => {
      expect(SOURCE).toContain("hash.trim().toLowerCase()");
    });

    it("invalid hash error copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Enter a valid 8, 16, or 32-character hex hash");
    });
  });

  describe("form structure", () => {
    it("renders a form element with onSubmit", () => {
      expect(SOURCE).toContain("<form onSubmit={handleSubmit}");
    });

    it("has a labeled input", () => {
      expect(SOURCE).toContain('htmlFor="hash-input"');
      expect(SOURCE).toContain('id="hash-input"');
    });

    it("label copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Verification hash");
    });

    it("input has maxLength of 32", () => {
      expect(SOURCE).toContain("maxLength={32}");
    });

    it("input has placeholder with example hash", () => {
      expect(SOURCE).toContain('placeholder="a1b2c3d4e5f6a7b8"');
    });

    it("input disables autocomplete and spellcheck", () => {
      expect(SOURCE).toContain('autoComplete="off"');
      expect(SOURCE).toContain("spellCheck={false}");
    });

    it("submit button copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("Verify");
    });

    it("uses useTranslation() (i18n-integrated)", () => {
      expect(SOURCE).toContain("useTranslation");
    });

    it("does not use the old SPANISH_PUBLIC_COPY import", () => {
      expect(SOURCE).not.toContain("SPANISH_PUBLIC_COPY");
    });
  });

  describe("navigation on valid submit", () => {
    it("uses router.push to navigate to verify/[hash]", () => {
      expect(SOURCE).toContain("router.push(`/verify/${trimmed}?lang=${locale}`)");
    });

    it("imports useRouter from next/navigation", () => {
      expect(SOURCE).toContain("useRouter");
      expect(SOURCE).toContain("next/navigation");
    });
  });

  describe("error handling", () => {
    it("clears error on input change", () => {
      expect(SOURCE).toContain('setError("")');
    });

    it("uses useState for error state", () => {
      expect(SOURCE).toContain("useState");
    });
  });

  describe("accessibility", () => {
    it("has role='alert' on the error message", () => {
      expect(SOURCE).toContain('role="alert"');
    });

    it("focus ring on input has sufficient opacity (#435)", () => {
      expect(SOURCE).toContain("ring-complement/50");
      expect(SOURCE).not.toContain("ring-complement/20");
    });

    it("decorative icon has aria-hidden", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });
  });

  describe("design system compliance", () => {
    it("uses complement color for submit button (verification CTA)", () => {
      expect(SOURCE).toContain("bg-complement");
    });

    it("uses white text on button", () => {
      expect(SOURCE).toContain("text-white");
    });

    it("uses rounded-lg on button", () => {
      expect(SOURCE).toContain("rounded-lg");
    });

    it("uses font-heading for input text", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses semantic tokens for input styling", () => {
      expect(SOURCE).toContain("bg-card");
      expect(SOURCE).toContain("border-stroke");
      expect(SOURCE).toContain("text-text-primary");
    });

    it("uses terminal-red for error text", () => {
      expect(SOURCE).toContain("text-terminal-red");
    });
  });
});
