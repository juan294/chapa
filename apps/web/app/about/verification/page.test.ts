import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("VerificationPage", () => {
  describe("ISR", () => {
    it("exports revalidate = 3600", () => {
      expect(SOURCE).toContain("export const revalidate = 3600");
    });
  });

  describe("metadata", () => {
    it("exports metadata with title", () => {
      expect(SOURCE).toContain('title: "Badge Verification"');
    });

    it("includes openGraph metadata", () => {
      expect(SOURCE).toContain("openGraph:");
    });

    it("includes twitter card metadata", () => {
      expect(SOURCE).toContain("twitter:");
    });
  });

  it("exports a default component", () => {
    expect(SOURCE).toMatch(/export default function \w+/);
  });

  describe("heading hierarchy", () => {
    it("has an h1 heading", () => {
      expect(SOURCE).toContain("<h1");
    });

    it("uses SectionHeading component for h2 headings", () => {
      expect(SOURCE).toContain("<SectionHeading>");
    });
  });

  describe("content sections", () => {
    it("explains why verification exists", () => {
      expect(SOURCE).toContain("Why verification exists");
    });

    it("explains how it works", () => {
      expect(SOURCE).toContain("How it works");
    });

    it("explains what data is signed", () => {
      expect(SOURCE).toContain("What data is signed");
    });

    it("explains what it guarantees", () => {
      expect(SOURCE).toContain("What it guarantees");
    });

    it("explains what it does not guarantee", () => {
      expect(SOURCE).toContain("What it does not guarantee");
    });

    it("explains how to verify a badge", () => {
      expect(SOURCE).toContain("How to verify a badge");
    });

    it("documents design decisions", () => {
      expect(SOURCE).toContain("Design decisions");
    });

    it("mentions HMAC-SHA256", () => {
      expect(SOURCE).toContain("HMAC-SHA256");
    });

    it("mentions 30-day TTL", () => {
      expect(SOURCE).toContain("30-day TTL");
    });

    it("mentions 16-character truncation", () => {
      expect(SOURCE).toContain("16-character truncation");
    });
  });

  describe("links", () => {
    it("links to the verify page", () => {
      expect(SOURCE).toContain('href="/verify"');
    });

    it("has CTA to verify a badge", () => {
      expect(SOURCE).toContain("Verify a Badge");
    });

    it("mentions the API endpoint", () => {
      expect(SOURCE).toContain("/api/verify/");
    });
  });

  describe("a11y: table headers (#333)", () => {
    it("all <th> elements have scope='col'", () => {
      const thMatches = SOURCE.match(/<th\b[^>]*>/g) ?? [];
      expect(thMatches.length).toBeGreaterThan(0);
      for (const th of thMatches) {
        expect(th).toContain('scope="col"');
      }
    });
  });

  describe("design system compliance", () => {
    it("uses semantic background token", () => {
      expect(SOURCE).toContain("bg-bg");
    });

    it("includes Navbar", () => {
      expect(SOURCE).toContain("<Navbar");
    });

    it("includes GlobalCommandBar", () => {
      expect(SOURCE).toContain("<GlobalCommandBar");
    });

    it("has main landmark with id", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("uses font-heading for headings", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses complement color for verify CTA", () => {
      expect(SOURCE).toContain("bg-complement");
    });
  });
});
