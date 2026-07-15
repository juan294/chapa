import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Render tests for all 7 archetype page files.
 * Now thin wrappers delegating to ArchetypePage component.
 * Tests verify structure, i18n wiring, and design system compliance.
 */

const ARCHETYPE_DIRS = [
  "balanced",
  "builder",
  "emerging",
  "guardian",
  "marathoner",
  "polymath",
  "artificer",
];

describe("Archetype pages — render tests", () => {
  for (const archetype of ARCHETYPE_DIRS) {
    describe(archetype, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, archetype, "page.tsx"),
        "utf-8",
      );

      // #1023 (FE-H1) — locale now comes from the route's [locale] segment
      // param (populated by proxy.ts), not a build-time DEFAULT_LOCALE
      // constant or a request-time getServerLocale() cookie/header read.
      describe("metadata", () => {
        it("exports generateMetadata using the [locale] route param", () => {
          expect(source).toContain("generateMetadata");
          expect(source).not.toContain("DEFAULT_LOCALE");
          expect(source).not.toContain("getServerLocale");
          expect(source).toContain("getServerT");
          expect(source).toContain("params");
        });

        it("uses i18n key for title and description", () => {
          expect(source).toContain(`archetypes.${archetype}.metadataTitle`);
          expect(source).toContain(`archetypes.${archetype}.metadataDescription`);
        });
      });

      describe("default export", () => {
        it("exports a default async function component", () => {
          expect(source).toMatch(/export default async function \w+Page/);
        });

        it("delegates to ArchetypePage", () => {
          expect(source).toContain("ArchetypePage");
          expect(source).toContain(`archetypeKey="${archetype}"`);
        });

        it("uses ISR with no query-string searchParams (static-friendly)", () => {
          // Locale comes from the [locale] route *param* (populated by
          // proxy.ts), never a query-string searchParam.
          expect(source).not.toContain("searchParams={searchParams}");
          expect(source).toContain("ArchetypePage");
        });
      });

      describe("static/ISR rendering", () => {
        it("forces static rendering with hourly revalidation", () => {
          expect(source).toContain("export const dynamic = 'force-static'");
          expect(source).toContain("export const revalidate = 3600");
          expect(source).not.toContain("force-dynamic");
        });
      });

      describe("i18n imports", () => {
        it("imports from @/lib/i18n/server", () => {
          expect(source).toContain("@/lib/i18n/server");
        });
      });
    });
  }
});

describe("ArchetypePage shared component", () => {
  const source = [
    fs.readFileSync(
      path.resolve(__dirname, "_components/ArchetypePage.tsx"),
      "utf-8",
    ),
    fs.readFileSync(
      path.resolve(__dirname, "_components/ArchetypePageClient.tsx"),
      "utf-8",
    ),
  ].join("\n");

  it("imports renderBadgeSvg", () => {
    expect(source).toContain("renderBadgeSvg");
  });

  it("keeps server badge rendering independent of request locale", () => {
    expect(source).not.toContain("getServerLocale");
    expect(source).toContain("renderBadgeSvg");
    expect(source).toContain("ArchetypePageClient");
  });

  // #1023 (FE-H1) — ArchetypePageClient no longer renders a bare, no-op
  // <LocaleSync /> (it never received a queryLang prop here, so it never did
  // anything): it now receives `t` (getServerT(locale)) as a prop directly,
  // with `locale` sourced from the route's [locale] segment param. Dead code
  // removed per the project's "no dead code" rule.
  it("resolves translation via getServerT(locale) passed down from ArchetypePage", () => {
    expect(source).toContain("getServerT");
    expect(source).toContain("t: TFunction");
    expect(source).not.toContain("useTranslation");
  });

  it("uses NavbarClient and GlobalCommandBarLazy (ISR-compatible)", () => {
    expect(source).toContain("NavbarClient");
    expect(source).toContain("GlobalCommandBarLazy");
  });

  it("has main landmark with id", () => {
    expect(source).toContain('id="main-content"');
  });

  it("uses font-heading", () => {
    expect(source).toContain("font-heading");
  });

  it("uses border-l border-stroke for content", () => {
    expect(source).toContain("border-l border-stroke");
  });

  it("uses animate-fade-in-up", () => {
    expect(source).toContain("animate-fade-in-up");
  });

  it("uses bg-bg for background", () => {
    expect(source).toContain("bg-bg");
  });

  it("has badge with role=img and aria-label", () => {
    expect(source).toContain('role="img"');
    expect(source).toContain("aria-label");
  });

  it("uses dangerouslySetInnerHTML for SVG", () => {
    expect(source).toContain("dangerouslySetInnerHTML");
  });

  it("enables demoMode and includeBranding", () => {
    expect(source).toContain("demoMode: true");
    expect(source).toContain("includeBranding: true");
  });

  it("renders all 7 archetypes via DEMO_DATA map", () => {
    const archetypes = ["builder", "guardian", "marathoner", "polymath", "artificer", "balanced", "emerging"];
    for (const a of archetypes) {
      expect(source).toContain(a);
    }
  });

  it("links back to features", () => {
    expect(source).toContain('href="/#features"');
  });

  it("links to scoring methodology", () => {
    expect(source).toContain('href="/about/scoring"');
  });

  it("wraps content in an article element", () => {
    expect(source).toContain("<article");
  });

  it("uses terminal command pattern", () => {
    expect(source).toContain("text-terminal-dim");
  });
});
