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
    expect(SOURCE).toContain('"DELIVERY"');
    expect(SOURCE).toContain('"QUALITY"');
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

// ---------------------------------------------------------------------------
// ISR and server component (#586)
// ---------------------------------------------------------------------------

describe("Landing page — ISR and component export", () => {
  it("exports revalidate = 3600", () => {
    expect(SOURCE).toContain("export const revalidate = 3600");
  });

  it("exports a default async function", () => {
    expect(SOURCE).toContain("export default async function Home");
  });

  it("does NOT have 'use client' directive", () => {
    expect(SOURCE).not.toMatch(/^["']use client["']/m);
  });
});

// ---------------------------------------------------------------------------
// Error handling (#586)
// ---------------------------------------------------------------------------

describe("Landing page — OAuth error handling", () => {
  it("reads error from searchParams", () => {
    expect(SOURCE).toContain("searchParams");
  });

  it("uses getOAuthErrorMessage for error display", () => {
    expect(SOURCE).toContain("getOAuthErrorMessage");
  });

  it("renders ErrorBanner conditionally", () => {
    expect(SOURCE).toContain("<ErrorBanner");
    expect(SOURCE).toContain("errorMessage &&");
  });
});

// ---------------------------------------------------------------------------
// Hero section (#586)
// ---------------------------------------------------------------------------

describe("Landing page — hero section", () => {
  it("has an h1 heading", () => {
    expect(SOURCE).toContain("<h1");
  });

  it("heading contains 'Developer Impact'", () => {
    expect(SOURCE).toContain("Developer Impact");
  });

  it("heading has 'Decoded' in accent color", () => {
    expect(SOURCE).toContain(">Decoded</span>");
  });

  it("has 'Get Your Badge' CTA linking to OAuth", () => {
    expect(SOURCE).toContain('href="/api/auth/login"');
    expect(SOURCE).toContain("Get Your Badge");
  });

  it("has 'Verify a Badge' CTA", () => {
    expect(SOURCE).toContain('href="/verify"');
    expect(SOURCE).toContain("Verify a Badge");
  });
});

// ---------------------------------------------------------------------------
// Demo badge preview (#586)
// ---------------------------------------------------------------------------

describe("Landing page — badge preview", () => {
  it("renders demo badge SVG from hardcoded data", () => {
    expect(SOURCE).toContain("DEMO_STATS");
    expect(SOURCE).toContain("DEMO_IMPACT");
    expect(SOURCE).toContain("renderBadgeSvg");
  });

  it("has role='img' and aria-label on badge container", () => {
    expect(SOURCE).toContain('role="img"');
    expect(SOURCE).toContain('aria-label="Example Chapa developer impact badge"');
  });

  it("renders BadgeOverlay", () => {
    expect(SOURCE).toContain("<BadgeOverlay");
  });
});

// ---------------------------------------------------------------------------
// Embed snippet (#586)
// ---------------------------------------------------------------------------

describe("Landing page — embed snippet", () => {
  it("shows CopyButton for embed snippet", () => {
    expect(SOURCE).toContain("<CopyButton");
  });

  it("snippet references badge.svg URL", () => {
    expect(SOURCE).toContain("badge.svg");
  });
});

// ---------------------------------------------------------------------------
// Terminal sections (#586)
// ---------------------------------------------------------------------------

describe("Landing page — terminal sections", () => {
  it("has all nav-linked section anchors", () => {
    expect(SOURCE).toContain('id="features"');
    expect(SOURCE).toContain('id="how-it-works"');
    expect(SOURCE).toContain('id="enterprise"');
    expect(SOURCE).toContain('id="stats"');
  });

  it("renders terminal command lines", () => {
    expect(SOURCE).toContain("chapa features");
    expect(SOURCE).toContain("chapa explain");
    expect(SOURCE).toContain("chapa enterprise");
    expect(SOURCE).toContain("chapa stats");
    expect(SOURCE).toContain("chapa login");
  });

  it("renders all 5 features", () => {
    expect(SOURCE).toContain("FOUR DIMENSIONS");
    expect(SOURCE).toContain("DEVELOPER ARCHETYPE");
    expect(SOURCE).toContain("VERIFIED METRICS");
    expect(SOURCE).toContain("LIVING DOCUMENT");
    expect(SOURCE).toContain("ONE-CLICK EMBED");
  });

  it("renders 3 how-it-works steps", () => {
    expect(SOURCE).toContain("Sign in with GitHub");
    expect(SOURCE).toContain("We build your profile");
    expect(SOURCE).toContain("Share your badge");
  });

  it("renders stats values", () => {
    expect(SOURCE).toContain("archetypes");
    expect(SOURCE).toContain("dimensions");
    expect(SOURCE).toContain("days scored");
  });

  it("renders LandingTerminal", () => {
    expect(SOURCE).toContain("<LandingTerminal");
  });
});

// ---------------------------------------------------------------------------
// Heading hierarchy (#586)
// ---------------------------------------------------------------------------

describe("Landing page — heading hierarchy", () => {
  it("has exactly one h1", () => {
    const h1Matches = SOURCE.match(/<h1\b/g) ?? [];
    expect(h1Matches.length).toBe(1);
  });

  it("has sr-only h2 headings for sections", () => {
    const srOnlyH2Count = (SOURCE.match(/<h2 className="sr-only">/g) ?? []).length;
    expect(srOnlyH2Count).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Footer (#586)
// ---------------------------------------------------------------------------

describe("Landing page — footer", () => {
  it("has a footer element", () => {
    expect(SOURCE).toContain("<footer");
  });

  it("shows Chapa branding", () => {
    expect(SOURCE).toContain("Chapa<span");
  });

  it("shows copyright with dynamic year", () => {
    expect(SOURCE).toContain("new Date().getFullYear()");
  });
});

// ---------------------------------------------------------------------------
// Design system compliance (#586)
// ---------------------------------------------------------------------------

describe("Landing page — design system compliance", () => {
  it("uses Navbar with navLinks", () => {
    expect(SOURCE).toContain("navLinks={NAV_LINKS}");
  });

  it("uses border-l border-stroke for terminal output blocks", () => {
    const borderMatches = SOURCE.match(/border-l border-stroke/g) ?? [];
    expect(borderMatches.length).toBeGreaterThanOrEqual(5);
  });

  it("uses terminal-dim for $ prefixes", () => {
    expect(SOURCE).toContain("text-terminal-dim");
  });

  it("has main landmark with id", () => {
    expect(SOURCE).toContain('id="main-content"');
  });
});
