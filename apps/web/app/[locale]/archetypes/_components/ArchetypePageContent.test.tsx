// @vitest-environment jsdom
//
// Regression guard for #1170 (UX-H2): ArchetypePageContent rendered the
// entire `essay` array as one undifferentiated block above `sectionIdentifies`,
// then emitted `sectionPractice` and `sectionRadar` headings with nothing
// rendered underneath either of them. This test renders the REAL component
// against the REAL en/es dictionaries (not mocks) so a future edit that
// re-introduces an empty section, or that lets en/es essay arrays drift out
// of sync, fails here.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: () => <div data-testid="command-bar-lazy" />,
}));

afterEach(cleanup);

const ARCHETYPE_KEYS = [
  "builder",
  "guardian",
  "marathoner",
  "polymath",
  "artificer",
  "balanced",
  "emerging",
] as const;

const LOCALES = ["en", "es"] as const;

/** Returns the concatenated text of every element between an h2 `heading`
 * and the next h2 sibling (or the end of the content block) — i.e. the full
 * section body, including any nested h3 subheadings and their content. */
function contentAfterHeading(h2Headings: Element[], headingText: string): string {
  const idx = h2Headings.findIndex((h) => h.textContent === headingText);
  expect(idx, `heading "${headingText}" not found`).toBeGreaterThanOrEqual(0);
  const heading = h2Headings[idx];
  if (!heading) throw new Error(`heading "${headingText}" not found`);
  let el = heading.nextElementSibling;
  let text = "";
  while (el && el.tagName !== "H2") {
    text += el.textContent ?? "";
    el = el.nextElementSibling;
  }
  return text.trim();
}

describe("ArchetypePageContent — every heading has content beneath it (#1170)", () => {
  for (const locale of LOCALES) {
    for (const archetypeKey of ARCHETYPE_KEYS) {
      it(`${locale}/${archetypeKey}: sectionIdentifies, sectionPractice, and sectionRadar all render non-empty content`, async () => {
        const { ArchetypePageContent } = await import("./ArchetypePageContent");
        const { getServerT } = await import("@/lib/i18n/server");
        const t = getServerT(locale);
        const ns = `archetypes.${archetypeKey}`;

        const { container } = render(
          <ArchetypePageContent
            archetypeKey={archetypeKey}
            badgeSvg="<svg data-testid='mock-badge'></svg>"
            t={t}
          />,
        );

        const headings = Array.from(container.querySelectorAll("h2"));

        const sectionIdentifies = t(`${ns}.sectionIdentifies`) as string;
        const sectionPractice = t(`${ns}.sectionPractice`) as string;
        const sectionRadar = t(`${ns}.sectionRadar`) as string;

        expect(contentAfterHeading(headings, sectionIdentifies).length).toBeGreaterThan(0);
        expect(contentAfterHeading(headings, sectionPractice).length).toBeGreaterThan(0);
        expect(contentAfterHeading(headings, sectionRadar).length).toBeGreaterThan(0);

        // The radar section must actually be about the radar shape — guards
        // against practiceEssay/radarEssay paragraphs being swapped.
        expect(contentAfterHeading(headings, sectionRadar).toLowerCase()).toMatch(/radar/);
      });
    }
  }
});

describe("dictionary shape — practiceEssay/radarEssay (#1170)", () => {
  for (const locale of LOCALES) {
    for (const archetypeKey of ARCHETYPE_KEYS) {
      it(`${locale}/${archetypeKey}: essay, practiceEssay, and radarEssay are all non-empty string arrays`, async () => {
        const { en } = await import("@/lib/i18n/dictionaries/en");
        const { es } = await import("@/lib/i18n/dictionaries/es");
        const dict = locale === "en" ? en : es;
        const archetypes = dict.archetypes as unknown as Record<
          typeof archetypeKey,
          { essay: string[]; practiceEssay: string[]; radarEssay: string[] }
        >;
        const archetype = archetypes[archetypeKey];

        expect(Array.isArray(archetype.essay)).toBe(true);
        expect(archetype.essay.length).toBeGreaterThan(0);
        expect(Array.isArray(archetype.practiceEssay)).toBe(true);
        expect(archetype.practiceEssay.length).toBeGreaterThan(0);
        expect(Array.isArray(archetype.radarEssay)).toBe(true);
        expect(archetype.radarEssay.length).toBeGreaterThan(0);
      });
    }
  }
});

// #1195 — the rename from ArchetypePageClient exists to stop the name
// asserting a boundary the file does not have. The guard is the absence of
// "use client": adding it would break the `t` FUNCTION prop this component
// takes from ArchetypePage (functions do not serialize across the boundary)
// and pull the archetype dictionaries into the client bundle, undoing the
// FE-H1/PE-H1 bundle work.
describe("ArchetypePageContent is a server component (#1195)", () => {
  it('has no "use client" directive', async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "ArchetypePageContent.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*["']use client["']/m);
  });

  it("is not named *Client, which is this tree's client-boundary convention", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = fs.readdirSync(path.resolve(__dirname));
    expect(files.filter((f) => f.startsWith("ArchetypePageClient"))).toEqual([]);
  });
});
