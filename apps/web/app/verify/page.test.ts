import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);
const COPY_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../lib/copy/public-flow.ts"),
  "utf-8",
);

describe("Verify input page", () => {
  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain('title: SPANISH_PUBLIC_COPY.verify.title');
    });

    it("includes description", () => {
      expect(SOURCE).toContain("description:");
    });

    it("disables indexing (robots noindex)", () => {
      expect(SOURCE).toContain("index: false");
    });
  });

  describe("default export", () => {
    it("exports a default function component", () => {
      expect(SOURCE).toContain("export default function VerifyInputPage");
    });
  });

  describe("heading hierarchy", () => {
    it("has an h1 heading", () => {
      expect(SOURCE).toContain("<h1");
    });

    it("heading includes Spanish badge copy in complement color", () => {
      expect(SOURCE).toContain("text-complement");
      expect(COPY_SOURCE).toContain("insignia");
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
    it("explains hash format (8, 16, or 32 characters)", () => {
      expect(COPY_SOURCE).toContain("8, 16 o 32 caracteres");
    });

    it("tells user where to find the hash", () => {
      expect(COPY_SOURCE).toContain("borde derecho");
    });

    it("uses centralized public-flow copy", () => {
      expect(SOURCE).toContain("SPANISH_PUBLIC_COPY");
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

    it("uses Navbar", () => {
      expect(SOURCE).toContain("<Navbar");
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
