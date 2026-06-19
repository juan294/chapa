import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);
const EN_DICT = fs.readFileSync(
  path.resolve(__dirname, "../../lib/i18n/dictionaries/en.ts"),
  "utf-8",
);

describe("Verify input page", () => {
  describe("metadata", () => {
    it("exports generateMetadata (locale-aware, async)", () => {
      expect(SOURCE).toContain("generateMetadata");
    });

    it("uses getServerT for metadata title", () => {
      expect(SOURCE).toContain("getServerT");
    });

    it("includes description in metadata", () => {
      expect(SOURCE).toContain("description:");
    });

    it("disables indexing (robots noindex)", () => {
      expect(SOURCE).toContain("index: false");
    });
  });

  describe("static/ISR rendering", () => {
    it("is static/ISR with force-static directive", () => {
      expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
      expect(SOURCE).toContain("export const revalidate");
      expect(SOURCE).toContain("export const dynamic = 'force-static'");
    });

    it("does not use the old SPANISH_PUBLIC_COPY import", () => {
      expect(SOURCE).not.toContain("SPANISH_PUBLIC_COPY");
    });
  });

  describe("default export", () => {
    it("exports a default function component", () => {
      expect(SOURCE).toContain("export default async function VerifyInputPage");
    });
  });

  describe("heading hierarchy", () => {
    it("has an h1 heading", () => {
      expect(SOURCE).toContain("<h1");
    });

    it("heading includes complement color for verification CTA", () => {
      expect(SOURCE).toContain("text-complement");
    });

    it("verify page title copy is in the English dictionary", () => {
      expect(EN_DICT).toContain("badge");
    });
  });

  describe("form integration", () => {
    it("renders VerifyForm component", () => {
      expect(SOURCE).toContain("<VerifyForm");
    });

    it("imports VerifyForm", () => {
      expect(SOURCE).toContain("VerifyForm");
    });
  });

  describe("instructions", () => {
    it("hash format instructions are in the English dictionary", () => {
      expect(EN_DICT).toContain("8, 16, or 32-character");
    });

    it("hint about where to find the hash is in the English dictionary", () => {
      expect(EN_DICT).toContain("right edge");
    });

    it("uses getServerT() for all page copy (i18n-integrated)", () => {
      expect(SOURCE).toContain("getServerT");
    });
  });

  describe("terminal command pattern", () => {
    it("has terminal command line for verify", () => {
      expect(SOURCE).toContain("chapa verify");
    });

    it("uses $ prefix in terminal-dim", () => {
      expect(SOURCE).toContain("text-terminal-dim");
    });
  });

  describe("design system compliance", () => {
    it("uses semantic background token", () => {
      expect(SOURCE).toContain("bg-bg");
    });

    it("uses NavbarClient (ISR-compatible)", () => {
      expect(SOURCE).toContain("NavbarClient");
    });

    it("has main landmark with id", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("uses font-heading", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses border-l border-stroke for content", () => {
      expect(SOURCE).toContain("border-l border-stroke");
    });

    it("uses animate-fade-in-up", () => {
      expect(SOURCE).toContain("animate-fade-in-up");
    });
  });
});
