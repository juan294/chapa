import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

const DIFF_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../lib/history/diff.ts"),
  "utf-8",
);

describe("Landing page — Enterprise EMU section", () => {
  it("contains the $ chapa enterprise terminal command", () => {
    expect(SOURCE).toContain("chapa enterprise");
  });

  it("mentions GitHub Enterprise Managed Users", () => {
    expect(SOURCE).toMatch(/Enterprise Managed Users|EMU/);
  });

  it("references the chapa-cli package", () => {
    expect(SOURCE).toContain("chapa-cli");
  });

  it("includes the npx command for the CLI", () => {
    expect(SOURCE).toContain("npx chapa-cli");
  });

  it("follows the terminal output pattern with border-l border-stroke", () => {
    // The enterprise section output block should use the standard terminal pattern
    expect(SOURCE).toContain("border-l border-stroke");
  });

  it("uses animate-fade-in-up for the section", () => {
    // All terminal sections use this animation class
    expect(SOURCE).toContain("animate-fade-in-up");
  });

  it("is placed between features/how-it-works and stats sections", () => {
    const enterpriseIndex = SOURCE.indexOf("chapa enterprise");
    const featuresIndex = SOURCE.indexOf("chapa features");
    const statsIndex = SOURCE.indexOf("chapa stats");

    expect(enterpriseIndex).toBeGreaterThan(-1);
    expect(enterpriseIndex).toBeGreaterThan(featuresIndex);
    expect(enterpriseIndex).toBeLessThan(statsIndex);
  });
});

describe("Landing page — design system tokens (#233)", () => {
  it("does not hardcode archetype hex colors in Tailwind classes", () => {
    expect(SOURCE).not.toContain("text-[#F472B6]");
    expect(SOURCE).not.toContain("hover:text-[#F9A8D4]");
    expect(SOURCE).not.toContain("hover:text-[#6EE7A0]");
    expect(SOURCE).not.toContain("hover:text-[#FCD34D]");
    expect(SOURCE).not.toContain("text-[#9AA4B2]");
    expect(SOURCE).not.toContain("hover:text-[#C0C7D0]");
  });

  it("does not hardcode verify button hover color", () => {
    expect(SOURCE).not.toContain("hover:bg-[#34D399]");
  });

  it("uses archetype design tokens for archetype links", () => {
    expect(SOURCE).toContain("text-archetype-guardian");
    expect(SOURCE).toContain("text-archetype-emerging");
  });
});

// ---------------------------------------------------------------------------
// Issue #307 — Footer internal links should use Next.js Link component
// ---------------------------------------------------------------------------

describe("Landing page — footer internal links (#307)", () => {
  it("imports Link from next/link", () => {
    expect(SOURCE).toMatch(/import\s+Link\s+from\s+["']next\/link["']/);
  });

  it("uses <Link> for /about internal link", () => {
    expect(SOURCE).toMatch(/<Link\s[^>]*href="\/about"/);
  });

  it("uses <Link> for /terms internal link", () => {
    expect(SOURCE).toMatch(/<Link\s[^>]*href="\/terms"/);
  });

  it("uses <Link> for /privacy internal link", () => {
    expect(SOURCE).toMatch(/<Link\s[^>]*href="\/privacy"/);
  });

  it("does not use plain <a> tags for internal footer links", () => {
    // Extract just the footer section
    const footerMatch = SOURCE.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footer = footerMatch![0];

    // Should not have <a href="/about">, <a href="/terms">, <a href="/privacy">
    expect(footer).not.toMatch(/<a\s[^>]*href="\/about"/);
    expect(footer).not.toMatch(/<a\s[^>]*href="\/terms"/);
    expect(footer).not.toMatch(/<a\s[^>]*href="\/privacy"/);
  });

  it("keeps external GitHub link as a plain <a> with target=_blank", () => {
    const footerMatch = SOURCE.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footer = footerMatch![0];

    expect(footer).toMatch(/<a\s[^>]*href="https:\/\/github\.com"/);
    expect(footer).toContain('target="_blank"');
    expect(footer).toContain('rel="noopener noreferrer"');
  });
});

// ---------------------------------------------------------------------------
// How It Works — Scoring overview
// ---------------------------------------------------------------------------

describe("Landing page — scoring overview in How It Works section", () => {
  it("contains a DIMENSIONS data array with all four dimensions", () => {
    expect(SOURCE).toContain('"BUILDING"');
    expect(SOURCE).toContain('"GUARDING"');
    expect(SOURCE).toContain('"CONSISTENCY"');
    expect(SOURCE).toContain('"BREADTH"');
  });

  it("renders the DIMENSIONS array inside the How It Works section", () => {
    const howItWorksIndex = SOURCE.indexOf('id="how-it-works"');
    const enterpriseIndex = SOURCE.indexOf('id="enterprise"');
    expect(howItWorksIndex).toBeGreaterThan(-1);

    const section = SOURCE.slice(howItWorksIndex, enterpriseIndex);
    expect(section).toContain("DIMENSIONS.map");
    expect(section).toContain("What we measure");
  });

  it("includes a link to the full scoring methodology page", () => {
    expect(SOURCE).toMatch(/href="\/about\/scoring"/);
  });

  it("mentions archetypes with links in the scoring overview", () => {
    const howItWorksIndex = SOURCE.indexOf('id="how-it-works"');
    const enterpriseIndex = SOURCE.indexOf('id="enterprise"');
    const section = SOURCE.slice(howItWorksIndex, enterpriseIndex);
    expect(section).toContain("/archetypes/builder");
    expect(section).toContain("/archetypes/guardian");
  });

  it("has the scoring methodology link in the footer", () => {
    const footerMatch = SOURCE.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footer = footerMatch![0];
    expect(footer).toMatch(/<Link\s[^>]*href="\/about\/scoring"/);
  });

  it("step 03 mentions the share page scoring breakdown", () => {
    expect(SOURCE).toContain("scoring breakdown");
  });
});

// ---------------------------------------------------------------------------
// Issue #301 — History exports JSDoc documentation
// ---------------------------------------------------------------------------

describe("History module — pre-built API surface JSDoc (#301)", () => {
  // getLatestSnapshot no longer carries @prebuilt tags —
  // they are actively used delegates to Supabase (Phase 4).

  it("explainDiff has JSDoc mentioning pre-built API surface", () => {
    const match = DIFF_SOURCE.match(
      /\/\*\*[\s\S]*?@prebuilt[\s\S]*?\*\/\s*export\s+function\s+explainDiff/,
    );
    expect(match).not.toBeNull();
  });
});
