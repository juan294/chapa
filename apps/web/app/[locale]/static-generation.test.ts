import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// #1167 (UX-B1) — the property most at risk from adding a shared SiteFooter
// to the 9 locale-segmented content pages (#1023 / FE-H1) is silently
// losing static generation: any per-request cookies()/headers()/dynamic
// data read in a page or a component it renders forces the whole route
// into dynamic rendering, defeating ISR. SiteFooter itself takes an
// already-resolved `t` and has no "use client" of its own (see
// components/SiteFooter.tsx), so it can't be the source of a regression —
// but this locks in the actual `dynamic`/`revalidate` exports on the page
// files this task touched, mirroring the existing archetype ISR check in
// archetypes-isr.test.ts.
const STATIC_PAGES = [
  "about/page.tsx",
  "about/verification/page.tsx",
  "privacy/page.tsx",
  "terms/page.tsx",
];

describe("locale-segmented content pages remain statically generated (#1167 / UX-B1)", () => {
  for (const relativePath of STATIC_PAGES) {
    it(`${relativePath} still forces static rendering with hourly revalidation`, () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, relativePath),
        "utf-8",
      );
      expect(source).toMatch(/export const dynamic = ["']force-static["']/);
      expect(source).toContain("export const revalidate = 3600");
      expect(source).not.toMatch(/export const dynamic = ["']force-dynamic["']/);
    });
  }

  it("the scored landing page follows captured live policy instead of hourly ISR", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../LocalizedHome.tsx"), "utf-8");
    for (const locale of ["en", "es"]) {
      const route = fs.readFileSync(path.resolve(__dirname, `../${locale}/page.tsx`), "utf-8");
      expect(route).toContain('export const dynamic = "force-dynamic"');
    }
    expect(fs.existsSync(path.resolve(__dirname, "page.tsx"))).toBe(false);
    expect(source).not.toMatch(/export const revalidate\s*=/);
    // #1335 phase 5 — the `scoring_v7_rendering` selector is retired; v7.2 is
    // the only rendered policy, so this no longer threads a `selection`.
    expect(source).toContain("getLeaderboard(3)");
  });

  it("the scoring methodology stays force-dynamic and renders the one current policy", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "about/scoring/page.tsx"), "utf-8");
    expect(source).toMatch(/export const dynamic = ["']force-dynamic["']/);
    expect(source).not.toMatch(/export const revalidate\s*=/);
    // #1335 — the `scoring_v7_rendering` selector this page used to read is
    // retired; v7.2 is the one policy, rendered unconditionally.
    expect(source).not.toContain("readScoringRenderSelection");
    expect(source).toContain("observed={true}");
    // Its EN/ES route render tests verify the current arithmetic; every
    // unrelated page above retains its original static/hourly contract.
  });

  it("SiteFooter has no 'use client' directive (stays server-render-safe on force-static pages)", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../components/SiteFooter.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/^["']use client["']/m);
  });
});
